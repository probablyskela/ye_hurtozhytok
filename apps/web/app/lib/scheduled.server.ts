import { eq, inArray } from "drizzle-orm";

import { fmtMin } from "./booking";
import { dueReminders } from "./bookings.server";
import { getDb } from "./db";
import { bookings } from "./db/schema";
import { notify, pushEnabled } from "./push.server";
import { addDays, kyivDateKey, kyivMinuteToUtc } from "./time";

export const REMIND_BEFORE_MS = 15 * 60_000;

/** Runs every minute: reminds people 15 minutes before their booking starts. */
export async function runEveryMinute(env: Env, scheduledTime: number) {
  if (!pushEnabled(env)) return;
  const today = kyivDateKey(scheduledTime);
  const rows = await dueReminders(env, [today, addDays(today, 1)]);
  const due = rows.filter((b) => {
    if (b.remindedAt !== null) return false;
    const start = kyivMinuteToUtc(b.date, b.startMin);
    return start > scheduledTime && start - scheduledTime <= REMIND_BEFORE_MS;
  });
  if (due.length === 0) return;

  // Mark first so a slow push never sends the same reminder twice.
  await getDb(env)
    .update(bookings)
    .set({ remindedAt: scheduledTime })
    .where(
      inArray(
        bookings.id,
        due.map((b) => b.id),
      ),
    );

  for (const b of due) {
    await notify(env, [b.residentId], {
      title: `Прання о ${fmtMin(b.startMin)}`,
      body: `${b.machineName}, ${fmtMin(b.startMin)}–${fmtMin(b.endMin)}. Якщо не прийдете за 15 хвилин, пралку може взяти інший.`,
      url: `/bookings/${b.id}`,
    });
  }
}

export async function notifyCancelledByCouncil(env: Env, bookingId: number) {
  const b = await getDb(env)
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .get();
  if (!b) return;
  await notify(env, [b.residentId], {
    title: "Студрада скасувала ваш запис",
    body: `${fmtMin(b.startMin)}–${fmtMin(b.endMin)}. Оберіть інший час.`,
    url: "/book",
  });
}
