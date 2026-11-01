import { requireResident } from "~/lib/auth.server";
import { mediaFor } from "~/lib/announcements.server";
import type { Route } from "./+types/media";

/** Pictures are served only to people who may see their announcement. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireResident(request, env);
  const key = params["*"] ?? "";
  const found = key ? await mediaFor(env, me, key) : null;
  if (!found) return new Response("Не знайдено", { status: 404 });
  return new Response(found.object.body, {
    headers: {
      "Content-Type": found.contentType,
      // A picture is only ever a picture: no type guessing, nothing runs in
      // it even when opened on its own, shown inline.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
      "Cross-Origin-Resource-Policy": "same-origin",
      // Keys never change; private so shared caches never keep them.
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: found.object.httpEtag,
    },
  });
}
