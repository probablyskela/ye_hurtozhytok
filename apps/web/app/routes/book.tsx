import { useEffect, useState } from "react";
import { Form, Link, data, redirect, useNavigation } from "react-router";

import { TimeScrubber } from "~/components/time-scrubber";
import { Icon, TopBar } from "~/components/ui";
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

export const handle = { tab: "book", sheet: true };
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
    shortName: m.shortName,
    working: m.working,
    slots: m.bookings.map((b) => ({
      id: b.id,
      startMin: b.startMin,
      endMin: b.endMin,
      mine: b.residentId === resident.id,
    })),
    starts: m.working ? freeStarts(m.bookings, len, nowMin) : [],
  }));

  // The machine from the link, otherwise the one that frees up first.
  const requested = list.find(
    (x) => x.id === Number(url.searchParams.get("m")),
  );
  const earliest = [...list]
    .filter((x) => x.starts.length)
    .sort((a, b) => a.starts[0] - b.starts[0])[0];
  const machine = requested ?? earliest ?? list[0];
  const s = Number(url.searchParams.get("s"));
  // Today: the nearest free start. Later days: from 10:00, so nobody books 06:00 by accident.
  const preferred =
    nowMin === null
      ? (machine.starts.find((x) => x >= 10 * 60) ?? machine.starts[0])
      : machine.starts[0];
  const start = machine.starts.includes(s) ? s : (preferred ?? null);

  return {
    today: now.date,
    date,
    len,
    nowMin,
    days: days.map((k) => ({
      key: k,
      wd: WEEKDAYS_SHORT[weekdayIndex(k)],
      day: dayOfMonth(k),
    })),
    machines: list,
    machineId: machine.id,
    start,
    active: upcoming.length,
    canBook: canBook(resident),
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

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export default function Book({ loaderData, actionData }: Route.ComponentProps) {
  const { today, date, len, nowMin, days, machines, machineId, active } =
    loaderData;
  const allowed = loaderData.canBook;
  const hydrated = useHydrated();
  const busy = useNavigation().state === "submitting";
  const machine = machines.find((m) => m.id === machineId)!;
  const [start, setStart] = useState<number | null>(loaderData.start);
  useEffect(
    () => setStart(loaderData.start),
    [loaderData.start, machineId, len, date],
  );

  const qs = (p: Record<string, string | number>) =>
    "?" +
    new URLSearchParams({
      len: String(len),
      d: date,
      m: String(machineId),
      ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
    }).toString();
  const left = MAX_ACTIVE - active;
  const ready = start !== null && machine.starts.includes(start);

  return (
    <Form method="post" replace>
      <TopBar back="/" />
      <h2 className="title">Записатися</h2>
      <p className="lede">Оберіть, скільки прати, день, пралку й час.</p>
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
        <h3>Пралка</h3>
      </div>
      <nav className="machine-pick" aria-label="Пралка">
        {machines.map((m) => (
          <Link
            key={m.id}
            to={qs({ m: m.id })}
            preventScrollReset
            replace
            aria-current={m.id === machineId ? "true" : undefined}
          >
            <b>{m.shortName}</b>
            <small className={m.starts.length ? "ok" : undefined}>
              {!m.working
                ? "не працює"
                : m.starts.length
                  ? `з ${fmtMin(m.starts[0])}`
                  : "немає місця"}
            </small>
          </Link>
        ))}
      </nav>

      <div className="glass pick-card">
        {machine.starts.length === 0 ? (
          <div className="empty-note" style={{ marginTop: 0 }}>
            <Icon name="info" small />
            <span>
              {machine.working
                ? `${date === today ? "Сьогодні" : "Цього дня"} на цій пралці немає вікна на ${durationLabel(len)}. Оберіть іншу пралку, день чи коротший запис.`
                : "Пралка тимчасово не працює."}
            </span>
          </div>
        ) : hydrated ? (
          <TimeScrubber
            key={`${machineId}-${date}-${len}`}
            bookings={machine.slots}
            len={len}
            nowMin={nowMin}
            starts={machine.starts}
            value={start}
            onChange={setStart}
          />
        ) : (
          <div className="field-row">
            <label htmlFor="start-select">Початок</label>
            <select
              id="start-select"
              name="start"
              defaultValue={loaderData.start ?? undefined}
              className="select"
            >
              {machine.starts.map((s) => (
                <option key={s} value={s}>
                  {fmtMin(s)}–{fmtMin(s + len)}
                </option>
              ))}
            </select>
          </div>
        )}
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

      <input type="hidden" name="machine" value={machineId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="len" value={len} />
      {hydrated && start !== null && (
        <input type="hidden" name="start" value={start} />
      )}

      <div className="sheet">
        <div className="sheet-text">
          {left <= 0 ? (
            <>
              <small>Усі {MAX_ACTIVE} записи зайняті</small>
              <b>Скасуйте один, щоб записатися</b>
            </>
          ) : ready || !hydrated ? (
            <>
              <small>
                {machine.name} · {dayName(date, today).toLowerCase()}
              </small>
              <b key={start ?? "none"} className="sheet-time">
                {hydrated && start !== null
                  ? `${fmtMin(start)}–${fmtMin(start + len)}`
                  : durationLabel(len)}
              </b>
            </>
          ) : (
            <>
              <small>{durationLabel(len)}</small>
              <b>Оберіть час</b>
            </>
          )}
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={
            busy ||
            !allowed ||
            left <= 0 ||
            machine.starts.length === 0 ||
            (hydrated && !ready)
          }
        >
          {busy ? "Записуємо…" : "Записатися"}
        </button>
      </div>
    </Form>
  );
}
