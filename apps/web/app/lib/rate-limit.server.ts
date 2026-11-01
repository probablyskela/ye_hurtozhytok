import { and, eq, gt, sql } from "drizzle-orm";
import { data } from "react-router";

import { getDb } from "./db";
import { activityLog } from "./db/schema";

/** Changes one person may make in 24 hours; ordinary use is a few a day. */
export const MAX_DAILY_ACTIONS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

const TOO_MANY = "Забагато дій поспіль. Зачекайте хвилину й спробуйте ще раз.";
const TOO_MANY_TODAY =
  "Сьогодні ви зробили забагато змін. Спробуйте завтра або напишіть розпоряднику сайту.";

/**
 * Stops one account from scripting changes in a loop and using up the free
 * plan's daily database writes for everyone. Short bursts are cut by the
 * Workers rate limiter (ACTION_LIMIT in wrangler.jsonc), the daily total by
 * the person's own entries in the activity log.
 */
export async function limitActions(env: Env, residentId: number) {
  const burst = await env.ACTION_LIMIT.limit({ key: `resident:${residentId}` });
  if (!burst.success) throw data(TOO_MANY, { status: 429 });
  const today = await getDb(env)
    .select({ n: sql<number>`count(*)` })
    .from(activityLog)
    .where(
      and(
        eq(activityLog.actorId, residentId),
        gt(activityLog.createdAt, Date.now() - DAY_MS),
      ),
    )
    .get();
  if ((today?.n ?? 0) >= MAX_DAILY_ACTIONS)
    throw data(TOO_MANY_TODAY, { status: 429 });
}
