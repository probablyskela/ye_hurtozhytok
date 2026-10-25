import { PillGroup } from "~/components/pill-group";
import { Form, Link, data } from "react-router";

import { Credit, DayStrip, Icon, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import {
  BUFFER_MIN,
  NO_SHOW_MIN,
  bookableDays,
  durationLabel,
  fmtMin,
  freeWindows,
  longestFit,
  machineNow,
} from "~/lib/booking";
import { cancelBooking } from "~/lib/bookings.server";
import { machinesOn } from "~/lib/day.server";
import { isCouncil } from "~/lib/permissions";
import { notifyCancelledByCouncil } from "~/lib/scheduled.server";
import {
  WEEKDAYS_SHORT,
  dayName,
  dayOfMonth,
  isDateKey,
  kyivNow,
  weekdayIndex,
} from "~/lib/time";
import { usePolling } from "~/lib/use-polling";
import type { Route } from "./+types/machine";

export const handle = { tab: null };
export const meta: Route.MetaFunction = ({ data }) => [
  { title: `${data?.machine.name ?? "Пралка"} · єГуртожиток` },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const now = kyivNow();
  const tabs = bookableDays(now.date);
  const d = new URL(request.url).searchParams.get("d");
  const date = isDateKey(d) && tabs.includes(d) ? d : now.date;
  const machines = await machinesOn(env, date);
  const machine = machines.find((m) => m.slug === params.slug);
  if (!machine) throw new Response("Такої пралки немає.", { status: 404 });
  const isToday = date === now.date;
  const nowMin = isToday ? now.minute : null;
  return {
    machine: {
      id: machine.id,
      slug: machine.slug,
      name: machine.name,
      working: machine.working,
    },
    state: isToday ? machineNow(machine.bookings, now.minute) : null,
    date,
    today: now.date,
    tabs: tabs.map((k) => ({
      key: k,
      wd: WEEKDAYS_SHORT[weekdayIndex(k)],
      day: dayOfMonth(k),
    })),
    nowMin,
    bookings: machine.bookings.map((b) => ({
      id: b.id,
      startMin: b.startMin,
      endMin: b.endMin,
      name: b.name,
      room: b.room,
      telegram: b.telegram,
      mine: b.residentId === resident.id,
    })),
    windows: machine.working ? freeWindows(machine.bookings, nowMin) : [],
    council: isCouncil(resident),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const form = await request.formData();
  const id = Number(form.get("id"));
  if (form.get("intent") !== "cancel" || !isCouncil(resident))
    return data({ error: "Немає доступу." }, { status: 403 });
  const ok = await cancelBooking(env, resident, id, kyivNow());
  if (ok) context.cloudflare.ctx.waitUntil(notifyCancelledByCouncil(env, id));
  return data(
    ok
      ? { ok: "Запис скасовано, людина отримає сповіщення." }
      : { error: "Не вдалося скасувати запис." },
  );
}

type Row =
  | { kind: "booking"; startMin: number; endMin: number; b: Booking }
  | { kind: "free"; startMin: number; endMin: number }
  | { kind: "now"; startMin: number };
type Booking = Route.ComponentProps["loaderData"]["bookings"][number];

export default function MachineDay({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  usePolling(20_000);
  const {
    machine,
    state,
    date,
    today,
    tabs,
    nowMin,
    bookings,
    windows,
    council,
  } = loaderData;

  // Today, finished bookings fold away; everything else is one list in time order.
  const past =
    nowMin === null ? [] : bookings.filter((b) => b.endMin <= nowMin);
  const rows: Row[] = [
    ...bookings
      .filter((b) => nowMin === null || b.endMin > nowMin)
      .map((b) => ({
        kind: "booking" as const,
        startMin: b.startMin,
        endMin: b.endMin,
        b,
      })),
    ...windows.map((w) => ({
      kind: "free" as const,
      startMin: w.startMin,
      endMin: w.endMin,
    })),
  ].sort((a, z) => a.startMin - z.startMin);
  if (nowMin !== null) {
    const at = rows.findIndex((r) => r.startMin > nowMin);
    rows.splice(at === -1 ? rows.length : at, 0, {
      kind: "now",
      startMin: nowMin,
    });
  }

  let pill = { text: "", free: true };
  if (!machine.working) pill = { text: "Не працює", free: false };
  else if (state?.kind === "busy")
    pill = { text: `Зайнята до ${fmtMin(state.until)}`, free: false };
  else if (state?.kind === "free")
    pill = {
      text:
        state.until === null
          ? "Вільна до кінця дня"
          : `Вільна до ${fmtMin(state.until)}`,
      free: true,
    };
  else if (state?.kind === "closed")
    pill = { text: "Зачинено до 06:00", free: false };

  const mineIds = new Set(bookings.filter((b) => b.mine).map((b) => b.id));

  return (
    <>
      <TopBar back="/" />
      <div className="day-head">
        <div>
          <h2>{machine.name}</h2>
          <span className={`state ${pill.free ? "free" : "busy"}`}>
            {pill.text || dayName(date, today)}
          </span>
        </div>
      </div>
      {actionData && "ok" in actionData && (
        <p className="ok-note" role="status">
          {actionData.ok}
        </p>
      )}
      {actionData && "error" in actionData && (
        <p className="error-note" role="alert">
          {actionData.error}
        </p>
      )}

      <PillGroup className="days" label="День">
        {tabs.map((d, i) => (
          <Link
            data-pill-item
            key={d.key}
            className="day"
            to={`?d=${d.key}`}
            replace
            preventScrollReset
            aria-current={d.key === date ? "true" : undefined}
            aria-label={dayName(d.key, today)}
          >
            <small>{i === 0 ? "Сьогодні" : i === 1 ? "Завтра" : d.wd}</small>
            <b>{d.day}</b>
          </Link>
        ))}
      </PillGroup>

      <div className="glass day-overview">
        <DayStrip
          label={machine.name}
          bookings={bookings}
          mineIds={mineIds}
          nowMin={nowMin}
        />
      </div>

      <div className="agenda">
        {past.length > 0 && (
          <details className="agenda-past">
            <summary>
              Раніше сьогодні: {past.length}{" "}
              {past.length === 1
                ? "запис"
                : past.length < 5
                  ? "записи"
                  : "записів"}
            </summary>
            {past.map((b) => (
              <BookingRow key={b.id} b={b} council={false} faded />
            ))}
          </details>
        )}
        {rows.map((r) =>
          r.kind === "now" ? (
            <div className="agenda-now" key="now">
              <span>{fmtMin(r.startMin)}</span>
              <i aria-hidden="true" />
              зараз
            </div>
          ) : r.kind === "free" ? (
            <FreeRow
              key={`f${r.startMin}`}
              startMin={r.startMin}
              endMin={r.endMin}
              date={date}
              machineId={machine.id}
            />
          ) : (
            <BookingRow key={r.b.id} b={r.b} council={council} />
          ),
        )}
        {rows.filter((r) => r.kind !== "now").length === 0 &&
          past.length === 0 && (
            <p className="empty">Цього дня пралка недоступна.</p>
          )}
      </div>

      <div className="glass rule" style={{ marginTop: 14 }}>
        <Icon name="info" />
        <span>
          Між записами є {BUFFER_MIN} хвилин запасу. Якщо людини немає{" "}
          {NO_SHOW_MIN} хвилин від початку, пралку може взяти будь-хто.
        </span>
      </div>
      <Credit />
    </>
  );
}

function Time({ startMin, endMin }: { startMin: number; endMin: number }) {
  return (
    <span className="agenda-time">
      {fmtMin(startMin)}
      <small>{fmtMin(endMin)}</small>
    </span>
  );
}

/** Who booked, always in full: name, room and Telegram, whatever the length. */
function BookingRow({
  b,
  council,
  faded,
}: {
  b: Booking;
  council: boolean;
  faded?: boolean;
}) {
  if (b.mine)
    return (
      <Link
        className={`agenda-row is-mine${faded ? " is-past" : ""}`}
        to={`/bookings/${b.id}`}
        viewTransition
      >
        <Time startMin={b.startMin} endMin={b.endMin} />
        <span className="agenda-body">
          <b>Ваш запис</b>
          <span>{durationLabel(b.endMin - b.startMin)}</span>
        </span>
        <Icon name="chev" small />
      </Link>
    );
  return (
    <div className={`agenda-row is-busy${faded ? " is-past" : ""}`}>
      <Time startMin={b.startMin} endMin={b.endMin} />
      <span className="agenda-body">
        <b>{b.name}</b>
        <span>
          кімната {b.room ?? "—"}
          {b.telegram && (
            <>
              {" · "}
              <a
                href={`https://t.me/${b.telegram}`}
                target="_blank"
                rel="noreferrer"
              >
                @{b.telegram}
              </a>
            </>
          )}
        </span>
      </span>
      {council && (
        <Form method="post" replace preventScrollReset>
          <input type="hidden" name="intent" value="cancel" />
          <input type="hidden" name="id" value={b.id} />
          <button className="pill-btn danger" type="submit">
            Скасувати
          </button>
        </Form>
      )}
    </div>
  );
}

function FreeRow({
  startMin,
  endMin,
  date,
  machineId,
}: {
  startMin: number;
  endMin: number;
  date: string;
  machineId: number;
}) {
  const len = longestFit(endMin - startMin) ?? 30;
  return (
    <Link
      className="agenda-row is-free"
      to={`/book?d=${date}&m=${machineId}&s=${startMin}&len=${len}`}
      viewTransition
      aria-label={`Вільно ${fmtMin(startMin)}–${fmtMin(endMin)}, записатися`}
    >
      <Time startMin={startMin} endMin={endMin} />
      <span className="agenda-body">
        <b>Вільно</b>
        <span>можна записатися до {durationLabel(len)}</span>
      </span>
      <span className="plus" aria-hidden="true">
        <Icon name="plus" small />
      </span>
    </Link>
  );
}
