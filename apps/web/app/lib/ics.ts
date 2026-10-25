import { kyivMinuteToUtc } from "./time";

const stamp = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/[,;]/g, (c) => `\\${c}`)
    .replace(/\n/g, "\\n");

/** One calendar event for a booking, in UTC so every calendar app places it right. */
export function bookingIcs(b: {
  id: number;
  date: string;
  startMin: number;
  endMin: number;
  machine: string;
  url: string;
  nowMs: number;
}): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ehurtozhytok//uk",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:booking-${b.id}@ehurtozhytok`,
    `DTSTAMP:${stamp(b.nowMs)}`,
    `DTSTART:${stamp(kyivMinuteToUtc(b.date, b.startMin))}`,
    `DTEND:${stamp(kyivMinuteToUtc(b.date, b.endMin))}`,
    `SUMMARY:${escape(`Прання: ${b.machine}`)}`,
    `DESCRIPTION:${escape(`Запис у єГуртожитку. ${b.url}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape("Прання за 15 хвилин")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
