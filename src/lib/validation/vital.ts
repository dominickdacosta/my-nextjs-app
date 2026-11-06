import { z } from "zod";
import { isDateString } from "../health/dates";

const vitalSchema = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  kind: z.enum([
    "blood_pressure",
    "heart_rate",
    "blood_glucose",
    "oxygen_saturation",
    "temperature",
  ]),
  valuePrimary: z.number().min(0.1).max(1000),
  valueSecondary: z.number().min(0.1).max(1000).nullable().optional(),
  unit: z.enum(["mmHg", "bpm", "mg/dL", "mmol/L", "%", "°C", "°F"]),
  context: z.string().trim().max(120).nullable().optional(),
  measuredAt: z.string().datetime().nullable().optional(),
});

function validateVital(
  vital: z.infer<typeof vitalSchema>,
  context: z.RefinementCtx,
) {
  const expectedUnits = {
    blood_pressure: ["mmHg"],
    heart_rate: ["bpm"],
    blood_glucose: ["mg/dL", "mmol/L"],
    oxygen_saturation: ["%"],
    temperature: ["°C", "°F"],
  } as const;
  if (!expectedUnits[vital.kind].some((unit) => unit === vital.unit)) {
    context.addIssue({
      code: "custom",
      path: ["unit"],
      message: "Unit does not match the vital type.",
    });
  }
  const range = {
    blood_pressure: { min: 50, max: 300 },
    heart_rate: { min: 30, max: 250 },
    blood_glucose:
      vital.unit === "mmol/L" ? { min: 0.5, max: 55 } : { min: 10, max: 1000 },
    oxygen_saturation: { min: 50, max: 100 },
    temperature:
      vital.unit === "°F" ? { min: 77, max: 113 } : { min: 25, max: 45 },
  }[vital.kind];
  if (
    vital.valuePrimary < range.min ||
    vital.valuePrimary > range.max
  ) {
    context.addIssue({
      code: "custom",
      path: ["valuePrimary"],
      message: "Value is outside the supported range.",
    });
  }
  if (vital.kind === "blood_pressure" && vital.valueSecondary == null) {
    context.addIssue({
      code: "custom",
      path: ["valueSecondary"],
      message: "Enter the diastolic value.",
    });
  }
  if (
    vital.kind === "blood_pressure" &&
    vital.valueSecondary != null &&
    (vital.valueSecondary < 30 ||
      vital.valueSecondary > 200 ||
      vital.valuePrimary <= vital.valueSecondary)
  ) {
    context.addIssue({
      code: "custom",
      path: ["valueSecondary"],
      message: "Enter a valid diastolic value.",
    });
  }
  if (vital.kind !== "blood_pressure" && vital.valueSecondary != null) {
    context.addIssue({
      code: "custom",
      path: ["valueSecondary"],
      message: "This vital type uses one value.",
    });
  }
}

export const vitalEntrySchema = vitalSchema.superRefine(validateVital);

export const vitalRestoreSchema = vitalSchema.extend({
  loggedAt: z.string().datetime().optional(),
}).superRefine(validateVital);
