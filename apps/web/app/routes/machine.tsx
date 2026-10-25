import { PillGroup } from "~/components/pill-group";
import { Form, Link, data } from "react-router";

import { Credit, Icon, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import {
  BUFFER_MIN,
  CLOSE_MIN,
  NO_SHOW_MIN,
  OPEN_MIN,
  durationLabel,
  fmtMin,
  freeWindows,
  machineNow,
} from "~/lib/booking";
import { cancelBooking } from "~/lib/bookings.server";
import { machinesOn } from "~/lib/day.server";
import { isCouncil } from "~/lib/permissions";
import { notifyCancelledByCouncil } from "~/lib/scheduled.server";
import { addDays, dayName, isDateKey, kyivNow } from "~/lib/time";
import { usePolling } from "~/lib/use-polling";
import type { Route } from "./+types/machine";

export const handle = { tab: null };
export const meta: Route.MetaFunction = ({ data }) => [
  { title: `${data?.machine.name ?? "Пралка"} · єГуртожиток` },
];

const PX = 1.15;

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const now = kyivNow();
  const tabs = [now.date, addDays(now.date, 1), addDays(now.date, 2)];
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
    tabs,
    nowMin,
    // The view starts at the last full hour before now, so the past does not take the screen.
    fromMin: isToday
      ? Math.max(
          OPEN_MIN,
          Math.min(Math.floor(now.minute / 60) * 60, CLOSE_MIN - 60),
        )
      : OPEN_MIN,
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
    fromMin,
    bookings,
    windows,
    council,
  } = loaderData;
  const y = (m: number) => (m - fromMin) * PX;
  const visible = bookings.filter((b) => b.endMin > fromMin);
  const hours: number[] = [];
  for (let h = Math.ceil(fromMin / 60); h <= 24; h++) hours.push(h);

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

  return (
    <>
      <TopBar back="/" />
      <div className="day-head">
        <div>
          <h2>{machine.name}</h2>
          {pill.text && (
            <span className={`state ${pill.free ? "free" : "busy"}`}>
              {pill.text}
            </span>
          )}
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

      <PillGroup className="seg" label="День">
        {tabs.map((t) => (
          <Link
            data-pill-item
            key={t}
            to={`?d=${t}`}
            replace
            preventScrollReset
            aria-current={t === date ? "true" : undefined}
          >
            {dayName(t, today).replace(/, \d+ \S+$/, "")}
            {t !== today && t !== tabs[1] ? `, ${Number(t.slice(8))}` : ""}
          </Link>
        ))}
      </PillGroup>

      <div className="glass timeline" style={{ marginTop: 14 }}>
        {fromMin > OPEN_MIN && (
          <div className="past-row" style={{ margin: "0 0 14px 14px" }}>
            <span>06:00–{fmtMin(fromMin)} уже минуло</span>
            <Icon name="clock" small />
          </div>
        )}
        <div className="tl-grid" style={{ height: y(CLOSE_MIN) + 8 }}>
          {hours.map((h) => (
            <div className="tl-hour" key={h} style={{ top: y(h * 60) }}>
              <span>{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
          {visible.flatMap((b) => [
            b.startMin - BUFFER_MIN >= fromMin ? (
              <div
                key={`a${b.id}`}
                className="tl-buf"
                style={{
                  top: y(b.startMin - BUFFER_MIN),
                  height: BUFFER_MIN * PX,
                }}
              />
            ) : null,
            b.endMin + BUFFER_MIN <= CLOSE_MIN ? (
              <div
                key={`z${b.id}`}
                className="tl-buf"
                style={{ top: y(b.endMin), height: BUFFER_MIN * PX }}
              />
            ) : null,
          ])}
          {visible.map((b) => {
            const top = y(Math.max(fromMin, b.startMin)) + 2;
            const height = (b.endMin - Math.max(fromMin, b.startMin)) * PX - 4;
            const time = `${fmtMin(b.startMin)}–${fmtMin(b.endMin)}`;
            return b.mine ? (
              <Link
                key={b.id}
                className="tl-block tl-mine"
                to={`/bookings/${b.id}`}
                style={{ top, height, textDecoration: "none" }}
              >
                <span className="t">{time}</span>
                {height > 34 && <span className="n">Ваш запис</span>}
              </Link>
            ) : (
              <div
                key={b.id}
                className="tl-block tl-busy"
                style={{ top, height }}
              >
                <span className="t">{time}</span>
                {height > 34 && <span className="n">{b.name}</span>}
                {height > 56 && (
                  <span className="c">
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
                )}
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
          })}
          {windows
            .filter((w) => w.endMin > fromMin)
            .map((w) => {
              const top = y(Math.max(fromMin, w.startMin)) + 2;
              const height =
                (w.endMin - Math.max(fromMin, w.startMin)) * PX - 4;
              const max = Math.min(150, w.endMin - w.startMin);
              const len = [150, 120, 90, 60, 30].find((d) => d <= max) ?? 30;
              return (
                <Link
                  key={w.startMin}
                  className="tl-block tl-free"
                  to={`/book?d=${date}&m=${machine.id}&s=${w.startMin}&len=${len}`}
                  style={{ top, height }}
                  aria-label={`Вільно ${fmtMin(w.startMin)}–${fmtMin(w.endMin)}, записатися`}
                >
                  <span>
                    <span className="n" style={{ display: "block" }}>
                      Вільно {fmtMin(w.startMin)}–{fmtMin(w.endMin)}
                    </span>
                    {height > 44 && (
                      <span className="c">
                        Можна записатися до {durationLabel(max)}
                      </span>
                    )}
                  </span>
                  <span className="plus">
                    <Icon name="plus" small />
                  </span>
                </Link>
              );
            })}
          {nowMin !== null && nowMin >= fromMin && nowMin < CLOSE_MIN && (
            <div
              className="tl-now"
              style={{ top: y(nowMin) }}
              data-time={fmtMin(nowMin)}
            />
          )}
        </div>
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
