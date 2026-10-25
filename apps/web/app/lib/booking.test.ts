import { describe, expect, it } from "vitest";

import {
  BUFFER_MIN,
  CLOSE_MIN,
  OPEN_MIN,
  clashes,
  countdown,
  durationLabel,
  durationWords,
  fmtMin,
  freeStarts,
  freeWindows,
  machineNow,
  parseDuration,
  validateRequest,
} from "./booking";

const t = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const slot = (a: string, b: string) => ({ startMin: t(a), endMin: t(b) });

describe("labels", () => {
  it("formats minutes as wall-clock time, including midnight", () => {
    expect(fmtMin(t("06:15"))).toBe("06:15");
    expect(fmtMin(CLOSE_MIN)).toBe("24:00");
  });
  it("names durations in plain Ukrainian", () => {
    expect(durationLabel(30)).toBe("30 хв");
    expect(durationLabel(90)).toBe("1,5 год");
    expect(durationLabel(120)).toBe("2 год");
    expect(durationWords(60)).toBe("1 година");
    expect(durationWords(150)).toBe("2,5 години");
  });
  it("falls back to two hours for an unknown duration", () => {
    expect(parseDuration("45")).toBe(120);
    expect(parseDuration("90")).toBe(90);
  });
});

describe("clashes", () => {
  const booked = [slot("12:30", "14:30")];
  it("keeps the buffer on both sides", () => {
    expect(clashes(slot("14:30", "15:00"), booked)).toBe(true);
    expect(clashes(slot("14:35", "15:05"), booked)).toBe(false);
    expect(clashes(slot("11:30", "12:30"), booked)).toBe(true);
    expect(clashes(slot("11:30", "12:25"), booked)).toBe(false);
  });
  it("treats the buffer as exactly 5 minutes", () => {
    expect(BUFFER_MIN).toBe(5);
  });
});

describe("freeStarts", () => {
  const day = [
    slot("12:30", "14:30"),
    slot("18:00", "20:00"),
    slot("20:15", "21:45"),
  ];

  it("offers every 5-minute start where the whole booking fits", () => {
    const starts = freeStarts(day, 120, t("13:40")).map(fmtMin);
    // Right after the 12:30–14:30 booking plus 5 minutes, up to the last start
    // that still ends 5 minutes before 18:00, then after 21:45.
    expect(starts[0]).toBe("14:35");
    expect(starts).toContain("15:55");
    expect(starts).not.toContain("16:00");
    expect(starts.slice(-3)).toEqual(["21:50", "21:55", "22:00"]);
    expect(starts).toHaveLength(17 + 3);
  });

  it("starts at opening time on a future day", () => {
    expect(freeStarts([], 30, null)[0]).toBe(OPEN_MIN);
  });

  it("never runs past midnight", () => {
    const starts = freeStarts([], 150, null);
    expect(starts.at(-1)).toBe(CLOSE_MIN - 150);
  });

  it("rounds the current time up to the grid", () => {
    expect(freeStarts([], 30, t("09:01"))[0]).toBe(t("09:05"));
    expect(freeStarts([], 30, t("09:00"))[0]).toBe(t("09:00"));
  });

  it("returns nothing when the day is full", () => {
    expect(freeStarts([slot("06:00", "24:00")], 30, null)).toEqual([]);
  });
});

describe("validateRequest", () => {
  const now = { date: "2026-10-25", minute: t("13:40") };
  const ok = { date: "2026-10-25", startMin: t("14:45"), duration: 120 };

  it("accepts a valid request", () => {
    expect(validateRequest(ok, now)).toBeNull();
  });
  it("rejects malformed and impossible dates", () => {
    expect(validateRequest({ ...ok, date: "2026-10-26x" }, now)).toBe("date");
    expect(validateRequest({ ...ok, date: "2026-10-26 " }, now)).toBe("date");
    expect(validateRequest({ ...ok, date: "abc" }, now)).toBe("date");
    expect(validateRequest({ ...ok, date: "2026-02-30" }, now)).toBe("date");
  });
  it("rejects lengths outside the five options", () => {
    expect(validateRequest({ ...ok, duration: 45 }, now)).toBe("duration");
    expect(validateRequest({ ...ok, duration: 180 }, now)).toBe("duration");
  });
  it("accepts 5-minute starts and rejects anything finer", () => {
    expect(validateRequest({ ...ok, startMin: t("14:35") }, now)).toBeNull();
    expect(validateRequest({ ...ok, startMin: t("14:47") }, now)).toBe("grid");
  });
  it("rejects times outside laundry hours", () => {
    expect(
      validateRequest({ ...ok, startMin: t("05:45"), duration: 30 }, now),
    ).toBe("hours");
    expect(
      validateRequest({ ...ok, startMin: t("22:00"), duration: 150 }, now),
    ).toBe("hours");
    expect(
      validateRequest({ ...ok, startMin: t("21:30"), duration: 150 }, now),
    ).toBeNull();
  });
  it("rejects the past but forgives a page opened a few minutes ago", () => {
    expect(validateRequest({ ...ok, startMin: t("13:00") }, now)).toBe("past");
    expect(validateRequest({ ...ok, startMin: t("13:30") }, now)).toBeNull();
    expect(validateRequest({ ...ok, startMin: t("13:25") }, now)).toBe("past");
    expect(validateRequest({ ...ok, date: "2026-10-24" }, now)).toBe("past");
  });
  it("allows today plus six days", () => {
    expect(validateRequest({ ...ok, date: "2026-10-31" }, now)).toBeNull();
    expect(validateRequest({ ...ok, date: "2026-11-01" }, now)).toBe("horizon");
  });
});

describe("machineNow", () => {
  const day = [slot("12:30", "14:30"), slot("18:00", "20:00")];
  it("reports who is washing and until when", () => {
    expect(machineNow(day, t("13:40"))).toEqual({
      kind: "busy",
      until: t("14:30"),
      bookingIndex: 0,
    });
  });
  it("reports how long the machine stays free", () => {
    expect(machineNow(day, t("15:00"))).toEqual({
      kind: "free",
      until: t("18:00"),
    });
    expect(machineNow(day, t("21:00"))).toEqual({ kind: "free", until: null });
  });
  it("is closed outside laundry hours", () => {
    expect(machineNow(day, t("05:00"))).toEqual({ kind: "closed" });
  });
});

describe("freeWindows", () => {
  it("lists gaps long enough for the shortest booking", () => {
    const day = [
      slot("12:30", "14:30"),
      slot("18:00", "20:00"),
      slot("20:15", "21:45"),
    ];
    expect(
      freeWindows(day, t("13:40")).map(
        (w) => `${fmtMin(w.startMin)}–${fmtMin(w.endMin)}`,
      ),
    ).toEqual(["14:35–17:55", "21:50–24:00"]);
  });
});

describe("countdown", () => {
  const m = 60_000;
  it("speaks in hours and minutes", () => {
    expect(countdown(0, 260 * m)).toBe("через 4 год 20 хв");
    expect(countdown(0, 120 * m)).toBe("через 2 год");
    expect(countdown(0, 5 * m)).toBe("через 5 хв");
    expect(countdown(0, 0)).toBe("зараз");
    expect(countdown(0, 50 * 60 * m)).toBe("через 2 дні");
  });
});
