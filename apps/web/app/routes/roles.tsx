import {
  Form,
  Link,
  data,
  useNavigation,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { Credit, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { canManageRoles, canRevokeRole } from "~/lib/permissions";
import { roomLabel } from "~/lib/profile";
import { searchFrom } from "~/lib/search-params";
import { ROLES, ROLE_LABELS, type Role } from "~/lib/roles";
import { grantRole, listPeople, setRoles } from "~/lib/roles.server";
import type { Route } from "./+types/roles";

export const handle = { tab: "me" };
export const meta: Route.MetaFunction = () => [
  { title: "Люди й ролі · єГуртожиток" },
];

/** What each role lets a person do in the app today. */
const RIGHTS: Record<Role, string> = {
  council: "скасовує будь-які записи, блокує мешканців",
  council_head: "те саме, що студрада",
  squad: "права зʼявляться з переїздом Оперети",
  squad_head: "права зʼявляться з переїздом Оперети",
  site_manager: "видає й знімає ролі",
};

const FILTERS = [
  { id: "all", label: "Усі" },
  { id: "council", label: "Студрада" },
  { id: "squad", label: "Оперзагін" },
  { id: "site_manager", label: "Розпорядник" },
  { id: "none", label: "Без ролі" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

function matches(f: FilterId, roles: readonly Role[]) {
  if (f === "all") return true;
  if (f === "none") return roles.length === 0;
  if (f === "council")
    return roles.includes("council") || roles.includes("council_head");
  if (f === "squad")
    return roles.includes("squad") || roles.includes("squad_head");
  return roles.includes("site_manager");
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  if (!canManageRoles(me))
    throw new Response("Ця сторінка лише для розпорядника.", { status: 403 });
  const people = await listPeople(env);
  return {
    people: people.map((p) => ({
      ...p,
      // Roles this person's checkbox may not untick (my own site-manager role).
      locked: p.roles.filter((role) => !canRevokeRole(me, { ...p, role })),
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  const form = await request.formData();
  if (form.get("intent") === "grant") {
    const result = await grantRole(env, me, form);
    if (!result.ok)
      return data({ error: result.error, email: null }, { status: 400 });
    return {
      email: result.email,
      note: `Видано: ${ROLE_LABELS[result.role]}.${
        result.pending
          ? " Людина ще не входила — роль увімкнеться після першого входу."
          : ""
      }`,
    };
  }
  const result = await setRoles(env, me, form);
  if (!result.ok)
    return data({ error: result.error, email: null }, { status: 400 });
  const parts = [
    result.added.length &&
      `додано: ${result.added.map((r) => ROLE_LABELS[r]).join(", ")}`,
    result.removed.length &&
      `знято: ${result.removed.map((r) => ROLE_LABELS[r]).join(", ")}`,
    result.kept.length && "свою роль розпорядника зняти не можна",
  ].filter(Boolean);
  return {
    email: result.email,
    note: parts.length
      ? `Збережено: ${parts.join("; ")}.`
      : "Нічого не змінилося.",
  };
}

/** Search and filters only narrow the list already on the page. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function Roles({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const [params, setParams] = useSearchParams();
  const raw = params.get("q") ?? "";
  const q = raw.trim().toLowerCase();
  const f = (FILTERS.find((x) => x.id === params.get("f"))?.id ??
    "all") as FilterId;
  const all = loaderData.people;
  const people = all.filter(
    (p) =>
      matches(f, p.roles) &&
      (!q ||
        `${p.name ?? ""} ${p.room ?? ""} ${p.email} ${p.telegram ?? ""}`
          .toLowerCase()
          .includes(q)),
  );
  const savedFor = actionData && "note" in actionData ? actionData.email : null;
  const busyFor =
    navigation.state === "submitting"
      ? navigation.formData?.get("email")
      : null;
  const link = (next: Partial<Record<"f" | "q", string>>) => {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next))
      if (v && v !== "all") sp.set(k, v);
      else sp.delete(k);
    const s = sp.toString();
    return s ? `?${s}` : ".";
  };

  return (
    <>
      <TopBar back="/me" title="Люди й ролі" />
      <p className="lede" style={{ margin: "0 4px 14px" }}>
        Без ролі кожен, хто увійшов через пошту Політехніки, — мешканець. Роль
        лише додає права; у людини їх може бути кілька.
      </p>

      {actionData && "error" in actionData && (
        <p className="error-note" role="alert">
          {actionData.error}
        </p>
      )}

      <Form
        className="field-row"
        style={{ marginBottom: 10 }}
        onChange={(e) =>
          setParams(searchFrom(e.currentTarget), { replace: true })
        }
      >
        <label htmlFor="q">Пошук</label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={raw}
          placeholder="Імʼя, кімната або пошта"
          autoComplete="off"
        />
        {f !== "all" && <input type="hidden" name="f" value={f} />}
      </Form>

      <nav className="filter-row" aria-label="Показати">
        {FILTERS.map((x) => (
          <Link
            key={x.id}
            className="chip"
            to={link({ f: x.id })}
            replace
            preventScrollReset
            aria-current={f === x.id ? "true" : undefined}
          >
            {x.label}
            <small>{all.filter((p) => matches(x.id, p.roles)).length}</small>
          </Link>
        ))}
      </nav>

      <div className="glass people" style={{ padding: "4px 0" }}>
        {people.length === 0 && <p className="empty">Нікого не знайдено.</p>}
        {people.map((p) => (
          <details
            className="person"
            key={p.email}
            open={savedFor === p.email || undefined}
          >
            <summary>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{p.name ?? p.email}</b>
                <span className="sub">
                  {p.residentId
                    ? `${roomLabel(p.room)} · ${p.email}`
                    : "чекає першого входу"}
                  {p.blocked ? " · заблоковано" : ""}
                </span>
                {p.roles.length > 0 && (
                  <span className="person-roles">
                    {p.roles.map((r) => (
                      <span className="council-tag" key={r}>
                        {ROLE_LABELS[r]}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="person-toggle" aria-hidden="true">
                Ролі
              </span>
            </summary>
            <Form method="post" className="role-form" preventScrollReset>
              <input type="hidden" name="email" value={p.email} />
              <fieldset>
                <legend className="sr-only">Ролі: {p.name ?? p.email}</legend>
                {ROLES.map((role) => {
                  const locked = p.locked.includes(role);
                  return (
                    <label className="role-check" key={role}>
                      <input
                        type="checkbox"
                        name="role"
                        value={role}
                        defaultChecked={p.roles.includes(role)}
                        disabled={locked}
                      />
                      {locked && (
                        <input type="hidden" name="role" value={role} />
                      )}
                      <span>
                        <b>{ROLE_LABELS[role]}</b>
                        <small>
                          {locked
                            ? "свою роль розпорядника зняти не можна"
                            : RIGHTS[role]}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              {savedFor === p.email && actionData && "note" in actionData && (
                <p className="ok-note" role="status" style={{ margin: 0 }}>
                  {actionData.note}
                </p>
              )}
              <button
                className="btn btn-primary block"
                type="submit"
                name="intent"
                value="set"
                disabled={busyFor === p.email}
              >
                {busyFor === p.email ? "Зберігаємо…" : "Зберегти ролі"}
              </button>
            </Form>
          </details>
        ))}
      </div>

      <details className="glass person add-by-email">
        <summary>
          <span style={{ flex: 1 }}>
            <b>Людини ще немає в списку?</b>
            <span className="sub">
              Видати роль за поштою: увімкнеться після першого входу
            </span>
          </span>
          <span className="person-toggle" aria-hidden="true">
            Додати
          </span>
        </summary>
        <Form method="post" className="role-form">
          <div className="field-row">
            <label htmlFor="grant-email">Пошта</label>
            <input
              id="grant-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="імʼя@lpnu.ua"
              required
            />
          </div>
          <div className="field-row">
            <label htmlFor="grant-role">Роль</label>
            <select id="grant-role" name="role" className="select" required>
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
          >
            Видати роль
          </button>
        </Form>
      </details>
      <Credit />
    </>
  );
}
