import { describe, it, expect } from "vitest";
import { advance, dueRuns, upcomingRuns } from "../packages/core/src/recurring";

describe("advance()", () => {
  it("adds a month on the same day", () => {
    expect(advance("2026-03-15", "monthly")).toBe("2026-04-15");
  });

  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    expect(advance("2027-01-31", "monthly")).toBe("2027-02-28");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    expect(advance("2028-01-31", "monthly")).toBe("2028-02-29");
  });

  it("rolls over the year boundary", () => {
    expect(advance("2026-12-05", "monthly")).toBe("2027-01-05");
  });

  it("adds 7 days for weekly", () => {
    expect(advance("2026-08-01", "weekly")).toBe("2026-08-08");
  });

  it("adds 3 months for quarterly, clamping when needed", () => {
    expect(advance("2026-11-30", "quarterly")).toBe("2027-02-28");
  });

  it("adds 12 months for yearly", () => {
    expect(advance("2026-02-29", "yearly")).toBe("2027-02-28");
  });
});

describe("dueRuns()", () => {
  it("returns every run on or before today", () => {
    expect(dueRuns("2026-06-01", "monthly", "2026-08-15")).toEqual(["2026-06-01", "2026-07-01", "2026-08-01"]);
  });

  it("returns nothing when the next run is in the future", () => {
    expect(dueRuns("2026-09-01", "monthly", "2026-08-15")).toEqual([]);
  });

  it("caps runaway backfill instead of returning years of runs", () => {
    const runs = dueRuns("2020-01-01", "monthly", "2026-08-22", 12);
    expect(runs).toHaveLength(12);
  });
});

describe("upcomingRuns()", () => {
  it("previews the next N scheduled dates from a given start", () => {
    expect(upcomingRuns("2026-08-01", "monthly", 3)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
  });
});
