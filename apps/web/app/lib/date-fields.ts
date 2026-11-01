/**
 * Dates come from the app's own day tiles; time comes from the phone's own
 * time picker (<input type="time">), which posts "HH:MM" in 24 hours
 * whatever the display. Each picker posts one value.
 */

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

/** Reads "HH:MM" as minutes from midnight; empty means no time. */
export function readTime(form: FormData, name: string): Read<number> {
  const v = part(form, name);
  if (!v) return { value: null };
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(v);
  if (!m) return { error: "Такого часу не існує." };
  const [hours, minutes] = [Number(m[1]), Number(m[2])];
  if (hours > 23 || minutes > 59) return { error: "Такого часу не існує." };
  return { value: hours * 60 + minutes };
}
