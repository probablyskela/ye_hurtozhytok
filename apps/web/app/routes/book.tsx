import { Form, Link, data, redirect, useNavigation } from "react-router";

import { DayStrip, Icon, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import {
  BOOKING_ERRORS,
  DURATIONS,
  MAX_ACTIVE,
  bookableDays,
  durationLabel,
  fmtMin,
  freeStarts,
  parseDuration,
  type BookingError,
} from "~/lib/booking";
import { createBooking, upcomingFor } from "~/lib/bookings.server";
import { machinesOn } from "~/lib/day.server";
import { canBook } from "~/lib/permissions";
import {
  WEEKDAYS_SHORT,
  dayName,
  dayOfMonth,
  isDateKey,
  kyivNow,
  weekdayIndex,
} from "~/lib/time";
import type { Route } from "./+types/book";

export const handle = { tab: "book", sheet: true, wide: true };
export const meta: Route.MetaFunction = () => [
  { title: "Записатися · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const now = kyivNow();
  const url = new URL(request.url);
  const days = bookableDays(now.date);
  const len = parseDuration(url.searchParams.get("len"));
  const d = url.searchParams.get("d");
  const date = isDateKey(d) && days.includes(d) ? d : now.date;
  const nowMin = date === now.date ? now.minute : null;

  const [machines, upcoming] = await Promise.all([
    machinesOn(env, date),
    upcomingFor(env, resident.id, now),
  ]);
  const list = machines.map((m) => ({
    id: m.id,
    name: m.name,
    working: m.working,
    slots: m.bookings.map((b) => ({
      id: b.id,
      startMin: b.startMin,
      endMin: b.endMin,
    })),
    mine: m.bookings
      .filter((b) => b.residentId === resident.id)
      .map((b) => b.id),
    starts: m.working ? freeStarts(m.bookings, len, nowMin) : [],
  }));

  const m = Number(url.searchParams.get("m"));
  const s = Number(url.searchParams.get("s"));
  const chosen = list.find((x) => x.id === m);
  const pick =
    chosen && chosen.starts.includes(s) ? { machineId: m, startMin: s } : null;

  return {
    today: now.date,
    date,
    len,
    days: days.map((k) => ({
      key: k,
      wd: WEEKDAYS_SHORT[weekdayIndex(k)],
      day: dayOfMonth(k),
    })),
    machines: list,
    pick,
    active: upcoming.length,
    canBook: canBook(resident),
    nowMin,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  if (!canBook(resident))
    return data(
      { error: "Записуватися зараз не можна: акаунт заблоковано." },
      { status: 403 },
    );
  const form = await request.formData();
  const result = await createBooking(env, {
    residentId: resident.id,
    machineId: Number(form.get("machine")),
    date: String(form.get("date") ?? ""),
    startMin: Number(form.get("start")),
    duration: Number(form.get("len")),
    now: kyivNow(),
  });
  if (!result.ok)
    return data(
      { error: BOOKING_ERRORS[result.error as BookingError] },
      { status: 409 },
    );
  throw redirect(`/bookings/${result.id}?new=1`);
}

export default function Book({ loaderData, actionData }: Route.ComponentProps) {
  const {
    today,
    date,
    len,
    days,
    machines,
    pick,
    active,
    canBook: allowed,
    nowMin,
  } = loaderData;
  const busy = useNavigation().state === "submitting";
  const qs = (p: Record<string, string | number>) =>
    "?" +
    new URLSearchParams({
      len: String(len),
      d: date,
      ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
    }).toString();
  const picked = pick && machines.find((m) => m.id === pick.machineId);
  const left = MAX_ACTIVE - active;

  return (
    <>
      <TopBar back="/" />
      <h2 className="title">Записатися</h2>
      <p className="lede">Оберіть, скільки прати, день і вільний час.</p>
      {actionData?.error && (
        <p className="error-note" role="alert">
          {actionData.error}
        </p>
      )}
      {!allowed && (
        <p className="error-note">
          Записуватися зараз не можна: акаунт заблоковано.
        </p>
      )}

      <div className="section-h" style={{ marginTop: 0 }}>
        <h3>Скільки прати</h3>
      </div>
      <nav className="durations" aria-label="Скільки прати">
        {DURATIONS.map((d) => {
          const [num, unit] = durationLabel(d).split(" ");
          return (
            <Link
              key={d}
              className="dur"
              to={qs({ len: d })}
              preventScrollReset
              replace
              aria-current={d === len ? "true" : undefined}
              aria-label={durationLabel(d)}
            >
              <b>{num}</b>
              <span>{unit}</span>
            </Link>
          );
        })}
      </nav>

      <div className="section-h">
        <h3>Коли</h3>
      </div>
      <nav className="days" aria-label="День">
        {days.map((d, i) => (
          <Link
            key={d.key}
            className="day"
            to={qs({ d: d.key })}
            preventScrollReset
            replace
            aria-current={d.key === date ? "true" : undefined}
            aria-label={dayName(d.key, today)}
          >
            <small>{i === 0 ? "Сьогодні" : i === 1 ? "Завтра" : d.wd}</small>
            <b>{d.day}</b>
          </Link>
        ))}
      </nav>

      <div className="section-h">
        <h3>Вільний час</h3>
      </div>
      <div className="slots">
        {machines.map((m) => {
          const count = m.starts.length;
          const isPick = pick?.machineId === m.id;
          return (
            <div className="glass slot-machine" key={m.id}>
              <div className="machine-head">
                <span className="machine-name">{m.name}</span>
                {!m.working ? (
                  <span className="state busy">Не працює</span>
                ) : count ? (
                  <span className="state free">
                    {count}{" "}
                    {count === 1
                      ? "початок"
                      : count < 5
                        ? "початки"
                        : "початків"}
                  </span>
                ) : (
                  <span className="state busy">Немає місця</span>
                )}
              </div>
              <DayStrip
                label={m.name}
                bookings={m.slots}
                mineIds={new Set(m.mine)}
                nowMin={nowMin}
                pick={
                  isPick
                    ? { startMin: pick!.startMin, endMin: pick!.startMin + len }
                    : null
                }
              />
              {count ? (
                <div className="chip-row">
                  {m.starts.map((s) => (
                    <Link
                      key={s}
                      className="chip"
                      to={qs({ m: m.id, s })}
                      preventScrollReset
                      replace
                      aria-current={
                        isPick && pick!.startMin === s ? "true" : undefined
                      }
                    >
                      {fmtMin(s)}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-note">
                  <Icon name="info" small />
                  <span>
                    {m.working
                      ? `${date === today ? "Сьогодні" : "Цього дня"} тут немає вікна на ${durationLabel(len)}. Спробуйте іншу пралку чи день.`
                      : "Пралка тимчасово не працює."}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="quota">
        <span className="quota-dots" aria-hidden="true">
          {Array.from({ length: MAX_ACTIVE }, (_, i) => (
            <i key={i} className={i < active ? "on" : undefined} />
          ))}
        </span>
        {left > 0
          ? `Ще можна мати ${left} ${left === 1 ? "запис" : "записи"} із ${MAX_ACTIVE}`
          : `Усі ${MAX_ACTIVE} записи зайняті`}
      </div>
      <div className="sheet-pad" />

      <div className="sheet">
        <div className="sheet-text">
          {left <= 0 ? (
            <>
              <small>Усі {MAX_ACTIVE} записи зайняті</small>
              <b>Скасуйте один, щоб записатися</b>
            </>
          ) : picked ? (
            <>
              <small>
                {picked.name} · {dayName(date, today).toLowerCase()}
              </small>
              <b>
                {fmtMin(pick!.startMin)}–{fmtMin(pick!.startMin + len)}
              </b>
            </>
          ) : (
            <>
              <small>{durationLabel(len)}</small>
              <b>Оберіть час</b>
            </>
          )}
        </div>
        <Form method="post" replace>
          {pick && (
            <>
              <input type="hidden" name="machine" value={pick.machineId} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="start" value={pick.startMin} />
              <input type="hidden" name="len" value={len} />
            </>
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!pick || busy || !allowed || left <= 0}
          >
            {busy ? "Записуємо…" : "Записатися"}
          </button>
        </Form>
      </div>
    </>
  );
}
