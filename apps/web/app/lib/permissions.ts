import type { Role } from "./db/schema";

export type Actor = { id: number; roles: readonly Role[]; blocked?: boolean };

/** Members and the head of the student council. */
export function isCouncil(actor: { roles: readonly Role[] }): boolean {
  return (
    actor.roles.includes("council") || actor.roles.includes("council_head")
  );
}

export function isSiteManager(actor: { roles: readonly Role[] }): boolean {
  return actor.roles.includes("site_manager");
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

/** The council blocks people, but never itself or another council member. */
export function canBlock(
  actor: Actor,
  target: { id: number; roles: readonly Role[] },
): boolean {
  return isCouncil(actor) && target.id !== actor.id && !isCouncil(target);
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
