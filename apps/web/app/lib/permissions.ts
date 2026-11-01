import type { Role } from "./db/schema";

export type Actor = { id: number; roles: readonly Role[]; blocked?: boolean };

/** The site manager can do everything every role can, plus manage roles. */
export function isSiteManager(actor: { roles: readonly Role[] }): boolean {
  return actor.roles.includes("site_manager");
}

/** Has the student council's rights: members, the head, the site manager. */
export function isCouncil(actor: { roles: readonly Role[] }): boolean {
  return (
    actor.roles.includes("council") ||
    actor.roles.includes("council_head") ||
    isSiteManager(actor)
  );
}

/** Has the squad's rights: members, the head, the site manager. */
export function isSquad(actor: { roles: readonly Role[] }): boolean {
  return (
    actor.roles.includes("squad") ||
    actor.roles.includes("squad_head") ||
    isSiteManager(actor)
  );
}

/** Anyone signed in, not blocked, with a room in the profile may book. */
export function canBook(actor: Actor & { room: string | null }): boolean {
  return !actor.blocked && !!actor.room;
}

/** Own bookings until they end; the council may cancel anyone's. */
export function canCancel(
  actor: Actor,
  booking: { residentId: number },
): boolean {
  return booking.residentId === actor.id || isCouncil(actor);
}

/** Only the person washing frees the machine early. */
export function canRelease(
  actor: Actor,
  booking: { residentId: number },
): boolean {
  return booking.residentId === actor.id;
}

/** Only the site manager blocks people: anyone but themselves or another site manager. */
export function canBlock(
  actor: Actor,
  target: { id: number; roles: readonly Role[] },
): boolean {
  return (
    isSiteManager(actor) && target.id !== actor.id && !isSiteManager(target)
  );
}

/** Only the site manager hands out and takes away roles. */
export function canManageRoles(actor: Actor): boolean {
  return isSiteManager(actor);
}

/**
 * A site manager may take away any role except their own site-manager role,
 * so the app is never left without someone who manages roles.
 */
export function canRevokeRole(
  actor: Actor & { email: string },
  grant: { email: string; role: Role },
): boolean {
  if (!canManageRoles(actor)) return false;
  return !(
    grant.role === "site_manager" &&
    grant.email.toLowerCase() === actor.email.toLowerCase()
  );
}
