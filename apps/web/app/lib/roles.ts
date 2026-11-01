import { ROLES, type Role } from "./db/schema";

export { ROLES, type Role };

/** How a role is named in the interface. Without a role everyone is a resident. */
export const ROLE_LABELS: Record<Role, string> = {
  council: "Студрада",
  council_head: "Голова студради",
  squad: "Оперзагін",
  squad_head: "Голова оперзагону",
  site_manager: "Розпорядник",
};

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/** Trims and lower-cases; returns null unless it is an @lpnu.ua address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@lpnu\.ua$/.test(email) ? email : null;
}

/** Roles in a stable order, for chips and lists. */
export function sortRoles(roles: readonly Role[]): Role[] {
  return [...new Set(roles)].sort(
    (a, b) => ROLES.indexOf(a) - ROLES.indexOf(b),
  );
}
