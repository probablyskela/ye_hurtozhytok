/**
 * Bookings carry a Kyiv calendar date ("2026-10-25") and minutes from Kyiv
 * midnight. Event timestamps are UTC milliseconds. Nothing here uses the
 * server's local time zone.
 */
export const TIME_ZONE = "Europe/Kyiv";

const DAY = 24 * 60 * 60_000;

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function kyivParts(ms: number) {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(new Date(ms)))
    parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetAt(ms: number): number {
  const p = kyivParts(ms);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Kyiv date and minutes from midnight → UTC ms. Minute 1440 is the next midnight. */
export function kyivMinuteToUtc(dateKey: string, minute: number): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d) + minute * 60_000;
  let ts = wall - offsetAt(wall);
  const corrected = wall - offsetAt(ts);
  if (corrected !== ts) ts = corrected;
  return ts;
}

export function kyivDateKey(ms: number): string {
  const p = kyivParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since Kyiv midnight for a UTC instant. */
export function kyivMinute(ms: number): number {
  const p = kyivParts(ms);
  return p.hour * 60 + p.minute;
}

export function kyivNow(ms: number = Date.now()) {
  return { date: kyivDateKey(ms), minute: kyivMinute(ms) };
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d) + days * DAY);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Whole days from `from` to `to` (both date keys). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY,
  );
}

export const WEEKDAYS = [
  "понеділок",
  "вівторок",
  "середа",
  "четвер",
  "пʼятниця",
  "субота",
  "неділя",
];
export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const MONTHS_GENITIVE = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

export function dayOfMonth(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

/** "25 жовтня" */
export function dateLong(dateKey: string): string {
  return `${dayOfMonth(dateKey)} ${MONTHS_GENITIVE[Number(dateKey.slice(5, 7)) - 1]}`;
}

/** "Сьогодні", "Завтра" or "Вт, 27 жовтня". */
export function dayName(dateKey: string, today: string): string {
  const diff = daysBetween(today, dateKey);
  if (diff === 0) return "Сьогодні";
  if (diff === 1) return "Завтра";
  return `${WEEKDAYS_SHORT[weekdayIndex(dateKey)]}, ${dateLong(dateKey)}`;
}

/** "Сьогодні, неділя" / "Завтра, понеділок" / "Вівторок, 27 жовтня". */
export function dayHeading(dateKey: string, today: string): string {
  const diff = daysBetween(today, dateKey);
  const weekday = WEEKDAYS[weekdayIndex(dateKey)];
  if (diff === 0) return `Сьогодні, ${weekday}`;
  if (diff === 1) return `Завтра, ${weekday}`;
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${dateLong(dateKey)}`;
}
