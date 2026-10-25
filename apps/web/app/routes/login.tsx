import { Form, redirect } from "react-router";

import { DayStrip, Icon, TopBar } from "~/components/ui";
import { BUFFER_MIN } from "~/lib/booking";
import {
  devLogin,
  devLoginEnabled,
  getCurrentResident,
  googleEnabled,
} from "~/lib/auth.server";
import { bookingsOn, listMachines } from "~/lib/bookings.server";
import { isUniversityEmail } from "~/lib/google";
import { kyivNow } from "~/lib/time";
import type { Route } from "./+types/login";

export const meta: Route.MetaFunction = () => [{ title: "Вхід · єГуртожиток" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  if (await getCurrentResident(request, env)) throw redirect("/");
  const now = kyivNow();
  const [machines, today] = await Promise.all([
    listMachines(env),
    bookingsOn(env, [now.date]),
  ]);
  return {
    google: googleEnabled(env),
    dev: devLoginEnabled(env, request),
    nowMin: now.minute,
    // Only times, never names: the sign-in page is public.
    machines: machines.map((m) => ({
      id: m.id,
      shortName: m.shortName,
      slots: today
        .filter((b) => b.machineId === m.id)
        .map((b) => ({ id: b.id, startMin: b.startMin, endMin: b.endMin })),
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  if (!devLoginEnabled(env, request))
    throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  if (!isUniversityEmail(email) || !name)
    return { error: "Вкажіть імʼя та адресу @lpnu.ua." };
  const headers = await devLogin(request, env, { email, name });
  return redirect("/", { headers });
}

const NO_MINE = new Set<number>();

export default function Login({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { google, dev, machines, nowMin } = loaderData;
  return (
    <main className="page bare">
      <div className="signin">
        <TopBar />
        <div className="signin-hero">
          <h2>Пралки без зошита</h2>
          <p>
            Записуйтеся на конкретну пралку й час. Нагадаємо за 15 хвилин до
            початку.
          </p>
        </div>
        <div className="glass preview" aria-label="Сьогодні на пралках">
          {machines.map((m) => (
            <div className="preview-row" key={m.id}>
              <span>{m.shortName}</span>
              <DayStrip
                label={m.shortName}
                bookings={m.slots}
                mineIds={NO_MINE}
                nowMin={nowMin}
                mini
              />
            </div>
          ))}
          <div className="legend">
            <span>
              <i
                style={{
                  background: "var(--free-soft)",
                  boxShadow: "inset 0 0 0 1px rgb(15 143 126 / .3)",
                }}
              />
              вільно
            </span>
            <span>
              <i style={{ background: "#b9c0cc" }} />
              зайнято
            </span>
            <span>
              <i
                style={{
                  background:
                    "repeating-linear-gradient(-45deg, rgb(16 18 23 / .25) 0 2px, transparent 2px 4px)",
                }}
              />
              запас {BUFFER_MIN} хв
            </span>
            <span>
              <i style={{ background: "var(--now)" }} />
              зараз
            </span>
          </div>
        </div>

        <div className="signin-actions">
          {google && (
            <Form method="post" action="/auth/google" reloadDocument>
              <button className="btn btn-primary block" type="submit">
                <Icon name="mail" />
                Увійти через пошту Політехніки
              </button>
            </Form>
          )}
          {!google && !dev && (
            <p className="error-note">
              Вхід ще не налаштовано. Спробуйте трохи пізніше.
            </p>
          )}
          {dev && (
            <Form method="post" className="glass form">
              <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
                Локальний вхід для розробки. У продакшені його немає.
              </p>
              {actionData?.error && (
                <p className="error-note" role="alert">
                  {actionData.error}
                </p>
              )}
              <div className="field-row">
                <label htmlFor="dev-name">Імʼя</label>
                <input
                  id="dev-name"
                  name="name"
                  defaultValue="Олена Гриценко"
                  required
                />
              </div>
              <div className="field-row">
                <label htmlFor="dev-email">Пошта</label>
                <input
                  id="dev-email"
                  name="email"
                  type="email"
                  defaultValue="olena.hrytsenko@lpnu.ua"
                  required
                />
              </div>
              <button className="btn btn-primary block" type="submit">
                Увійти
              </button>
            </Form>
          )}
          <p className="helper">
            Підійде лише адреса @lpnu.ua. Ми отримаємо імʼя та пошту, а кімнату
            ви вкажете самі.
          </p>
          <p className="credit">
            Незалежний студентський проєкт команди Софії Полупан.
            <br />
            Не є державним чи університетським сервісом.
          </p>
        </div>
      </div>
    </main>
  );
}
