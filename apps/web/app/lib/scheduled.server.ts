import { and, eq, inArray, isNull } from "drizzle-orm";

import { fmtMin, reminderDue } from "./booking";
import { dueReminders } from "./bookings.server";
import { getDb } from "./db";
import { bookings, machines } from "./db/schema";
import { notify, pushEnabled } from "./push.server";
import { addDays, dateLong, kyivDateKey } from "./time";

/** Runs every minute: reminds people 15 minutes before their booking starts. */
export async function runEveryMinute(env: Env, scheduledTime: number) {
  if (!pushEnabled(env)) return;
  const today = kyivDateKey(scheduledTime);
  const rows = await dueReminders(env, [today, addDays(today, 1)]);
  const due = rows.filter((b) => reminderDue(b, scheduledTime));
  if (due.length === 0) return;

  // Claim first: only rows this run marks are sent, so overlapping runs never
  // double up, and a booking cancelled a moment ago is not claimed at all.
  const claimed = await getDb(env)
    .update(bookings)
    .set({ remindedAt: scheduledTime })
    .where(
      and(
        inArray(
          bookings.id,
          due.map((b) => b.id),
        ),
        eq(bookings.status, "active"),
        isNull(bookings.remindedAt),
      ),
    )
    .returning({ id: bookings.id });
  const mine = new Set(claimed.map((c) => c.id));

  for (const b of due.filter((d) => mine.has(d.id))) {
    try {
      await notify(env, [b.residentId], {
        title: `Прання о ${fmtMin(b.startMin)}`,
        body: `${b.machineName}, ${fmtMin(b.startMin)}–${fmtMin(b.endMin)}. Якщо не прийдете за 15 хвилин, пралку може взяти інший.`,
        url: `/bookings/${b.id}`,
      });
    } catch (error) {
      console.error("reminder failed", b.id, error);
    }
  }
}

/** Tells the person that the council cancelled their booking; silent when they cancelled it themselves. */
export async function notifyCancelledByCouncil(env: Env, bookingId: number) {
  const b = await getDb(env)
    .select({
      residentId: bookings.residentId,
      cancelledBy: bookings.cancelledBy,
      date: bookings.date,
      startMin: bookings.startMin,
      endMin: bookings.endMin,
      machineName: machines.name,
    })
    .from(bookings)
    .innerJoin(machines, eq(machines.id, bookings.machineId))
    .where(eq(bookings.id, bookingId))
    .get();
  if (!b || b.cancelledBy === b.residentId) return;
  await notify(env, [b.residentId], {
    title: "Студрада скасувала ваш запис",
    body: `${b.machineName}, ${dateLong(b.date)}, ${fmtMin(b.startMin)}–${fmtMin(b.endMin)}. Оберіть інший час.`,
    url: "/book",
  });
}
