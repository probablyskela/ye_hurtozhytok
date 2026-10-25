import { Link } from "react-router";

import { Icon, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { MAX_ACTIVE, durationLabel, fmtMin } from "~/lib/booking";
import { upcomingFor } from "~/lib/bookings.server";
import { dayName, kyivNow } from "~/lib/time";
import type { Route } from "./+types/bookings";

export const handle = { tab: "bookings" };
export const meta: Route.MetaFunction = () => [
  { title: "Мої записи · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const now = kyivNow();
  const list = await upcomingFor(env, resident.id, now);
  return {
    today: now.date,
    list: list.map((b) => ({
      id: b.id,
      date: b.date,
      startMin: b.startMin,
      endMin: b.endMin,
      machine: b.machineName,
      running: b.date === now.date && b.startMin <= now.minute,
    })),
  };
}

export default function Bookings({ loaderData }: Route.ComponentProps) {
  const { list, today } = loaderData;
  return (
    <>
      <TopBar back="/" title="Мої записи" />
      {list.length ? (
        <div className="glass" style={{ padding: "4px 0" }}>
          {list.map((b) => (
            <Link
              viewTransition
              className="list-row"
              to={`/bookings/${b.id}`}
              key={b.id}
            >
              <span
                className="who-av"
                style={
                  b.running
                    ? { background: "var(--mine)", color: "#fff" }
                    : { background: "var(--mine-soft)", color: "var(--mine)" }
                }
              >
                <Icon name="clock" small />
              </span>
              <span style={{ flex: 1 }}>
                <b>
                  {dayName(b.date, today)} · {fmtMin(b.startMin)}–
                  {fmtMin(b.endMin)}
                </b>
                <span className="sub">
                  {b.machine} ·{" "}
                  {b.running
                    ? "зараз ваш час"
                    : durationLabel(b.endMin - b.startMin)}
                </span>
              </span>
              <Icon name="chev" small />
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass empty">
          <b>Записів немає</b>
          Тут будуть ваші записи, поки вони не закінчаться.
        </div>
      )}
      <p className="muted" style={{ margin: "14px 4px", fontSize: 13.5 }}>
        Одночасно можна мати до {MAX_ACTIVE} записів.
      </p>
      <Link className="btn btn-primary block" to="/book">
        <Icon name="plus" />
        Записатися
      </Link>
    </>
  );
}
