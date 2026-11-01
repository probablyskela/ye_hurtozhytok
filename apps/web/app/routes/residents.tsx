import {
  Form,
  Link,
  data,
  useNavigation,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { Check, ConfirmButton } from "~/components/controls";
import { Credit, TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import {
  canBlock,
  canManageRoles,
  canRevokeRole,
  isCouncil,
} from "~/lib/permissions";
import { fullName } from "~/lib/names";
import { roomLabel } from "~/lib/profile";
import { searchFrom } from "~/lib/search-params";
import { ROLES, ROLE_LABELS, type Role } from "~/lib/roles";
import { setBlocked } from "~/lib/residents.server";
import { listPeople, setRoles } from "~/lib/roles.server";
import type { Route } from "./+types/residents";

export const handle = { tab: "me" };
export const meta: Route.MetaFunction = () => [
  { title: "Мешканці · єГуртожиток" },
];

/** What each role lets a person do in the app today. */
const RIGHTS: Record<Role, string> = {
  council: "скасовує будь-які записи, бачить список мешканців",
  council_head: "те саме, що студрада",
  squad: "права зʼявляться з переїздом Оперети",
  squad_head: "права зʼявляться з переїздом Оперети",
  site_manager: "може все: права студради й оперзагону, ролі й блокування",
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
  if (!isCouncil(me))
    throw new Response("Ця сторінка для студради й розпорядника.", {
      status: 403,
    });
  const manage = canManageRoles(me);
  const people = await listPeople(env);
  const signedIn = people.filter((p) => p.residentId !== null);
  return {
    manage,
    stats: [
      { label: "зареєстровано", value: signedIn.length },
      {
        label: "вказали кімнату",
        value: signedIn.filter((p) => p.room).length,
      },
      { label: "заблоковано", value: signedIn.filter((p) => p.blocked).length },
    ],
    // Emails waiting for a first sign-in are only the site manager's business.
    people: (manage ? people : signedIn).map((p) => ({
      ...p,
      full:
        p.lastName || p.firstName
          ? fullName({
              firstName: p.firstName ?? "",
              lastName: p.lastName ?? "",
              patronymic: p.patronymic,
            })
          : (p.name ?? p.email),
      // Roles this person's checkbox may not untick (my own site-manager role).
      locked: manage
        ? p.roles.filter((role) => !canRevokeRole(me, { ...p, role }))
        : [],
      canBlock:
        p.residentId !== null &&
        canBlock(me, { id: p.residentId, roles: p.roles }),
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "grant" && form.getAll("role").length === 0)
    return data(
      { error: "Оберіть хоча б одну роль.", email: null },
      { status: 400 },
    );
  if (intent === "block" || intent === "unblock") {
    const ok = await setBlocked(
      env,
      me,
      Number(form.get("id")),
      intent === "block",
    );
    if (!ok)
      return data(
        { error: "Не вдалося змінити блокування.", email: null },
        { status: 403 },
      );
    return {
      email: String(form.get("email")),
      note:
        intent === "block"
          ? "Заблоковано: записуватися не можна, записи, що ще не почалися, скасовано."
          : "Розблоковано.",
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
  const pending = result.pending
    ? " Людина ще не входила — ролі увімкнуться після першого входу."
    : "";
  return {
    email: result.email,
    note:
      (parts.length
        ? `Збережено: ${parts.join("; ")}.`
        : "Нічого не змінилося.") + pending,
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

/** The same list of role checkboxes for a person and for a new email. */
function RoleChecks({
  label,
  checked,
  locked,
}: {
  label: string;
  checked: readonly Role[];
  locked: readonly Role[];
}) {
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      {ROLES.map((role) => {
        const isLocked = locked.includes(role);
        return (
          <div className="role-check" key={role}>
            <Check
              name="role"
              value={role}
              defaultChecked={checked.includes(role)}
              disabled={isLocked}
              title={ROLE_LABELS[role]}
              hint={
                isLocked
                  ? "свою роль розпорядника зняти не можна"
                  : RIGHTS[role]
              }
            />
            {isLocked && <input type="hidden" name="role" value={role} />}
          </div>
        );
      })}
    </fieldset>
  );
}

export default function Residents({
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
        `${p.full} ${p.room ?? ""} ${p.email} ${p.telegram ?? ""}`
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
      <TopBar back="/me" title="Мешканці" />
      <p className="lede" style={{ margin: "0 4px 14px" }}>
        {loaderData.manage
          ? "Кожен, хто увійшов через пошту Політехніки, — мешканець; роль лише додає права. Відкрийте людину, щоб змінити ролі чи заблокувати."
          : "Хто зареєструвався й де живе. Записи будь-кого можна скасувати на сторінці пралки."}
      </p>
      <dl className="glass council-stats">
        {loaderData.stats.map((x) => (
          <div key={x.label}>
            <dt>{x.label}</dt>
            <dd>{x.value}</dd>
          </div>
        ))}
      </dl>

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
        {people.map((p) => {
          const info = (
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{p.full}</b>
              <span className="sub">
                {p.residentId
                  ? `${roomLabel(p.room)} · ${p.email}${p.telegram ? ` · @${p.telegram}` : ""}`
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
          );
          if (!loaderData.manage)
            return (
              <div className="person" key={p.email}>
                <div className="person-row">{info}</div>
              </div>
            );
          return (
            <details
              className="person"
              key={p.email}
              open={savedFor === p.email || undefined}
            >
              <summary>
                {info}
                <span className="person-toggle" aria-hidden="true">
                  Ролі
                </span>
              </summary>
              <Form method="post" className="role-form" preventScrollReset>
                <input type="hidden" name="email" value={p.email} />
                <RoleChecks
                  label={`Ролі: ${p.full}`}
                  checked={p.roles}
                  locked={p.locked}
                />
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
              {p.canBlock && p.residentId !== null && (
                <Form method="post" className="role-form" preventScrollReset>
                  <input type="hidden" name="id" value={p.residentId} />
                  <input type="hidden" name="email" value={p.email} />
                  {p.blocked ? (
                    <button
                      className="btn btn-soft block"
                      type="submit"
                      name="intent"
                      value="unblock"
                    >
                      Розблокувати
                    </button>
                  ) : (
                    <ConfirmButton
                      className="btn btn-ghost-danger block"
                      name="intent"
                      value="block"
                      question={`Заблокувати: ${p.name ?? p.email}? Записи, що ще не почалися, буде скасовано.`}
                      yes="Так, заблокувати"
                    >
                      Заблокувати
                    </ConfirmButton>
                  )}
                </Form>
              )}
            </details>
          );
        })}
      </div>

      {loaderData.manage && (
        <details className="glass person add-by-email">
          <summary>
            <span style={{ flex: 1 }}>
              <b>Людини ще немає в списку?</b>
              <span className="sub">
                Видати ролі за поштою: увімкнуться після першого входу
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
            <RoleChecks label="Ролі" checked={[]} locked={[]} />
            <button
              className="btn btn-primary block"
              type="submit"
              name="intent"
              value="grant"
            >
              Видати ролі
            </button>
          </Form>
        </details>
      )}
      <Credit />
    </>
  );
}
