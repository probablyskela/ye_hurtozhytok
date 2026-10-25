import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";

import {
  BUFFER_MIN,
  MAX_ACTIVE,
  ceilToStep,
  validateRequest,
  type BookingError,
} from "./booking";
import { activity, getDb } from "./db";
import { bookings, machines, residents, type Machine } from "./db/schema";
import { canCancel, canRelease, isCouncil, type Actor } from "./permissions";

export type BookingRow = {
  id: number;
  machineId: number;
  residentId: number;
  date: string;
  startMin: number;
  endMin: number;
  name: string;
  room: string | null;
  telegram: string | null;
};

export async function listMachines(env: Env): Promise<Machine[]> {
  return getDb(env)
    .select()
    .from(machines)
    .orderBy(asc(machines.position))
    .all();
}

const rowFields = {
  id: bookings.id,
  machineId: bookings.machineId,
  residentId: bookings.residentId,
  date: bookings.date,
  startMin: bookings.startMin,
  endMin: bookings.endMin,
  name: residents.name,
  room: residents.room,
  telegram: residents.telegram,
};

/** Active bookings on the given dates for every machine, with who booked them. */
export async function bookingsOn(
  env: Env,
  dates: string[],
): Promise<BookingRow[]> {
  return getDb(env)
    .select(rowFields)
    .from(bookings)
    .innerJoin(residents, eq(residents.id, bookings.residentId))
    .where(and(inArray(bookings.date, dates), eq(bookings.status, "active")))
    .orderBy(asc(bookings.date), asc(bookings.startMin))
    .all();
}

/** A person's bookings that have not ended yet, soonest first. */
export async function upcomingFor(
  env: Env,
  residentId: number,
  now: { date: string; minute: number },
): Promise<(BookingRow & { machineName: string; machineSlug: string })[]> {
  return getDb(env)
    .select({
      ...rowFields,
      machineName: machines.name,
      machineSlug: machines.slug,
    })
    .from(bookings)
    .innerJoin(residents, eq(residents.id, bookings.residentId))
    .innerJoin(machines, eq(machines.id, bookings.machineId))
    .where(
      and(
        eq(bookings.residentId, residentId),
        eq(bookings.status, "active"),
        or(
          gt(bookings.date, now.date),
          and(eq(bookings.date, now.date), gt(bookings.endMin, now.minute)),
        ),
      ),
    )
    .orderBy(asc(bookings.date), asc(bookings.startMin))
    .all();
}

export async function bookingById(env: Env, id: number) {
  return getDb(env)
    .select({
      ...rowFields,
      status: bookings.status,
      machineName: machines.name,
      machineSlug: machines.slug,
    })
    .from(bookings)
    .innerJoin(residents, eq(residents.id, bookings.residentId))
    .innerJoin(machines, eq(machines.id, bookings.machineId))
    .where(eq(bookings.id, id))
    .get();
}

export type CreateResult =
  { ok: true; id: number } | { ok: false; error: BookingError };

/**
 * Checks the buffer, the per-person limit, the machine and that the person may
 * book (room filled in, not blocked) in the same statement as the insert, so
 * two people can never take the same time.
 */
export async function createBooking(
  env: Env,
  input: {
    residentId: number;
    machineId: number;
    date: string;
    startMin: number;
    duration: number;
    now: { date: string; minute: number };
  },
): Promise<CreateResult> {
  if (!Number.isInteger(input.machineId) || input.machineId <= 0)
    return { ok: false, error: "machine" };
  const invalid = validateRequest(input, input.now);
  if (invalid) return { ok: false, error: invalid };
  const endMin = input.startMin + input.duration;

  const inserted = await env.DB.prepare(
    `INSERT INTO bookings (machine_id, resident_id, date, start_min, end_min, status, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, 'active', ?6
     WHERE EXISTS (SELECT 1 FROM machines WHERE id = ?1 AND status = 'working')
       AND EXISTS (
         SELECT 1 FROM residents
         WHERE id = ?2 AND blocked = 0 AND room IS NOT NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE machine_id = ?1 AND date = ?3 AND status = 'active'
           AND start_min < ?5 + ?7 AND end_min + ?7 > ?4
       )
       AND (
         SELECT count(*) FROM bookings
         WHERE resident_id = ?2 AND status = 'active'
           AND (date > ?8 OR (date = ?8 AND end_min > ?9))
       ) < ?10
     RETURNING id`,
  )
    .bind(
      input.machineId,
      input.residentId,
      input.date,
      input.startMin,
      endMin,
      Date.now(),
      BUFFER_MIN,
      input.now.date,
      input.now.minute,
      MAX_ACTIVE,
    )
    .first<{ id: number }>();

  if (inserted) {
    await activity(getDb(env), {
      actorId: input.residentId,
      action: "booking.created",
      entity: "booking",
      entityId: inserted.id,
      details: {
        machineId: input.machineId,
        date: input.date,
        startMin: input.startMin,
        endMin,
      },
    });
    return { ok: true, id: inserted.id };
  }
  return { ok: false, error: await whyRejected(env, input) };
}

