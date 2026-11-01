import { and, asc, eq, gt, or, sql } from "drizzle-orm";

import { activity, getDb } from "./db";
import { bookings, residents, roleGrants, type Resident } from "./db/schema";
import { kyivNow } from "./time";
import { canBlock, type Actor } from "./permissions";
import { sortRoles } from "./roles";
import { rolesFor } from "./roles.server";
import { PROFILE_ERRORS, normalizeRoom, normalizeTelegram } from "./profile";

export type ProfileResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<"room" | "telegram", string>> };

export async function saveProfile(
  env: Env,
  resident: Resident,
  form: FormData,
): Promise<ProfileResult> {
  const room = normalizeRoom(form.get("room"));
  const telegram = normalizeTelegram(form.get("telegram"));
  const errors: Partial<Record<"room" | "telegram", string>> = {};
  if (!room) errors.room = PROFILE_ERRORS.room;
  if (telegram === null) errors.telegram = PROFILE_ERRORS.telegram;
  if (Object.keys(errors).length) return { ok: false, errors };
  const db = getDb(env);
  await db
    .update(residents)
    .set({ room, telegram: telegram || null, updatedAt: Date.now() })
    .where(eq(residents.id, resident.id));
  await activity(db, {
    actorId: resident.id,
    action: "resident.profile",
    entity: "resident",
    entityId: resident.id,
    details: { room, telegram: telegram || null },
  });
  return { ok: true };
}

export async function listResidents(env: Env) {
  const db = getDb(env);
  const [people, grants] = await Promise.all([
    db
      .select({
        id: residents.id,
        name: residents.name,
        firstName: residents.firstName,
        lastName: residents.lastName,
        patronymic: residents.patronymic,
        email: residents.email,
        room: residents.room,
        telegram: residents.telegram,
        blocked: residents.blocked,
      })
      .from(residents)
      .orderBy(
        asc(residents.room),
        asc(residents.lastName),
        asc(residents.name),
      )
      .all(),
    db
      .select({ email: roleGrants.email, role: roleGrants.role })
      .from(roleGrants)
      .all(),
  ]);
  return people.map((p) => ({
    ...p,
    roles: sortRoles(
      grants
        .filter((g) => g.email === p.email.toLowerCase())
        .map((g) => g.role),
    ),
  }));
}

/** Blocking also ends the person's open sessions and cancels bookings that have not started. */
export async function setBlocked(
  env: Env,
  actor: Actor,
  targetId: number,
  blocked: boolean,
) {
  const db = getDb(env);
  const target = await db
    .select()
    .from(residents)
    .where(eq(residents.id, targetId))
    .get();
  if (
    !target ||
    !canBlock(actor, {
      id: target.id,
      roles: await rolesFor(env, target.email),
    })
  )
    return false;
  await db
    .update(residents)
    .set({
      blocked,
      sessionVersion: blocked
        ? sql`${residents.sessionVersion} + 1`
        : target.sessionVersion,
      updatedAt: Date.now(),
    })
    .where(eq(residents.id, targetId));
  let cancelled: number[] = [];
  if (blocked) {
    const now = kyivNow();
    const rows = await db
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledAt: Date.now(),
        cancelledBy: actor.id,
      })
      .where(
        and(
          eq(bookings.residentId, targetId),
          eq(bookings.status, "active"),
          or(
            gt(bookings.date, now.date),
            and(eq(bookings.date, now.date), gt(bookings.startMin, now.minute)),
          ),
        ),
      )
      .returning({ id: bookings.id });
    cancelled = rows.map((r) => r.id);
  }
  await activity(db, {
    actorId: actor.id,
    action: blocked ? "resident.blocked" : "resident.unblocked",
    entity: "resident",
    entityId: targetId,
    details: cancelled.length ? { cancelledBookings: cancelled } : undefined,
  });
  return true;
}
