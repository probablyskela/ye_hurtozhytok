import { asc, eq, sql } from "drizzle-orm";

import { activity, getDb } from "./db";
import { residents, type Resident } from "./db/schema";
import { canBlock, type Actor } from "./permissions";
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
  return getDb(env)
    .select({
      id: residents.id,
      name: residents.name,
      email: residents.email,
      room: residents.room,
      telegram: residents.telegram,
      role: residents.role,
      blocked: residents.blocked,
    })
    .from(residents)
    .orderBy(asc(residents.room), asc(residents.name))
    .all();
}

/** Blocking also ends the person's open sessions. */
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
  if (!target || !canBlock(actor, target)) return false;
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
  await activity(db, {
    actorId: actor.id,
    action: blocked ? "resident.blocked" : "resident.unblocked",
    entity: "resident",
    entityId: targetId,
  });
  return true;
}
