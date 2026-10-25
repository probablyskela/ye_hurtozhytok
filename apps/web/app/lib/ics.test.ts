import { describe, expect, it } from "vitest";

import { bookingIcs } from "./ics";

describe("bookingIcs", () => {
  it("writes the booking in UTC with a 15-minute alarm", () => {
    const ics = bookingIcs({
      id: 7,
      date: "2026-11-10",
      startMin: 18 * 60,
      endMin: 20 * 60,
      machine: "6 поверх, №1",
      url: "https://x/bookings/7",
      nowMs: 0,
    });
    expect(ics).toContain("DTSTART:20261110T160000Z");
    expect(ics).toContain("DTEND:20261110T180000Z");
    expect(ics).toContain("SUMMARY:Прання: 6 поверх\\, №1");
    expect(ics).toContain("TRIGGER:-PT15M");
  });
});
