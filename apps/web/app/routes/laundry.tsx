import { Link } from "react-router";

import {
  Credit,
  DayStrip,
  Icon,
  Port,
  StripScale,
  Ticket,
} from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { MAX_ACTIVE, countdown, fmtMin, machineNow } from "~/lib/booking";
import { upcomingFor } from "~/lib/bookings.server";
import { machinesOn } from "~/lib/day.server";
import { initials } from "~/lib/profile";
import { dayHeading, kyivMinuteToUtc, kyivNow } from "~/lib/time";
import { usePolling } from "~/lib/use-polling";
import type { Route } from "./+types/laundry";

export const handle = { tab: "laundry", wide: true };
export const meta: Route.MetaFunction = () => [
  { title: "Пральня · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const nowMs = Date.now();
  const now = kyivNow(nowMs);
  const [today, upcoming] = await Promise.all([
    machinesOn(env, now.date),
    upcomingFor(env, resident.id, now),
  ]);

  const first = upcoming[0];
  return {
    name: resident.name,
    blocked: resident.blocked,
    now,
    full: upcoming.length >= MAX_ACTIVE,
    machines: today.map((m) => {
      const state = machineNow(m.bookings, now.minute);
      return {
        slug: m.slug,
        shortName: m.shortName,
        working: m.working,
        state,
        slots: m.bookings.map((b) => ({
          id: b.id,
          startMin: b.startMin,
          endMin: b.endMin,
        })),
        mine: m.bookings
          .filter((b) => b.residentId === resident.id)
          .map((b) => b.id),
      };
    }),
    next: first
      ? {
          id: first.id,
          heading: dayHeading(first.date, now.date),
          startMin: first.startMin,
          endMin: first.endMin,
          machine: first.machineName,
          running: first.date === now.date && first.startMin <= now.minute,
          countdown: countdown(
            nowMs,
            kyivMinuteToUtc(first.date, first.startMin),
          ),
        }
      : null,
    more: Math.max(0, upcoming.length - 1),
  };
}

function stateText(state: ReturnType<typeof machineNow>, working: boolean) {
  if (!working) return { text: "не працює", free: false };
  if (state.kind === "closed")
    return { text: "зачинено до 06:00", free: false };
  if (state.kind === "busy")
    return { text: `зайнята до ${fmtMin(state.until)}`, free: false };
  return {
    text:
      state.until === null
        ? "вільна до кінця дня"
        : `вільна до ${fmtMin(state.until)}`,
    free: true,
  };
}

export default function Laundry({ loaderData }: Route.ComponentProps) {
  usePolling(20_000);
  const { name, blocked, full, machines, next, more, now } = loaderData;
  return (
    <>
      <div className="topbar">
        <span className="brand">
          <svg className="mark" aria-hidden="true">
            <use href="#logo-facade" />
          </svg>
          <span className="wordmark">єГуртожиток</span>
        </span>
        <Link
          className="avatar"
          to="/me"
          aria-label={`Моє: ${name}`}
          style={{ textDecoration: "none" }}
        >
          {initials(name)}
        </Link>
      </div>
      <h2 className="title" style={{ marginBottom: 16 }}>
        Пральня
      </h2>
      {blocked && (
        <p className="error-note" role="alert">
          Ваш акаунт заблоковано: записуватися зараз не можна.
        </p>
      )}

      <div className="home-grid">
        <section className="area-ticket">
          {next ? (
            <Ticket
              to={`/bookings/${next.id}`}
              heading={next.heading}
              startMin={next.startMin}
              endMin={next.endMin}
              machine={next.machine}
              footLeft={
                next.running ? (
                  <b>Зараз ваш час</b>
                ) : (
                  <>
                    Почнеться <b>{next.countdown}</b>
                  </>
                )
              }
              footRight={<span className="ticket-cta">Деталі</span>}
            />
          ) : (
            <div className="glass empty">
              <b>Записів поки немає</b>
              Оберіть день, пралку й час на шкалі.
            </div>
          )}
          {more > 0 && (
            <p style={{ margin: "8px 4px 0", fontSize: 13.5 }}>
              <Link className="link" to="/me" style={{ minHeight: 0 }}>
                Ще {more} {more === 1 ? "запис" : "записи"}
              </Link>
            </p>
          )}
        </section>
        <section className="area-book">
          {blocked ? null : full ? (
            <p className="empty-note">
              Усі {MAX_ACTIVE} записи вже зайняті. Новий можна зробити, коли
              один із них закінчиться або ви його скасуєте.
            </p>
          ) : (
            <Link className="btn btn-primary block" to="/book" viewTransition>
              <Icon name="plus" />
              Записатися
            </Link>
          )}
        </section>
        <section className="area-machines">
          <div className="section-h" style={{ marginTop: 20 }}>
            <h3>Пралки зараз</h3>
          </div>
          <div className="glass now-panel">
            {machines.map((m) => {
              const st = stateText(m.state, m.working);
              return (
                <Link
                  viewTransition
                  className="now-row"
                  to={`/machines/${m.slug}`}
                  key={m.slug}
                >
                  <Port free={st.free} />
                  <span className="now-name">
                    <b>{m.shortName}</b>
                    <small className={st.free ? "ok" : undefined}>
                      {st.text}
                    </small>
                  </span>
                  <DayStrip
                    label={m.shortName}
                    bookings={m.slots}
                    mineIds={new Set(m.mine)}
                    nowMin={now.minute}
                    mini
                  />
                </Link>
              );
            })}
            <StripScale className="now-scale" />
          </div>
        </section>
      </div>
      <Credit />
    </>
  );
}
