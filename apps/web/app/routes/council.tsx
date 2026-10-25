import {
  Form,
  data,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { TopBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { fullName } from "~/lib/names";
import { canBlock, isCouncil } from "~/lib/permissions";
import { listResidents, setBlocked } from "~/lib/residents.server";
import type { Route } from "./+types/council";

export const handle = { tab: "profile" };
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
    people: people.map((p) => ({
      ...p,
      full:
        p.lastName || p.firstName
          ? fullName({
              firstName: p.firstName ?? "",
              lastName: p.lastName ?? "",
              patronymic: p.patronymic,
            })
          : p.name,
      canBlock: canBlock(me, p),
    })),
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
  return (
    <>
      <TopBar back="/profile" title="Студрада" />
      <p className="lede">
        Записи будь-кого можна скасувати на сторінці пралки. Тут — блокування
        мешканців.
      </p>
      {actionData && "error" in actionData && (
        <p className="error-note" role="alert">
          {actionData.error}
        </p>
      )}
      <Form
        className="field-row"
        style={{ marginBottom: 14 }}
        onChange={(e) =>
          setParams(new FormData(e.currentTarget) as never, { replace: true })
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
                {p.role === "council" && (
                  <span className="council-tag">студрада</span>
                )}
              </b>
              <span className="sub">
                кімната {p.room ?? "—"} · {p.email}
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
