import type { Role } from "./db/schema";

export type Actor = { id: number; role: Role; blocked?: boolean };

export function isCouncil(actor: Actor): boolean {
  return actor.role === "council";
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
  target: { id: number; role: Role },
): boolean {
  return (
    isCouncil(actor) && target.id !== actor.id && target.role !== "council"
  );
}
