/**
 * People's names are stored in parts. The Polytechnic directory sends
 * «Прізвище Імʼя По батькові»; others see «Імʼя Прізвище», the council sees
 * the full name.
 */

export type PersonName = {
  firstName: string;
  lastName: string;
  patronymic: string | null;
};

const PATRONYMIC = /(ович|евич|євич|йович|івна|ївна|овна)$/i;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function parseName(input: {
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  email?: string | null;
}): PersonName {
  const parts = (input.name ?? "").trim().split(/\s+/).filter(Boolean);
  // «Полупан Софія Андріївна»
  if (parts.length === 3 && PATRONYMIC.test(parts[2]))
    return { lastName: parts[0], firstName: parts[1], patronymic: parts[2] };
  // Google's own split, where «Софія Андріївна» may come as the given name.
  const given = (input.givenName ?? "").trim().split(/\s+/).filter(Boolean);
  const family = (input.familyName ?? "").trim();
  if (given.length && family)
    return {
      firstName: given[0],
      lastName: family,
      patronymic: given[1] && PATRONYMIC.test(given[1]) ? given[1] : null,
    };
  if (parts.length >= 2)
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
      patronymic: null,
    };
  if (parts.length === 1)
    return { firstName: parts[0], lastName: "", patronymic: null };
  // Last resort: «taras.melnyk.shi.2024@lpnu.ua».
  const [first = "", last = ""] = (input.email ?? "").split("@")[0].split(".");
  return {
    firstName: cap(first) || "Мешканець",
    lastName: cap(last),
    patronymic: null,
  };
}

/** «Софія Полупан»: how residents see each other. */
export function shortName(p: PersonName): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

/** «Полупан Софія Андріївна»: for the council. */
export function fullName(p: PersonName): string {
  return [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" ");
}
