import { describe, expect, it } from "vitest";
import { addDays, dateRange, isDateString, todayFor, weekStart } from "./dates";

describe("timezone-aware health dates", () => {
  it("computes local dates across UTC midnight", () => {
    const instant = new Date("2026-11-07T04:30:00.000Z");
    expect(todayFor("America/Los_Angeles", instant)).toBe("2026-11-06");
    expect(todayFor("Asia/Kolkata", instant)).toBe("2026-11-07");
    expect(() => todayFor("Invalid/Timezone", instant)).toThrow(RangeError);
  });

  it("handles DST boundaries as calendar dates", () => {
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(todayFor("America/New_York", new Date("2026-03-08T07:30:00.000Z"))).toBe(
      "2026-03-08",
    );
  });

  it("uses Monday as the week start and validates ranges", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(dateRange("2026-11-02", "2026-11-04")).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2024-02-29")).toBe(true);
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => dateRange("2026-11-04", "2026-11-02")).toThrow(RangeError);
  });
});