async function whyRejected(
  env: Env,
  input: {
    residentId: number;
    machineId: number;
    now: { date: string; minute: number };
  },
): Promise<BookingError> {
  const db = getDb(env);
  const resident = await db
    .select({ blocked: residents.blocked, room: residents.room })
    .from(residents)
    .where(eq(residents.id, input.residentId))
    .get();
  if (!resident || resident.blocked) return "blocked";
  if (!resident.room) return "profile";
  const machine = await db
    .select()
    .from(machines)
    .where(eq(machines.id, input.machineId))
    .get();
  if (!machine || machine.status !== "working") return "machine";
  const active = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.residentId, input.residentId),
        eq(bookings.status, "active"),
        or(
          gt(bookings.date, input.now.date),
          and(
            eq(bookings.date, input.now.date),
            gt(bookings.endMin, input.now.minute),
          ),
        ),
      ),
    )
    .all();
  return active.length >= MAX_ACTIVE ? "limit" : "taken";
}

export async function cancelBooking(
  env: Env,
  actor: Actor,
  id: number,
  now: { date: string; minute: number },
  opts: { evenIfStarted?: boolean } = {},
): Promise<boolean> {
  const db = getDb(env);
  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .get();
  if (!booking || booking.status !== "active" || !canCancel(actor, booking))
    return false;
  const ended =
    booking.date < now.date ||
    (booking.date === now.date && booking.endMin <= now.minute);
  if (ended) return false;
  // Once washing has started, the owner frees the machine instead (the council still may cancel).
  const started =
    booking.date < now.date ||
    (booking.date === now.date && booking.startMin <= now.minute);
  if (
    started &&
    !opts.evenIfStarted &&
    booking.residentId === actor.id &&
    !isCouncil(actor)
  )
    return false;
  // Only the request that actually flips the status logs it.
  const changed = await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelledBy: actor.id,
    })
    .where(and(eq(bookings.id, id), eq(bookings.status, "active")))
    .returning({ id: bookings.id });
  if (changed.length === 0) return false;
  await activity(db, {
    actorId: actor.id,
    action: "booking.cancelled",
    entity: "booking",
    entityId: id,
    details:
      booking.residentId === actor.id
        ? undefined
        : { residentId: booking.residentId },
  });
  return true;
}

/** Ends a running booking at the next 5-minute mark so the rest becomes free. */
export async function releaseBooking(
  env: Env,
  actor: Actor,
  id: number,
  now: { date: string; minute: number },
): Promise<boolean> {
  const db = getDb(env);
  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .get();
  if (!booking || booking.status !== "active" || !canRelease(actor, booking))
    return false;
  const running =
    booking.date === now.date &&
    booking.startMin <= now.minute &&
    now.minute < booking.endMin;
  if (!running) return false;
  const newEnd = Math.min(ceilToStep(now.minute), booking.endMin);
  if (newEnd <= booking.startMin)
    return cancelBooking(env, actor, id, now, { evenIfStarted: true });
  // Already ends at the next 5-minute mark: nothing to free.
  if (newEnd === booking.endMin) return true;
  const changed = await db
    .update(bookings)
    .set({ endMin: newEnd })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.status, "active"),
        eq(bookings.endMin, booking.endMin),
      ),
    )
    .returning({ id: bookings.id });
  if (changed.length === 0) return false;
  await activity(db, {
    actorId: actor.id,
    action: "booking.released",
    entity: "booking",
    entityId: id,
    details: { from: booking.endMin, to: newEnd },
  });
  return true;
}

/** Active bookings on the given dates that have not been reminded yet. */
export async function dueReminders(env: Env, dates: string[]) {
  return getDb(env)
    .select({
      id: bookings.id,
      residentId: bookings.residentId,
      date: bookings.date,
      startMin: bookings.startMin,
      endMin: bookings.endMin,
      createdAt: bookings.createdAt,
      machineName: machines.name,
    })
    .from(bookings)
    .innerJoin(machines, eq(machines.id, bookings.machineId))
    .where(
      and(
        inArray(bookings.date, dates),
        eq(bookings.status, "active"),
        isNull(bookings.remindedAt),
      ),
    )
    .all();
}
