import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  dayHeading,
  dayName,
  kyivDateKey,
  kyivMinute,
  kyivMinuteToUtc,
} from "./time";

describe("Kyiv time", () => {
  it("converts a Kyiv minute to UTC in winter and summer", () => {
    // Winter: UTC+2.
    expect(new Date(kyivMinuteToUtc("2026-11-10", 18 * 60)).toISOString()).toBe(
      "2026-11-10T16:00:00.000Z",
    );
    // Summer: UTC+3.
    expect(new Date(kyivMinuteToUtc("2026-07-10", 18 * 60)).toISOString()).toBe(
      "2026-07-10T15:00:00.000Z",
    );
  });

  it("treats minute 1440 as the next midnight", () => {
    expect(kyivMinuteToUtc("2026-11-10", 1440)).toBe(
      kyivMinuteToUtc("2026-11-11", 0),
    );
  });

  it("survives the switch to winter time (25 October 2026)", () => {
    const evening = kyivMinuteToUtc("2026-10-25", 18 * 60);
    expect(new Date(evening).toISOString()).toBe("2026-10-25T16:00:00.000Z");
    expect(kyivDateKey(evening)).toBe("2026-10-25");
    expect(kyivMinute(evening)).toBe(18 * 60);
  });

  it("survives the switch to summer time (28 March 2027)", () => {
    const opening = kyivMinuteToUtc("2027-03-28", 6 * 60);
    expect(new Date(opening).toISOString()).toBe("2027-03-28T03:00:00.000Z");
    expect(kyivMinute(opening)).toBe(6 * 60);
    expect(kyivMinuteToUtc("2027-03-28", 1440)).toBe(
      Date.parse("2027-03-28T21:00:00Z"),
    );
  });

  it("reads the Kyiv date near midnight UTC", () => {
    expect(kyivDateKey(Date.parse("2026-11-10T22:30:00Z"))).toBe("2026-11-11");
  });
});

describe("dates", () => {
  it("adds days across months", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(daysBetween("2026-10-25", "2026-11-01")).toBe(7);
  });

  it("names days relative to today", () => {
    expect(dayName("2026-10-25", "2026-10-25")).toBe("Сьогодні");
    expect(dayName("2026-10-26", "2026-10-25")).toBe("Завтра");
    expect(dayName("2026-10-27", "2026-10-25")).toBe("Вт, 27 жовтня");
    expect(dayHeading("2026-10-25", "2026-10-25")).toBe("Сьогодні, неділя");
    expect(dayHeading("2026-10-27", "2026-10-25")).toBe("Вівторок, 27 жовтня");
  });
});
