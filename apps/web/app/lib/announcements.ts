import { readDate, readTime } from "./date-fields";
import { dayHeading, daysBetween } from "./time";

export const TITLE_MAX = 140;
export const BODY_MAX = 2000;
export const PLACE_MAX = 80;
export const REASON_MAX = 300;
/** Pictures per announcement; the first is the cover in the feed. */
export const MAX_IMAGES = 6;
/** Per picture, after the phone has shrunk it (or as is without JavaScript). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Undated news stays «Нове» on the home page this long, then goes to history. */
export const FRESH_DAYS = 14;

export type AnnouncementValues = {
  title: string;
  body: string | null;
  place: string | null;
  date: string | null;
  startMin: number | null;
};

export type AnnouncementErrors = Partial<
  Record<"title" | "body" | "place" | "date" | "time" | "images", string>
>;

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
}

/** Validates the form; a past date is refused only for new announcements. */
export function parseAnnouncementForm(
  form: FormData,
  today: string,
  { allowPast = false }: { allowPast?: boolean } = {},
):
  | { ok: true; values: AnnouncementValues }
  | { ok: false; errors: AnnouncementErrors } {
  const errors: AnnouncementErrors = {};
  const title = text(form, "title").replace(/\s+/g, " ");
  const body = text(form, "body");
  const place = text(form, "place").replace(/\s+/g, " ");
  const date = readDate(form, "date");
  const time = readTime(form, "time");

  if (title.length < 3) errors.title = "Напишіть, про що оголошення.";
  else if (title.length > TITLE_MAX)
    errors.title = `Назва до ${TITLE_MAX} символів; подробиці — нижче.`;
  if (body.length > BODY_MAX)
    errors.body = `Подробиці до ${BODY_MAX} символів.`;
  if (place.length > PLACE_MAX)
    errors.place = `Місце до ${PLACE_MAX} символів.`;
  if (date.error !== undefined) errors.date = date.error;
  else if (date.value && !allowPast && date.value < today)
    errors.date = "Ця дата вже минула.";
  if (time.error !== undefined) errors.time = time.error;
  else if (time.value !== null && !date.value && !errors.date)
    errors.time = "Якщо вказуєте час, вкажіть і дату.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    values: {
      title,
      body: body || null,
      place: place || null,
      date: date.value ?? null,
      startMin: date.value ? (time.value ?? null) : null,
    },
  };
}

export function isImageType(type: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

const pad = (n: number) => String(n).padStart(2, "0");
export const fmtTime = (min: number) =>
  `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** "Завтра, неділя · 19:00", "Вівторок, 4 листопада" or null without a date. */
export function whenLabel(
  date: string | null,
  startMin: number | null,
  today: string,
): string | null {
  if (!date) return null;
  const day = dayHeading(date, today);
  return startMin === null ? day : `${day} · ${fmtTime(startMin)}`;
}

type Feedable = {
  id: number;
  important: boolean;
  date: string | null;
  startMin: number | null;
  publishedAt: number | null;
};

/**
 * Splits published announcements for the home page:
 * - important: flagged and not over yet (dated ones until their day ends,
 *   undated ones while fresh);
 * - upcoming: other dated ones from today on, soonest first;
 * - fresh: other undated ones published in the last FRESH_DAYS;
 * - history: the rest, newest first.
 */
export function feedSections<T extends Feedable>(
  list: readonly T[],
  today: string,
  nowMs: number,
) {
  const freshFrom = nowMs - FRESH_DAYS * 86_400_000;
  const current = (a: T) =>
    a.date ? a.date >= today : (a.publishedAt ?? 0) >= freshFrom;
  const byWhen = (a: T, b: T) =>
    (a.date ?? "").localeCompare(b.date ?? "") ||
    (a.startMin ?? 1440) - (b.startMin ?? 1440);
  const newest = (a: T, b: T) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0);

  const important = list.filter((a) => a.important && current(a));
  const rest = list.filter((a) => !important.includes(a));
  return {
    important: [...important].sort((a, b) =>
      a.date && b.date ? byWhen(a, b) : newest(a, b),
    ),
    upcoming: rest.filter((a) => a.date && a.date >= today).sort(byWhen),
    fresh: rest.filter((a) => !a.date && current(a)).sort(newest),
    history: rest.filter((a) => !current(a)).sort(newest),
  };
}

/** "сьогодні", "вчора", "3 дні тому" — for when something was published. */
export function agoLabel(dateKey: string, today: string): string {
  const days = daysBetween(dateKey, today);
  if (days <= 0) return "сьогодні";
  if (days === 1) return "вчора";
  const n = days % 10;
  const teen = days % 100 >= 11 && days % 100 <= 14;
  const word =
    !teen && n === 1 ? "день" : !teen && n >= 2 && n <= 4 ? "дні" : "днів";
  return `${days} ${word} тому`;
}
