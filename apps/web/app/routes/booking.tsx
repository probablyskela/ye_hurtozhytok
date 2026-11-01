import { Form, Link, data, redirect, useNavigation } from "react-router";

import { ConfirmButton } from "~/components/controls";
import { ReminderSwitch } from "~/components/reminder-switch";
import { Icon, Ticket, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { NO_SHOW_MIN, countdown, durationWords } from "~/lib/booking";
import {
  bookingById,
  cancelBooking,
  releaseBooking,
} from "~/lib/bookings.server";
import { roomLabel } from "~/lib/profile";
import { isCouncil } from "~/lib/permissions";
import { notifyCancelledByCouncil } from "~/lib/scheduled.server";
import { dayHeading, kyivMinuteToUtc, kyivNow } from "~/lib/time";
import type { Route } from "./+types/booking";

export const handle = { tab: "me" };
export const meta: Route.MetaFunction = () => [
  { title: "Мій запис · єГуртожиток" },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const b = await bookingById(env, Number(params.id));
  if (!b || (b.residentId !== resident.id && !isCouncil(resident)))
    throw new Response("Такого запису немає.", { status: 404 });
  const url = new URL(request.url);
  const nowMs = Date.now();
  const now = kyivNow(nowMs);
  const ended =
    b.date < now.date || (b.date === now.date && b.endMin <= now.minute);
  const running = !ended && b.date === now.date && b.startMin <= now.minute;
  return {
    booking: {
      id: b.id,
      heading: dayHeading(b.date, now.date),
      startMin: b.startMin,
      endMin: b.endMin,
      machine: b.machineName,
      machineSlug: b.machineSlug,
      length: durationWords(b.endMin - b.startMin),
      countdown: countdown(nowMs, kyivMinuteToUtc(b.date, b.startMin)),
      status: b.status,
      mine: b.residentId === resident.id,
      who:
        b.residentId === resident.id ? null : `${b.name}, ${roomLabel(b.room)}`,
    },
    ended,
    running,
    isNew: url.searchParams.get("new") === "1",
    vapidKey: env.VAPID_PUBLIC_KEY ?? "",
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const id = Number(params.id);
  const intent = (await request.formData()).get("intent");
  const now = kyivNow();
  if (intent === "cancel") {
    const before = await bookingById(env, id);
    const ok = await cancelBooking(env, resident, id, now);
    if (ok && before && before.residentId !== resident.id) {
      // The council cancelled someone else's booking: tell that person, as on
      // the machine page, and go back to the machine's day.
      context.cloudflare.ctx.waitUntil(notifyCancelledByCouncil(env, id));
      throw redirect(`/machines/${before.machineSlug}?d=${before.date}`);
    }
    if (ok) throw redirect("/me");
    return data(
      {
        error:
          "Не вдалося скасувати: запис уже почався, закінчився або скасований. Під час прання можна звільнити пралку раніше.",
      },
      { status: 409 },
    );
  }
  if (intent === "release") {
    const ok = await releaseBooking(env, resident, id, now);
    if (ok) throw redirect("/laundry");
    return data(
      { error: "Звільнити можна лише запис, який зараз триває." },
      { status: 409 },
    );
  }
  return data({ error: "Невідома дія." }, { status: 400 });
}

export default function BookingPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { booking: b, ended, running, isNew, vapidKey } = loaderData;
  const busy = useNavigation().state === "submitting";
  const status =
    b.status === "cancelled"
      ? "Скасовано"
      : ended
        ? "Завершено"
        : running
          ? "Триває"
          : "Підтверджено";
  return (
    <>
      <TopBar back="/me" title={b.mine ? "Мій запис" : "Запис"} />
      {isNew && (
        <p className="ok-note" role="status">
          Записано. Нагадаємо за 15 хвилин, якщо сповіщення увімкнені.
        </p>
      )}
      {actionData?.error && (
        <p className="error-note" role="alert">
          {actionData.error}
        </p>
      )}

      <Ticket
        big
        vtName={`ticket-${b.id}`}
        celebrate={isNew}
        status={status}
        heading={b.heading}
        startMin={b.startMin}
        endMin={b.endMin}
        machine={b.machine}
        footLeft={b.who ?? b.length}
        footRight={
          !ended && b.status === "active" && !running ? (
            <span>{b.countdown}</span>
          ) : undefined
        }
      />

      {b.status === "active" && !ended && (
        <div className={`actions${running && b.mine ? " running" : ""}`}>
          {running && b.mine ? (
            <Form method="post" replace>
              <input type="hidden" name="intent" value="release" />
              <button
                className="btn btn-soft block"
                type="submit"
                disabled={busy}
              >
                <Icon name="check" small />
                Звільнити раніше
              </button>
            </Form>
          ) : (
            <a className="btn btn-soft" href={`/bookings/${b.id}/calendar.ics`}>
              <Icon name="cal" small />У календар
            </a>
          )}
          {/* While washing, the owner frees the machine instead of cancelling. */}
          {!(running && b.mine) && (
            <Form method="post" replace className="confirm-form">
              <input type="hidden" name="intent" value="cancel" />
              <ConfirmButton
                className="btn btn-ghost-danger block"
                question="Скасувати цей запис?"
                yes="Так, скасувати"
              >
                Скасувати
              </ConfirmButton>
            </Form>
          )}
        </div>
      )}

      {b.mine && b.status === "active" && !ended && !running && (
        <ReminderSwitch vapidKey={vapidKey} />
      )}

      <div className="glass rules">
        <div className="rule">
          <Icon name="clock" />
          <span>
            Під час прання можна звільнити пралку раніше, і решта часу стане
            вільною для інших.
          </span>
        </div>
        <div className="rule">
          <Icon name="info" />
          <span>
            Якщо вас немає {NO_SHOW_MIN} хвилин від початку, пралку може взяти
            будь-хто.
          </span>
        </div>
        <div className="rule">
          <Icon name="user" />
          <span>
            Інші бачать ваше імʼя, кімнату й імʼя користувача в Telegram, якщо
            ви його вказали.
          </span>
        </div>
      </div>
      <Link
        viewTransition
        className="glass list-row"
        to={`/machines/${b.machineSlug}`}
        style={{ marginTop: 14 }}
      >
        <span className="who-av">
          <Icon name="cal" small />
        </span>
        <span style={{ flex: 1 }}>
          <b>Розклад цієї пралки</b>
          <span className="sub">Хто ще записався на цей та інші дні</span>
        </span>
        <Icon name="chev" small />
      </Link>
    </>
  );
}
