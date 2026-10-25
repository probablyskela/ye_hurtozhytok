import { requireProfile } from "~/lib/auth.server";
import { bookingById } from "~/lib/bookings.server";
import { bookingIcs } from "~/lib/ics";
import { isCouncil } from "~/lib/permissions";
import type { Route } from "./+types/booking-ics";

/** The booking as a calendar file, with a 15-minute alarm. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const b = await bookingById(env, Number(params.id));
  if (!b || (b.residentId !== resident.id && !isCouncil(resident)))
    throw new Response("Такого запису немає.", { status: 404 });
  const origin = new URL(request.url).origin;
  return new Response(
    bookingIcs({
      id: b.id,
      date: b.date,
      startMin: b.startMin,
      endMin: b.endMin,
      machine: b.machineName,
      url: `${origin}/bookings/${b.id}`,
      nowMs: Date.now(),
    }),
    {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="prannya-${b.id}.ics"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
