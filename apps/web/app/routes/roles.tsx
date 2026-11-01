import { Form, data, useNavigation } from "react-router";

import { Credit, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { canManageRoles, canRevokeRole } from "~/lib/permissions";
import { ROLES, ROLE_LABELS } from "~/lib/roles";
import { grantRole, listGrants, revokeRole } from "~/lib/roles.server";
import type { Route } from "./+types/roles";

export const handle = { tab: "me" };
export const meta: Route.MetaFunction = () => [{ title: "Ролі · єГуртожиток" }];

/** What each role lets a person do in the app today. */
const RIGHTS: Record<(typeof ROLES)[number], string> = {
  council: "Скасовує будь-які записи на пралки, блокує мешканців.",
  council_head: "Те саме, що студрада.",
  squad: "Поки нічого нового: розділ загону зʼявиться з переїздом Оперети.",
  squad_head:
    "Поки нічого нового: розділ загону зʼявиться з переїздом Оперети.",
  site_manager: "Видає й знімає ролі.",
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  if (!canManageRoles(me))
    throw new Response("Ця сторінка лише для розпорядника.", { status: 403 });
  const grants = await listGrants(env);
  return {
    groups: ROLES.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      rights: RIGHTS[role],
      people: grants
        .filter((g) => g.role === role)
        .map((g) => ({
          id: g.id,
          email: g.email,
          name: g.name,
          room: g.room,
          canRevoke: canRevokeRole(me, g),
        })),
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  const form = await request.formData();
  if (form.get("intent") === "revoke") {
    const ok = await revokeRole(env, me, Number(form.get("id")));
    return data(
      ok ? { revoked: true as const } : { error: "Цю роль зняти не можна." },
      { status: ok ? 200 : 403 },
    );
  }
  const result = await grantRole(env, me, form);
  if (!result.ok) return data({ error: result.error }, { status: 400 });
  return {
    granted: `${result.email}: ${ROLE_LABELS[result.role]}.${
      result.pending
        ? " Людина ще не входила — роль увімкнеться після першого входу."
        : ""
    }`,
  };
}

export default function Roles({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  return (
    <>
      <TopBar back="/me" title="Ролі" />
      <p className="lede" style={{ margin: "0 4px 16px" }}>
        Без ролі кожен, хто увійшов через пошту Політехніки, — мешканець. Роль
        лише додає права. Видати її можна й тому, хто ще не входив.
      </p>

      {actionData && "error" in actionData && (
        <p className="error-note" role="alert">
          {actionData.error}
        </p>
      )}
      {actionData && "granted" in actionData && (
        <p className="ok-note" role="status">
          Видано: {actionData.granted}
        </p>
      )}
      {actionData && "revoked" in actionData && (
        <p className="ok-note" role="status">
          Роль знято.
        </p>
      )}

      <Form
        method="post"
        className="glass form"
        key={
          actionData && "granted" in actionData ? actionData.granted : "grant"
        }
      >
        <div className="field-row">
          <label htmlFor="role-email">Пошта</label>
          <input
            id="role-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="імʼя@lpnu.ua"
            required
          />
        </div>
        <div className="field-row">
          <label htmlFor="role-role">Роль</label>
          <select id="role-role" name="role" className="select" required>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary block"
          type="submit"
          name="intent"
          value="grant"
          disabled={busy}
        >
          Видати роль
        </button>
      </Form>

      {loaderData.groups.map((g) => (
        <section key={g.role}>
          <div className="section-h">
            <h3>{g.label}</h3>
            <span className="muted" style={{ fontSize: 13.5 }}>
              {g.people.length}
            </span>
          </div>
          <p
            className="muted"
            style={{ margin: "-4px 4px 10px", fontSize: 13.5 }}
          >
            {g.rights}
          </p>
          {g.people.length > 0 ? (
            <div className="glass" style={{ padding: "4px 0" }}>
              {g.people.map((p) => (
                <div className="list-row" key={p.id}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{p.name ?? p.email}</b>
                    <span className="sub">
                      {p.name
                        ? `${p.email}${p.room ? ` · кімната ${p.room}` : ""}`
                        : "чекає першого входу"}
                    </span>
                  </span>
                  {p.canRevoke && (
                    <Form method="post">
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        className="pill-btn danger"
                        type="submit"
                        name="intent"
                        value="revoke"
                        aria-label={`Зняти роль «${g.label}»: ${p.name ?? p.email}`}
                      >
                        Зняти
                      </button>
                    </Form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-note">Нікого.</p>
          )}
        </section>
      ))}
      <Credit />
    </>
  );
}
