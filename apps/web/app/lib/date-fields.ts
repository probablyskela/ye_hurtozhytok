/**
 * Dates and times come from the app's own pickers (day tiles, a time grid)
 * instead of browser date/time inputs, which follow the browser's locale and
 * can show AM/PM or month-first dates. Each picker posts one value.
 */

export const MINUTE_STEP = 5;

type Read<T> =
  { value: T | null; error?: undefined } | { error: string; value?: undefined };

const pad = (n: number) => String(n).padStart(2, "0");

function part(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Reads a "YYYY-MM-DD" date; empty means no date. */
export function readDate(form: FormData, name: string): Read<string> {
  const v = part(form, name);
  if (!v) return { value: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return { error: "Такої дати не існує." };
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return { error: "Такої дати не існує." };
  return { value: `${year}-${pad(month)}-${pad(day)}` };
}

/** Reads minutes from midnight on the 5-minute grid; empty means no time. */
export function readTime(form: FormData, name: string): Read<number> {
  const v = part(form, name);
  if (!v) return { value: null };
  const minutes = Number(v);
  if (
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes >= 24 * 60 ||
    minutes % MINUTE_STEP !== 0
  )
    return { error: "Такого часу не існує." };
  return { value: minutes };
}
