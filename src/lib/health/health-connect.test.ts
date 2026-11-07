import { describe, expect, it } from "vitest";
import {
  healthConnectDayRange,
  parseHealthConnectSteps,
} from "./health-connect";

describe("parseHealthConnectSteps", () => {
  it("returns zero when no steps are available", () => {
    expect(parseHealthConnectSteps(undefined)).toBe(0);
    expect(parseHealthConnectSteps("[]")).toBe(0);
  });

  describe("healthConnectDayRange", () => {
    it("uses the user's timezone across daylight-saving changes", () => {
      expect(healthConnectDayRange("2026-03-08", "America/Los_Angeles")).toEqual({
        startDate: "2026-03-08T08:00:00Z",
        endDate: "2026-03-09T07:00:00Z",
      });
    });
  });

  it("parses a single aggregate result", () => {
    expect(parseHealthConnectSteps('[{"Value":4500}]')).toBe(4500);
    expect(
      parseHealthConnectSteps(
        '{"results":[{"block":0,"values":[4500],"recordMetadataList":[]}]}',
      ),
    ).toBe(4500);
  });

  it("adds multiple aggregate buckets", () => {
    expect(
      parseHealthConnectSteps(
        '[{"result":{"stepsCount":1200}},{"result":{"stepsCount":800}}]',
      ),
    ).toBe(2000);
  });

  it("rejects malformed or unsupported plugin results", () => {
    expect(() => parseHealthConnectSteps("{")).toThrow();
    expect(() => parseHealthConnectSteps('[{"startDate":"2026-01-01"}]')).toThrow(
      "Health Connect returned an unsupported step result.",
    );
  });
});
