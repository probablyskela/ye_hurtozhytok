import { PillGroup } from "~/components/pill-group";
import { Form, Link } from "react-router";

import { DayStrip, Port, StripScale, Ticket } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import {
  DURATIONS,
  MAX_ACTIVE,
  countdown,
  durationLabel,
  fmtMin,
  freeStarts,
  machineNow,
  parseDuration,
} from "~/lib/booking";
import { upcomingFor } from "~/lib/bookings.server";
import { machinesOn } from "~/lib/day.server";
import { initials } from "~/lib/profile";
import {
  addDays,
  dayHeading,
  dayName,
  kyivMinuteToUtc,
  kyivNow,
} from "~/lib/time";
import { usePolling } from "~/lib/use-polling";
import type { Route } from "./+types/home";

export const handle = { tab: "home", wide: true };
export const meta: Route.MetaFunction = () => [{ title: "єГуртожиток" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const nowMs = Date.now();
  const now = kyivNow(nowMs);
  const len = parseDuration(new URL(request.url).searchParams.get("len"));
  const tomorrow = addDays(now.date, 1);
  const [today, next, upcoming] = await Promise.all([
    machinesOn(env, now.date),
    machinesOn(env, tomorrow),
    upcomingFor(env, resident.id, now),
  ]);

  // The first free start on each working machine, soonest first.
  const firstPerMachine = (
    day: typeof today,
    date: string,
    nowMin: number | null,
  ) =>
    day
      .filter((m) => m.working)
      .map((m) => ({
        s: freeStarts(m.bookings, len, nowMin)[0],
        id: m.id,
        name: m.name,
        shortName: m.shortName,
        date,
      }))
      .filter((x) => x.s !== undefined)
      .sort((a, b) => a.s - b.s);
  let options = firstPerMachine(today, now.date, now.minute);
  const nearestTomorrow = options.length === 0;
  if (nearestTomorrow) options = firstPerMachine(next, tomorrow, null);
  const best = options[0];

  const first = upcoming[0];
  return {
    name: resident.name,
    blocked: resident.blocked,
    now,
    len,
    nearest: best
      ? {
          ...best,
          when: dayName(best.date, now.date).toLowerCase(),
          countdown: countdown(nowMs, kyivMinuteToUtc(best.date, best.s)),
        }
      : null,
    others: options.slice(1),
    nearestTomorrow,
    canBookNow: !resident.blocked && upcoming.length < MAX_ACTIVE,
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

export default function Home({ loaderData }: Route.ComponentProps) {
  usePolling(20_000);
  const {
    name,
    blocked,
    len,
    nearest,
    others,
    canBookNow,
    nearestTomorrow,
    machines,
    next,
    more,
    now,
  } = loaderData;
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
          to="/profile"
          aria-label={`Профіль: ${name}`}
          style={{ textDecoration: "none" }}
        >
          {initials(name)}
        </Link>
      </div>
      <h2 className="title" style={{ marginBottom: 16 }}>
        Привіт, {name.split(" ")[0]}
      </h2>
      {blocked && (
        <p className="error-note" role="alert">
          Студрада заблокувала ваш акаунт: записуватися зараз не можна.
        </p>
      )}

      <div className="home-grid">
        <section className="area-ticket">
          {next ? (
            <Ticket
              vtName={`ticket-${next.id}`}
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
              Оберіть пралку й час — це два натискання.
            </div>
          )}
          {more > 0 && (
            <p style={{ margin: "8px 4px 0", fontSize: 13.5 }}>
              <Link className="link" to="/bookings" style={{ minHeight: 0 }}>
                Ще {more} {more === 1 ? "запис" : "записи"}
              </Link>
            </p>
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
        <section className="area-nearest">
          <div className="section-h">
            <h3>Найближчий вільний час</h3>
          </div>
          <PillGroup
            className="seg"
            label="Тривалість"
            style={{ gridAutoColumns: "1fr" }}
          >
            {DURATIONS.map((d) => (
              <Link
                data-pill-item
                key={d}
                to={`?len=${d}`}
                preventScrollReset
                replace
                aria-current={d === len ? "true" : undefined}
              >
                {durationLabel(d)}
              </Link>
            ))}
          </PillGroup>
          {nearest ? (
            <div
              className="glass nearest"
              key={`${len}-${nearest.id}-${nearest.s}`}
            >
              <div className="nearest-top">
                <span className="state free">Вільно</span>
                <span className="nearest-when">
                  {nearest.when}, {nearest.countdown}
                </span>
              </div>
              <div className="nearest-time">
                {fmtMin(nearest.s)}
                <span className="dash">–</span>
                {fmtMin(nearest.s + len)}
              </div>
              <div className="nearest-where">{nearest.name}</div>
              <Form method="post" action="/book" className="nearest-actions">
                <input type="hidden" name="machine" value={nearest.id} />
                <input type="hidden" name="date" value={nearest.date} />
                <input type="hidden" name="start" value={nearest.s} />
                <input type="hidden" name="len" value={len} />
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={!canBookNow}
                >
                  Записатися
                </button>
                <Link
                  className="btn btn-soft"
                  viewTransition
                  to={`/book?len=${len}&d=${nearest.date}&m=${nearest.id}&s=${nearest.s}`}
                >
                  Інший час
                </Link>
              </Form>
              {others.length > 0 && (
                <p className="nearest-others">
                  Також:{" "}
                  {others.map((o, i) => (
                    <span key={o.id}>
                      {i > 0 && " · "}
                      <Link
                        to={`/book?len=${len}&d=${o.date}&m=${o.id}&s=${o.s}`}
                        viewTransition
                      >
                        {o.shortName} о {fmtMin(o.s)}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
              {!canBookNow && !blocked && (
                <p className="nearest-others">
                  Усі {MAX_ACTIVE} записи вже зайняті.
                </p>
              )}
            </div>
          ) : (
            <p className="empty-note">
              На {durationLabel(len)} вільного часу немає ні сьогодні, ні
              завтра. Спробуйте коротший запис або інший день.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
