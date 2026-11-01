import { useEffect, useMemo, useState } from "react";
import { Form, Link, data, redirect, useNavigation } from "react-router";

import { PillGroup } from "~/components/pill-group";
import { TimeScrubber } from "~/components/time-scrubber";
import { Icon, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import {
  BOOKING_ERRORS,
  MAX_ACTIVE,
  MAX_DURATION,
  MIN_DURATION,
  STEP_MIN,
  bookableDays,
  durationLabel,
  fmtMin,
  freeStarts,
  longestFree,
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

export const handle = { tab: "laundry", sheet: true };
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
    ...fitting({ working: m.working, slots: m.bookings }, len, nowMin),
  }));

  // The machine from the link, otherwise the one that frees up first.
  const requested = list.find(
    (x) => x.id === Number(url.searchParams.get("m")),
  );
  // Prefer machines where the whole wanted length fits.
  const earliest = [...list]
    .filter((x) => x.starts.length)
    .sort(
      (a, b) =>
        Number(b.len === len) - Number(a.len === len) ||
        a.starts[0] - b.starts[0],
    )[0];
  const machine = requested ?? earliest ?? list[0];
  if (!machine) throw new Response("Пралок ще не додано.", { status: 404 });
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
    machines: list.map(({ id, name, shortName, working, slots }) => ({
      id,
      name,
      shortName,
      working,
      slots,
    })),
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

/** Free starts for a length, or, when nothing that long fits, for the longest that does. */
function fitting(
  m: { working: boolean; slots: { startMin: number; endMin: number }[] },
  want: number,
  nowMin: number | null,
) {
  if (!m.working) return { len: want, starts: [] as number[], longest: null };
  const starts = freeStarts(m.slots, want, nowMin);
  if (starts.length) return { len: want, starts, longest: want };
  const longest = longestFree(m.slots, nowMin);
  return longest === null
    ? { len: want, starts, longest }
    : { len: longest, starts: freeStarts(m.slots, longest, nowMin), longest };
}

export default function Book({ loaderData, actionData }: Route.ComponentProps) {
  const { today, date, nowMin, days, machines, machineId, active } = loaderData;
  const allowed = loaderData.canBook;
  const hydrated = useHydrated();
  const busy = useNavigation().state === "submitting";
  // The wanted length lives here and travels in every link, so changing it
  // never waits for the server. A day without room for it offers the longest
  // free stretch instead, without forgetting the wish.
  const [wanted, setWanted] = useState(loaderData.len);
  const fits = useMemo(
    () => machines.map((m) => fitting(m, wanted, nowMin)),
    [machines, wanted, nowMin],
  );
  const index = machines.findIndex((m) => m.id === machineId);
  const machine = { ...machines[index], ...fits[index] };
  const len = machine.len;
  const shortened = len < wanted;
  // The person's pick belongs to one machine and day. A new choice there
  // starts from the server's suggestion in the same render, so the scale
  // never mounts on the previous machine's time.
  const choice = `${machineId}-${date}-${loaderData.start}`;
  const [picked, setPicked] = useState<{
    choice: string;
    start: number | null;
  }>({
    choice,
    start: loaderData.start,
  });
  const fromServer =
    loaderData.start !== null && machine.starts.includes(loaderData.start)
      ? loaderData.start
      : (machine.starts[0] ?? null);
  const start = picked.choice === choice ? picked.start : fromServer;
  const setStart = (s: number | null) => setPicked({ choice, start: s });

  const qs = (p: Record<string, string | number>) =>
    "?" +
    new URLSearchParams({
      len: String(wanted),
      d: date,
      m: String(machineId),
      ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])),
    }).toString();
  const left = MAX_ACTIVE - active;
  const ready = start !== null && machine.starts.includes(start);

  return (
    <Form method="post" replace>
      <TopBar back="/laundry" />
      <h2 className="title">Записатися</h2>
      <p className="lede">
        Оберіть день і пралку, а на шкалі — час і тривалість.
      </p>
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
        <h3>Коли</h3>
      </div>
      <PillGroup className="days" label="День">
        {days.map((d, i) => (
          <Link
            data-pill-item
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
      </PillGroup>

      <div className="section-h">
        <h3>Пралка</h3>
      </div>
      <PillGroup className="machine-pick" label="Пралка">
        {machines.map((m, i) => (
          <Link
            data-pill-item
            key={m.id}
            to={qs({ m: m.id })}
            preventScrollReset
            replace
            aria-current={m.id === machineId ? "true" : undefined}
          >
            <b>{m.shortName}</b>
            <small className={fits[i].starts.length ? "ok" : undefined}>
              {!m.working
                ? "не працює"
                : !fits[i].starts.length
                  ? "немає місця"
                  : fits[i].len < wanted
                    ? `до ${durationLabel(fits[i].len)}`
                    : `з ${fmtMin(fits[i].starts[0])}`}
            </small>
          </Link>
        ))}
      </PillGroup>

      <div className="glass pick-card">
        {machine.starts.length === 0 ? (
          <div className="empty-note" style={{ marginTop: 0 }}>
            <Icon name="info" small />
            <span>
              {machine.working
                ? `${date === today ? "Сьогодні" : "Цього дня"} на цій пралці немає навіть ${durationLabel(MIN_DURATION)}. Оберіть іншу пралку чи день.`
                : "Пралка тимчасово не працює."}
            </span>
          </div>
        ) : hydrated ? (
          <>
            <TimeScrubber
              key={`${machineId}-${date}`}
              bookings={machine.slots}
              len={len}
              nowMin={nowMin}
              starts={machine.starts}
              value={start}
              onChange={setStart}
              onLenChange={setWanted}
              note={
                shortened
                  ? `Цього дня найдовше вільне вікно — ${durationLabel(len)}`
                  : undefined
              }
            />
          </>
        ) : (
          // Before JavaScript: two plain lists. The server re-checks the pair.
          <div className="pick-fallback">
            <div className="field-row">
              <label htmlFor="start-select">Початок</label>
              <select
                id="start-select"
                name="start"
                defaultValue={fromServer ?? undefined}
                className="select"
              >
                {machine.starts.map((s) => (
                  <option key={s} value={s}>
                    {fmtMin(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <label htmlFor="len-select">Тривалість</label>
              <select
                id="len-select"
                name="len"
                defaultValue={len}
                className="select"
              >
                {Array.from(
                  { length: (MAX_DURATION - MIN_DURATION) / STEP_MIN + 1 },
                  (_, i) => MIN_DURATION + i * STEP_MIN,
                ).map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
              </select>
            </div>
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
      {hydrated && <input type="hidden" name="len" value={len} />}
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
