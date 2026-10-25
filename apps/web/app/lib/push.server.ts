import { eq, inArray } from "drizzle-orm";

import { getDb } from "./db";
import { pushSubscriptions } from "./db/schema";
import { sendPush, type Subscription } from "./webpush";

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

export function isSubscription(value: unknown): value is Subscription {
  const v = value as Partial<Subscription> | null;
  return (
    !!v &&
    typeof v.endpoint === "string" &&
    v.endpoint.startsWith("https://") &&
    typeof v.p256dh === "string" &&
    typeof v.auth === "string"
  );
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
      set: { residentId, p256dh: sub.p256dh, auth: sub.auth },
    });
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
