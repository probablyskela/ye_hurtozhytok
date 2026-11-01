/**
 * Dates and times are entered with plain selects (day, month by name, year;
 * hours and minutes) instead of browser date/time inputs, which follow the
 * browser's locale and can show AM/PM or month-first dates. From Оперета.
 */

export const MINUTE_STEP = 5;

type Read<T> =
  { value: T | null; error?: undefined } | { error: string; value?: undefined };

const pad = (n: number) => String(n).padStart(2, "0");

function part(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Reads `<name>_d`, `<name>_m`, `<name>_y`; all empty means no date. */
export function readDate(form: FormData, name: string): Read<string> {
  const d = part(form, `${name}_d`);
  const m = part(form, `${name}_m`);
  const y = part(form, `${name}_y`);
  if (!d && !m && !y) return { value: null };
  if (!d || !m || !y) return { error: "Вкажіть день, місяць і рік повністю." };
  const [day, month, year] = [Number(d), Number(m), Number(y)];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return { error: "Такої дати не існує." };
  return { value: `${year}-${pad(month)}-${pad(day)}` };
}

/** Reads `<name>_h` and `<name>_min` as minutes from midnight; both empty means no time. */
export function readTime(form: FormData, name: string): Read<number> {
  const h = part(form, `${name}_h`);
  const min = part(form, `${name}_min`);
  if (!h && !min) return { value: null };
  if (!h || !min) return { error: "Вкажіть і години, і хвилини." };
  const [hour, minute] = [Number(h), Number(min)];
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  )
    return { error: "Такого часу не існує." };
  return { value: hour * 60 + minute };
}
