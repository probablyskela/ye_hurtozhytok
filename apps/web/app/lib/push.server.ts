import { desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "./db";
import { pushOutbox, pushSubscriptions } from "./db/schema";
import { sendPush, type Subscription } from "./webpush";

export { isSubscription } from "./webpush";

/** Devices per person that get reminders; older ones are dropped. */
export const MAX_DEVICES = 5;

export function pushEnabled(env: Env): boolean {
  return !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;
}

function vapid(env: Env) {
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY!,
    subject: env.VAPID_SUBJECT || env.APP_URL,
  };
}

export async function saveSubscription(
  env: Env,
  residentId: number,
  sub: Subscription,
) {
  await getDb(env)
    .insert(pushSubscriptions)
    .values({ residentId, ...sub, createdAt: Date.now() })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      // A device that subscribes again counts as the newest one.
      set: {
        residentId,
        p256dh: sub.p256dh,
        auth: sub.auth,
        createdAt: Date.now(),
      },
    });
  const db = getDb(env);
  const mine = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.residentId, residentId))
    .orderBy(desc(pushSubscriptions.createdAt))
    .all();
  const extra = mine.slice(MAX_DEVICES).map((r) => r.id);
  if (extra.length)
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, extra));
}

export async function deleteSubscription(
  env: Env,
  residentId: number,
  endpoint: string,
) {
  const db = getDb(env);
  const row = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .get();
  if (row && row.residentId === residentId)
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
}

export async function hasSubscription(
  env: Env,
  residentId: number,
): Promise<boolean> {
  const row = await getDb(env)
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.residentId, residentId))
    .get();
  return !!row;
}

/** Sends to every device of each person; drops subscriptions the push service has forgotten. */
export async function notify(
  env: Env,
  residentIds: number[],
  message: { title: string; body: string; url: string },
): Promise<number> {
  if (!pushEnabled(env) || residentIds.length === 0) return 0;
  const db = getDb(env);
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.residentId, residentIds))
    .all();
  let sent = 0;
  const gone: number[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await sendPush(s, message, vapid(env));
        if (r === "sent") sent++;
        if (r === "gone") gone.push(s.id);
      } catch (error) {
        console.error("push error", error);
      }
    }),
  );
  if (gone.length)
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, gone));
  return sent;
}

/**
 * Devices notified per run of the queue. The free Workers plan allows 50
 * outgoing requests per invocation; 40 leaves room for the rest of the cron.
 */
export const OUTBOX_BATCH = 40;
/** A claimed row older than this is taken again (its run must have died). */
const STALE_CLAIM_MS = 10 * 60_000;

/** Queues one message for every subscribed device, except those of `exceptResidentId`. */
export async function enqueueBroadcast(
  env: Env,
  message: { title: string; body: string; url: string },
  exceptResidentId?: number,
): Promise<void> {
  if (!pushEnabled(env)) return;
  await getDb(env).run(sql`
    INSERT INTO ${pushOutbox} (subscription_id, title, body, url, created_at)
    SELECT id, ${message.title}, ${message.body}, ${message.url}, ${Date.now()}
    FROM ${pushSubscriptions}
    WHERE resident_id != ${exceptResidentId ?? -1}`);
}

/**
 * Sends the next batch from the queue. Rows are claimed with one UPDATE …
 * RETURNING first, so two overlapping runs never send the same message twice.
 */
export async function drainOutbox(env: Env, now = Date.now()): Promise<number> {
  if (!pushEnabled(env)) return 0;
  const db = getDb(env);
  const claimed = await db.all<{
    id: number;
    subscription_id: number;
    title: string;
    body: string;
    url: string;
  }>(sql`
    UPDATE ${pushOutbox} SET claimed_at = ${now}
    WHERE id IN (
      SELECT id FROM ${pushOutbox}
      WHERE claimed_at IS NULL OR claimed_at < ${now - STALE_CLAIM_MS}
      ORDER BY id LIMIT ${OUTBOX_BATCH}
    )
    RETURNING id, subscription_id, title, body, url`);
  if (claimed.length === 0) return 0;
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(
      inArray(pushSubscriptions.id, [
        ...new Set(claimed.map((c) => c.subscription_id)),
      ]),
    )
    .all();
  const byId = new Map(subs.map((s) => [s.id, s]));
  let sent = 0;
  const gone: number[] = [];
  await Promise.all(
    claimed.map(async (c) => {
      const sub = byId.get(c.subscription_id);
      if (!sub) return;
      try {
        const r = await sendPush(
          sub,
          { title: c.title, body: c.body, url: c.url },
          vapid(env),
        );
        if (r === "sent") sent++;
        if (r === "gone") gone.push(sub.id);
      } catch (error) {
        console.error("push error", error);
      }
    }),
  );
  await db.delete(pushOutbox).where(
    inArray(
      pushOutbox.id,
      claimed.map((c) => c.id),
    ),
  );
  if (gone.length)
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, gone));
  return sent;
}
