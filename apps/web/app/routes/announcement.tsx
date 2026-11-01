import { Form, Link, data, redirect, useNavigation } from "react-router";

import { StatusPill, mediaUrl } from "~/components/announcement";
import { Check, ConfirmButton } from "~/components/controls";
import { Credit, Icon, TopBar } from "~/components/ui";
import { REASON_MAX, agoLabel, fmtTime, whenLabel } from "~/lib/announcements";
import {
  decideAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
} from "~/lib/announcements.server";
import { requireProfile } from "~/lib/auth.server";
import { kyivDateKey, kyivNow } from "~/lib/time";
import type { Route } from "./+types/announcement";

export const handle = { tab: "home" };
export const meta: Route.MetaFunction = ({ data }) => [
  { title: `${data?.a.title ?? "Оголошення"} · єГуртожиток` },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  const a = await getAnnouncement(env, me, Number(params.id));
  if (!a)
    throw new Response("Такого оголошення немає або воно не для вас.", {
      status: 404,
    });
  const today = kyivNow().date;
  const url = new URL(request.url);
  return {
    today,
    mine: a.authorId === me.id,
    sent: url.searchParams.get("sent") === "1",
    a: {
      id: a.id,
      title: a.title,
      body: a.body,
      place: a.place,
      date: a.date,
      startMin: a.startMin,
      important: a.important,
      status: a.status,
      rejectReason: a.rejectReason,
      images: a.images,
      author: a.author,
      published: a.publishedAt
        ? agoLabel(kyivDateKey(a.publishedAt), today)
        : null,
      decidedByName: a.decidedByName,
      canEdit: a.canEdit,
      canDecide: a.canDecide,
    },
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env, ctx } = context.cloudflare;
  const me = await requireProfile(request, env);
  const id = Number(params.id);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "delete") {
    const ok = await deleteAnnouncement(env, me, id);
    if (!ok) return data({ error: "Видалити не вдалося." }, { status: 403 });
    throw redirect("/");
  }
  const result = await decideAnnouncement(env, ctx, me, id, form);
  if (!result.ok) return data({ error: result.error }, { status: 400 });
  return { decided: result.status };
}

export default function AnnouncementPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { a, today, mine, sent } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const when = whenLabel(a.date, null, today);
  return (
    <>
      <TopBar back="/" title="Оголошення" />

      {sent && a.status === "pending" && (
        <p className="ok-note" role="status">
          Надіслано на розгляд. Коли студрада вирішить, прийде сповіщення.
        </p>
      )}
      {actionData && "decided" in actionData && (
        <p className="ok-note" role="status">
          {actionData.decided === "published"
            ? "Опубліковано."
            : "Відхилено, автор побачить пояснення."}
        </p>
      )}
      {actionData && "error" in actionData && (
        <p className="error-note" role="alert">
          {actionData.error}
        </p>
      )}

      {a.images.length > 0 && (
        <div
          className="gallery"
          role="group"
          aria-label={`Картинки: ${a.images.length}`}
        >
          {a.images.map((img, i) => (
            <a
              key={img.id}
              href={mediaUrl(img.key)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Відкрити картинку ${i + 1} з ${a.images.length}`}
            >
              <img
                src={mediaUrl(img.key)}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </a>
          ))}
        </div>
      )}

      <article className="glass ann-detail">
        <div className="ann-detail-top">
          {a.important && (
            <span className="ann-flag">
              <Icon name="bell" small />
              Важливе
            </span>
          )}
          <StatusPill status={a.status} />
        </div>
        <h2>{a.title}</h2>
        {(a.date || a.place) && (
          <div className="ann-when">
            {a.startMin !== null && (
              <span className="t">{fmtTime(a.startMin)}</span>
            )}
            <span className="d">
              {when && <b>{when}</b>}
              {a.place && <span>{a.place}</span>}
            </span>
          </div>
        )}
        {a.body && <p className="ann-body">{a.body}</p>}
        <p className="ann-by">
          {a.status === "published"
            ? `Опубліковано ${a.published}`
            : a.status === "pending"
              ? "Пропозиція чекає рішення студради"
              : "Не опубліковано"}
          {" · автор: "}
          {a.author}
        </p>
      </article>

      {a.status === "rejected" && a.rejectReason && (
        <div className="glass reason">
          <b>Чому не опубліковано</b>
          <p>{a.rejectReason}</p>
          {a.decidedByName && <small>Рішення: {a.decidedByName}</small>}
        </div>
      )}

      {a.canDecide && (
        <section className="decide">
          <div className="section-h">
            <h3>Рішення</h3>
          </div>
          <Form method="post" className="glass form">
            <Check
              name="important"
              title="Важливе"
              hint="Зверху на головній і сповіщення всім, хто їх увімкнув."
            />
            <button
              className="btn btn-primary block"
              type="submit"
              name="intent"
              value="publish"
              disabled={busy}
            >
              Опублікувати
            </button>
          </Form>
          <details className="glass reject">
            <summary>Відхилити з поясненням</summary>
            <Form method="post" className="form">
              <div className="field-row">
                <label htmlFor="reason">Що написати автору</label>
                <textarea
                  id="reason"
                  name="reason"
                  className="area"
                  rows={3}
                  maxLength={REASON_MAX}
                  required
                  placeholder="Наприклад: таке оголошення вже є, або бракує дати."
                />
              </div>
              <button
                className="btn btn-soft block"
                type="submit"
                name="intent"
                value="reject"
                disabled={busy}
              >
                Відхилити
              </button>
            </Form>
          </details>
        </section>
      )}

      {a.canEdit && (
        <div className="ann-actions">
          <Link
            viewTransition
            className="btn btn-soft"
            to={`/announcements/${a.id}/edit`}
          >
            <Icon name="pencil" small />
            Змінити
          </Link>
          <Form method="post" className="confirm-form">
            <ConfirmButton
              className="btn btn-ghost-danger block"
              name="intent"
              value="delete"
              question={
                mine && a.status === "pending"
                  ? "Забрати цю пропозицію?"
                  : "Видалити оголошення? Його більше ніхто не побачить."
              }
              yes={
                mine && a.status === "pending"
                  ? "Так, забрати"
                  : "Так, видалити"
              }
            >
              {mine && a.status === "pending" ? "Забрати" : "Видалити"}
            </ConfirmButton>
          </Form>
        </div>
      )}
      <Credit />
    </>
  );
}
