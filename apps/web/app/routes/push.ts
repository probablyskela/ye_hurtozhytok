import { data } from "react-router";

import { requireResident } from "~/lib/auth.server";
import {
  deleteSubscription,
  isSubscription,
  saveSubscription,
} from "~/lib/push.server";
import type { Route } from "./+types/push";

/** JSON endpoint for the reminder switch: subscribe or unsubscribe this device. */
export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const resident = await requireResident(request, env);
  const body = (await request.json().catch(() => null)) as {
    op?: string;
    subscription?: unknown;
    endpoint?: string;
  } | null;
  if (body?.op === "subscribe" && isSubscription(body.subscription)) {
    await saveSubscription(env, resident.id, body.subscription);
    return data({ ok: true });
  }
  if (body?.op === "unsubscribe" && typeof body.endpoint === "string") {
    await deleteSubscription(env, resident.id, body.endpoint);
    return data({ ok: true });
  }
  return data({ ok: false }, { status: 400 });
}
