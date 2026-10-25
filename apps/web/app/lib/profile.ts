/** Room and Telegram fields of the profile. */

export function normalizeRoom(value: unknown): string | null {
  const room = String(value ?? "").trim();
  return /^\d{3}$/.test(room) ? room : null;
}

/** Accepts "name", "@name" or a t.me link; returns the bare username, "" for empty, null if invalid. */
export function normalizeTelegram(value: unknown): string | null {
  let v = String(value ?? "").trim();
  if (!v) return "";
  v = v
    .replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, "")
    .replace(/^@/, "");
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v) ? v : null;
}

export const PROFILE_ERRORS = {
  room: "Вкажіть кімнату трьома цифрами, як на дверях.",
  telegram:
    "Імʼя користувача в Telegram — від 5 до 32 латинських літер, цифр або «_».",
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * Ukrainian vocative for a first name, for greetings: «Олено», «Остапе».
 * Covers the common patterns only; returns null when unsure, so the caller
 * can greet without a name rather than in the wrong case. Latin names stay as they are.
 */
export function vocative(name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  if (!/[а-яіїєґ]/i.test(n)) return n;
  const lower = n.toLowerCase();
  const cut = (k: number, add: string) => n.slice(0, n.length - k) + add;
  if (lower.endsWith("ія")) return cut(1, "є"); // Софія → Софіє
  if (lower.endsWith("ій")) return cut(1, "ю"); // Андрій → Андрію
  if (lower.endsWith("ь")) return cut(1, "ю"); // Василь → Василю
  if (lower.endsWith("ко")) return cut(1, "у"); // Марко → Марку
  if (/[бвгґджзклмнпрстфхцчшщ]а$/.test(lower)) return cut(1, "о"); // Олена → Олено
  if (/[бвдзлмнпрстф]о$/.test(lower)) return cut(1, "е"); // Дмитро → Дмитре
  if (/[бвдзлмнпрстф]$/.test(lower)) return n + "е"; // Остап → Остапе
  return null;
}
