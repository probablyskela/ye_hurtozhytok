import { describe, expect, it } from "vitest";

import {
  agoLabel,
  feedSections,
  parseAnnouncementForm,
  whenLabel,
} from "./announcements";

const TODAY = "2026-11-01";
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("announcement form", () => {
  it("accepts a dated event with a time", () => {
    const r = parseAnnouncementForm(
      form({
        title: "  Збори   мешканців ",
        body: "Звіт за жовтень\r\nі вибори",
        place: "Читальна зала",
        date: "2026-11-02",
        time: String(19 * 60),
      }),
      TODAY,
    );
    expect(r).toEqual({
      ok: true,
      values: {
        title: "Збори мешканців",
        body: "Звіт за жовтень\nі вибори",
        place: "Читальна зала",
        date: "2026-11-02",
        startMin: 19 * 60,
      },
    });
  });
  it("allows news without a date", () => {
    const r = parseAnnouncementForm(form({ title: "Нові правила" }), TODAY);
    expect(r.ok && r.values.date).toBeNull();
  });
  it("explains what is wrong", () => {
    const r = parseAnnouncementForm(form({ title: "Ок", time: "600" }), TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toBeTruthy();
      expect(r.errors.time).toBe("Якщо вказуєте час, вкажіть і дату.");
    }
  });
  it("refuses impossible and past dates for new ones only", () => {
    const bad = parseAnnouncementForm(
      form({ title: "Подія", date: "2027-02-31" }),
      TODAY,
    );
    expect(!bad.ok && bad.errors.date).toBe("Такої дати не існує.");
    const past = form({ title: "Подія", date: "2026-10-20" });
    expect(parseAnnouncementForm(past, TODAY).ok).toBe(false);
    expect(parseAnnouncementForm(past, TODAY, { allowPast: true }).ok).toBe(
      true,
    );
  });
});

describe("when and ago", () => {
  it("names the day and time", () => {
    expect(whenLabel("2026-11-02", 19 * 60, TODAY)).toBe(
      "Завтра, понеділок · 19:00",
    );
    expect(whenLabel("2026-11-01", null, TODAY)).toBe("Сьогодні, неділя");
    expect(whenLabel(null, null, TODAY)).toBeNull();
  });
  it("counts days back in Ukrainian", () => {
    expect(agoLabel(TODAY, TODAY)).toBe("сьогодні");
    expect(agoLabel("2026-10-31", TODAY)).toBe("вчора");
    expect(agoLabel("2026-10-29", TODAY)).toBe("3 дні тому");
    expect(agoLabel("2026-10-20", TODAY)).toBe("12 днів тому");
    expect(agoLabel("2026-10-11", TODAY)).toBe("21 день тому");
  });
});

describe("home feed", () => {
  const now = Date.UTC(2026, 10, 1, 12);
  const day = 86_400_000;
  const a = (
    id: number,
    date: string | null,
    important = false,
    publishedAgo = 1,
  ) => ({
    id,
    important,
    date,
    startMin: null,
    publishedAt: now - publishedAgo * day,
  });
  it("splits important, upcoming, fresh and history", () => {
    const s = feedSections(
      [
        a(1, "2026-11-05"),
        a(2, "2026-11-02"),
        a(3, null),
        a(4, null, false, 30),
        a(5, "2026-10-20"),
        a(6, "2026-11-03", true),
        a(7, "2026-10-25", true),
      ],
      TODAY,
      now,
    );
    expect(s.important.map((x) => x.id)).toEqual([6]);
    expect(s.upcoming.map((x) => x.id)).toEqual([2, 1]);
    expect(s.fresh.map((x) => x.id)).toEqual([3]);
    expect(s.history.map((x) => x.id).sort()).toEqual([4, 5, 7]);
  });
});
