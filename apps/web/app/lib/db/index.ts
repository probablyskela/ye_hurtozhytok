import { drizzle } from "drizzle-orm/d1";

import { activityLog } from "./schema";
import * as schema from "./schema";

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;

export type ActivityAction =
  | "booking.created"
  | "booking.cancelled"
  | "booking.released"
  | "resident.joined"
  | "resident.profile"
  | "resident.blocked"
  | "resident.unblocked"
  | "role.granted"
  | "role.revoked";

export function activity(
  db: Db,
  entry: {
    actorId: number;
    action: ActivityAction;
    entity: "booking" | "resident" | "role_grant";
    entityId: number;
    details?: Record<string, unknown>;
  },
) {
  return db.insert(activityLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    details: entry.details ? JSON.stringify(entry.details) : null,
    createdAt: Date.now(),
  });
}
