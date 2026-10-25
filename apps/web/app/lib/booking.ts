/**
 * Booking rules. Pure functions only: everything here is shared by loaders,
 * actions and the UI, and covered by tests.
 */
import { addDays, daysBetween } from "./time";

/** Laundry hours, minutes from Kyiv midnight: 06:00 to 24:00. */
export const OPEN_MIN = 6 * 60;
export const CLOSE_MIN = 24 * 60;
/** Starts fall on a 15-minute grid. */
export const STEP_MIN = 15;
/** Free gap kept between two bookings on one machine. */
export const BUFFER_MIN = 15;
export const DURATIONS = [30, 60, 90, 120, 150] as const;
export type Duration = (typeof DURATIONS)[number];
export const DEFAULT_DURATION: Duration = 120;
/** Today plus six more days. */
export const HORIZON_DAYS = 7;
/** Bookings that have not ended yet, per person. */
export const MAX_ACTIVE = 3;
/** Someone who has not come within this time loses the machine. */
export const NO_SHOW_MIN = 15;

export type Slot = { startMin: number; endMin: number };

const pad = (n: number) => String(n).padStart(2, "0");

/** 375 → "06:15"; 1440 → "24:00". */
export function fmtMin(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/** 30 → "30 хв", 90 → "1,5 год". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} хв`;
  return `${String(minutes / 60).replace(".", ",")} год`;
}

/** 120 → "2 години", 90 → "1,5 години", 60 → "1 година", 30 → "30 хвилин". */
export function durationWords(minutes: number): string {
  if (minutes < 60) return `${minutes} хвилин`;
  if (minutes === 60) return "1 година";
  return `${String(minutes / 60).replace(".", ",")} години`;
}

export function isDuration(value: number): value is Duration {
  return (DURATIONS as readonly number[]).includes(value);
}

export function parseDuration(value: unknown): Duration {
  const n = Number(value);
  return isDuration(n) ? n : DEFAULT_DURATION;
}

/** The first grid start not earlier than `minute`. */
export function ceilToStep(minute: number): number {
  return Math.ceil(minute / STEP_MIN) * STEP_MIN;
}

/** True when [start, end) comes closer than the buffer to any booking. */
export function clashes(slot: Slot, bookings: readonly Slot[]): boolean {
  return bookings.some(
    (b) =>
      slot.startMin < b.endMin + BUFFER_MIN &&
      slot.endMin + BUFFER_MIN > b.startMin,
  );
}

/**
 * Every start on the grid from which a booking of `duration` fits whole:
 * inside laundry hours, not in the past, and clear of other bookings and their
 * buffers. `nowMin` is given only for today.
 */
export function freeStarts(
  bookings: readonly Slot[],
  duration: number,
  nowMin: number | null,
): number[] {
  const from = Math.max(OPEN_MIN, nowMin === null ? 0 : ceilToStep(nowMin));
  const out: number[] = [];
  for (let s = from; s + duration <= CLOSE_MIN; s += STEP_MIN) {
    if (!clashes({ startMin: s, endMin: s + duration }, bookings)) out.push(s);
  }
  return out;
}

export type BookingError =
  | "duration"
  | "grid"
  | "hours"
  | "past"
  | "horizon"
  | "taken"
  | "limit"
  | "profile"
  | "machine";

export const BOOKING_ERRORS: Record<BookingError, string> = {
  duration: "Оберіть тривалість: 30 хв, 1, 1,5, 2 або 2,5 години.",
  grid: "Початок має припадати на 00, 15, 30 чи 45 хвилин.",
  hours: "Пралки працюють з 06:00 до 24:00. Оберіть інший час.",
  past: "Цей час уже минув. Оберіть інший.",
  horizon: "Записатися можна лише на тиждень уперед.",
  taken: "Цей час щойно зайняли. Оберіть інший початок.",
  limit: `У вас уже ${MAX_ACTIVE} записи. Скасуйте один або дочекайтеся, поки він закінчиться.`,
  profile: "Спершу вкажіть кімнату в профілі.",
  machine: "Цієї пралки немає або вона зараз не працює.",
};

/** Checks a requested booking against everything that needs no database. */
export function validateRequest(
  req: { date: string; startMin: number; duration: number },
  now: { date: string; minute: number },
): BookingError | null {
  if (!isDuration(req.duration)) return "duration";
  if (!Number.isInteger(req.startMin) || req.startMin % STEP_MIN !== 0)
    return "grid";
  if (req.startMin < OPEN_MIN || req.startMin + req.duration > CLOSE_MIN)
    return "hours";
  const ahead = daysBetween(now.date, req.date);
  if (
    ahead < 0 ||
    (ahead === 0 && req.startMin < ceilToStep(now.minute) - STEP_MIN)
  )
    return "past";
  if (ahead >= HORIZON_DAYS) return "horizon";
  return null;
}

/** The days a person can book, starting today. */
export function bookableDays(today: string): string[] {
  return Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(today, i));
}

export type MachineNow =
  | { kind: "busy"; until: number; bookingIndex: number }
  | { kind: "free"; until: number | null }
  | { kind: "closed" };

/** What a machine is doing at `nowMin` today. */
export function machineNow(
  bookings: readonly Slot[],
  nowMin: number,
): MachineNow {
  if (nowMin < OPEN_MIN || nowMin >= CLOSE_MIN) return { kind: "closed" };
  const sorted = [...bookings].sort((a, b) => a.startMin - b.startMin);
  const idx = sorted.findIndex(
    (b) => b.startMin <= nowMin && nowMin < b.endMin,
  );
  if (idx >= 0)
    return {
      kind: "busy",
      until: sorted[idx].endMin,
      bookingIndex: bookings.indexOf(sorted[idx]),
    };
  const next = sorted.find((b) => b.startMin > nowMin);
  return { kind: "free", until: next ? next.startMin : null };
}

/** Free windows a person could start in, for the machine-day view. */
export function freeWindows(
  bookings: readonly Slot[],
  nowMin: number | null,
): Slot[] {
  const sorted = [...bookings].sort((a, b) => a.startMin - b.startMin);
  const windows: Slot[] = [];
  let cursor = Math.max(OPEN_MIN, nowMin === null ? 0 : ceilToStep(nowMin));
  for (const b of sorted) {
    const end = b.startMin - BUFFER_MIN;
    if (end - cursor >= DURATIONS[0])
      windows.push({ startMin: cursor, endMin: end });
    cursor = Math.max(cursor, b.endMin + BUFFER_MIN);
  }
  if (CLOSE_MIN - cursor >= DURATIONS[0])
    windows.push({ startMin: cursor, endMin: CLOSE_MIN });
  return windows;
}

/** "через 4 год 20 хв", "через 5 хв", "зараз". */
export function countdown(fromMs: number, toMs: number): string {
  const minutes = Math.round((toMs - fromMs) / 60_000);
  if (minutes <= 0) return "зараз";
  if (minutes < 60) return `через ${minutes} хв`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `через ${d} ${d === 1 ? "день" : d < 5 ? "дні" : "днів"}`;
  }
  return m ? `через ${h} год ${m} хв` : `через ${h} год`;
}
