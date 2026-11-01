import { Form } from "react-router";

import { ProfileForm } from "~/components/profile-form";
import { ReminderSwitch } from "~/components/reminder-switch";
import { Credit, Icon, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { initials } from "~/lib/profile";
import { saveProfile } from "~/lib/residents.server";
import type { Route } from "./+types/profile";

export const handle = { tab: "me" };
export const meta: Route.MetaFunction = () => [
  { title: "Профіль · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const r = await requireProfile(request, env);
  return {
    name: r.name,
    email: r.email,
    room: r.room,
    telegram: r.telegram,
    blocked: r.blocked,
    vapidKey: env.VAPID_PUBLIC_KEY ?? "",
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const resident = await requireProfile(request, env);
  const result = await saveProfile(env, resident, await request.formData());
  return result.ok ? { saved: true as const } : { errors: result.errors };
}

export default function Profile({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const p = loaderData;
  return (
    <>
      <TopBar back="/me" title="Профіль" />
      <div className="me">
        <span className="me-av" aria-hidden="true">
          {initials(p.name)}
        </span>
        <div>
          <b>{p.name}</b>
          <span>{p.email}</span>
        </div>
      </div>
      <p className="me-note">Імʼя та пошта беруться з акаунта Політехніки.</p>
      {p.blocked && (
        <p className="error-note">
          Студрада заблокувала ваш акаунт: записуватися зараз не можна.
        </p>
      )}

      <ProfileForm
        name={p.name}
        room={p.room}
        telegram={p.telegram}
        errors={
          actionData && "errors" in actionData ? actionData.errors : undefined
        }
        saved={!!actionData && "saved" in actionData}
        submitLabel="Зберегти"
      />

      <ReminderSwitch vapidKey={p.vapidKey} />

      <Form
        method="post"
        action="/logout"
        reloadDocument
        onSubmit={async (e) => {
          const form = e.currentTarget;
          if (form.dataset.done) return;
          e.preventDefault();
          try {
            const reg = await navigator.serviceWorker?.getRegistration();
            const sub = await reg?.pushManager.getSubscription();
            if (sub) {
              await fetch("/push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  op: "unsubscribe",
                  endpoint: sub.endpoint,
                }),
                // A slow network must not keep the person signed in.
                signal: AbortSignal.timeout?.(4000),
              });
              await sub.unsubscribe();
            }
            reg?.active?.postMessage("logout");
            for (const key of await caches.keys()) await caches.delete(key);
          } catch {
            // Logging out must never fail because of the cache or push.
          }
          form.dataset.done = "1";
          form.requestSubmit();
        }}
      >
        <button
          className="btn btn-ghost-danger block"
          type="submit"
          style={{ marginTop: 14 }}
        >
          <Icon name="logout" small />
          Вийти
        </button>
      </Form>
      <Credit>
        Кімнату й імʼя користувача в Telegram бачать лише ті, хто увійшов через
        пошту Політехніки.
      </Credit>
    </>
  );
}
