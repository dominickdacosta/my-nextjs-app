import { z } from "zod";
import { isDateString } from "../health/dates";

export const activitySchema = z.object({
  loggedOn: z.string().refine(isDateString, "Enter a valid log date."),
  activeMinutes: z.number().int().min(0).max(1440).default(0),
  distanceM: z.number().int().min(0).max(1000000).default(0),
}).strict();
