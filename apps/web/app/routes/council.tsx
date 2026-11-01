import {
  Form,
  data,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { fullName } from "~/lib/names";
import { roomLabel } from "~/lib/profile";
import { searchFrom } from "~/lib/search-params";
import { canBlock, isCouncil } from "~/lib/permissions";
import { isRole } from "~/lib/roles";
import { listResidents, setBlocked } from "~/lib/residents.server";
import type { Route } from "./+types/council";

export const handle = { tab: "me" };
export const meta: Route.MetaFunction = () => [
  { title: "Студрада · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  if (!isCouncil(me))
    throw new Response("Ця сторінка лише для студради.", { status: 403 });
  const people = await listResidents(env);
  return {
    people: people.map((raw) => {
      const p = {
        ...raw,
        roles: (raw.roles?.split(",") ?? []).filter(isRole),
      };
      return {
        ...p,
        full:
          p.lastName || p.firstName
            ? fullName({
                firstName: p.firstName ?? "",
                lastName: p.lastName ?? "",
                patronymic: p.patronymic,
              })
            : p.name,
        council: isCouncil(p),
        canBlock: canBlock(me, p),
      };
    }),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  const form = await request.formData();
  const ok = await setBlocked(
    env,
    me,
    Number(form.get("id")),
    form.get("intent") === "block",
  );
  return data(ok ? { ok: true } : { error: "Не вдалося змінити блокування." }, {
    status: ok ? 200 : 403,
  });
}

/** Typing in the search only filters the list already on the page. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function Council({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("q") ?? "";
  const q = raw.trim().toLowerCase();
  const people = loaderData.people.filter(
    (p) =>
      !q ||
      `${p.full} ${p.room ?? ""} ${p.email} ${p.telegram ?? ""}`
        .toLowerCase()
        .includes(q),
  );
  const all = loaderData.people;
  const stats = [
    { label: "зареєстровано", value: all.length },
    { label: "вказали кімнату", value: all.filter((p) => p.room).length },
    { label: "заблоковано", value: all.filter((p) => p.blocked).length },
  ];
  return (
    <>
      <TopBar back="/me" title="Студрада" />
      <p className="lede">
        Записи будь-кого можна скасувати на сторінці пралки. Тут — блокування
        мешканців.
      </p>
      <dl className="glass council-stats">
        {stats.map((x) => (
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
        style={{ marginBottom: 14 }}
        onChange={(e) =>
          setParams(searchFrom(e.currentTarget), { replace: true })
        }
      >
        <label htmlFor="q">Пошук</label>
        <input
          id="q"
          name="q"
          defaultValue={raw}
          placeholder="Імʼя, кімната або пошта"
          autoComplete="off"
        />
      </Form>
      <div className="glass" style={{ padding: "4px 0" }}>
        {people.length === 0 && <p className="empty">Нікого не знайдено.</p>}
        {people.map((p) => (
          <div className="list-row" key={p.id}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>
                {p.full}{" "}
                {p.council && <span className="council-tag">студрада</span>}
              </b>
              <span className="sub">
                {roomLabel(p.room)} · {p.email}
                {p.telegram ? ` · @${p.telegram}` : ""}
              </span>
            </span>
            {p.canBlock && (
              <Form
                method="post"
                replace
                preventScrollReset
                onSubmit={(e) => {
                  if (
                    !p.blocked &&
                    !confirm(
                      `Заблокувати: ${p.name}? Записи цієї людини, які ще не почалися, буде скасовано.`,
                    )
                  )
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={p.id} />
                <input
                  type="hidden"
                  name="intent"
                  value={p.blocked ? "unblock" : "block"}
                />
                <button
                  className={`pill-btn${p.blocked ? "" : " danger"}`}
                  type="submit"
                >
                  {p.blocked ? "Розблокувати" : "Заблокувати"}
                </button>
              </Form>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
