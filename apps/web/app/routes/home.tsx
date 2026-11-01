import { Link } from "react-router";

import { AnnouncementRow, ImportantCard } from "~/components/announcement";
import { Credit, Icon } from "~/components/ui";
import { agoLabel, feedSections } from "~/lib/announcements";
import { countPending, listPublished } from "~/lib/announcements.server";
import { requireProfile } from "~/lib/auth.server";
import {
  canProposeAnnouncement,
  canPublishAnnouncements,
} from "~/lib/permissions";
import { initials, vocative } from "~/lib/profile";
import { kyivDateKey, kyivNow } from "~/lib/time";
import { usePolling } from "~/lib/use-polling";
import type { Route } from "./+types/home";

export const handle = { tab: "home" };
export const meta: Route.MetaFunction = () => [{ title: "єГуртожиток" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  const nowMs = Date.now();
  const today = kyivNow(nowMs).date;
  const decider = canPublishAnnouncements(me);
  const [list, pending] = await Promise.all([
    listPublished(env, me),
    decider ? countPending(env) : Promise.resolve(0),
  ]);
  const s = feedSections(list, today, nowMs);
  const ago = (ms: number | null) =>
    ms ? agoLabel(kyivDateKey(ms), today) : "";
  return {
    name: me.name,
    firstName: me.firstName ?? me.name.split(" ")[0],
    today,
    canPropose: canProposeAnnouncement(me),
    decider,
    pending,
    important: s.important,
    upcoming: s.upcoming,
    fresh: s.fresh.map((a) => ({ ...a, ago: ago(a.publishedAt) })),
    more: s.history.length,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  usePolling(60_000);
  const p = loaderData;
  const first = vocative(p.firstName);
  const empty = p.important.length + p.upcoming.length + p.fresh.length === 0;
  return (
    <>
      <div className="topbar">
        <span className="brand">
          <svg className="mark" aria-hidden="true">
            <use href="#logo-facade" />
          </svg>
          <span className="wordmark">єГуртожиток</span>
        </span>
        <Link
          className="avatar"
          to="/me"
          aria-label={`Моє: ${p.name}`}
          style={{ textDecoration: "none" }}
        >
          {initials(p.name)}
        </Link>
      </div>
      <h2 className="title" style={{ marginBottom: 16 }}>
        {first ? `Привіт, ${first}` : "Привіт!"}
      </h2>

      {p.decider && p.pending > 0 && (
        <Link
          viewTransition
          className="glass list-row attention"
          to="/announcements/review"
        >
          <span className="who-av">
            <Icon name="horn" small />
          </span>
          <span style={{ flex: 1 }}>
            <b>Пропозиції оголошень</b>
            <span className="sub">Чекають вашого рішення</span>
          </span>
          <span className="count-pill">{p.pending}</span>
        </Link>
      )}

      <div className="ann-feed">
        {p.important.map((a) => (
          <ImportantCard a={a} today={p.today} key={a.id} />
        ))}

        {p.upcoming.length > 0 && (
          <section>
            <div className="section-h">
              <h3>Найближчі події</h3>
            </div>
            <div className="ann-list">
              {p.upcoming.map((a) => (
                <AnnouncementRow a={a} key={a.id} />
              ))}
            </div>
          </section>
        )}

        {p.fresh.length > 0 && (
          <section>
            <div className="section-h">
              <h3>Нове</h3>
            </div>
            <div className="ann-list">
              {p.fresh.map((a) => (
                <AnnouncementRow a={a} sub={a.ago} key={a.id} />
              ))}
            </div>
          </section>
        )}

        {empty && (
          <div className="glass empty">
            <b>Оголошень поки немає</b>
            Тут будуть збори, відключення води, прибирання й новини гуртожитку.
          </div>
        )}
      </div>

      <div className="home-actions">
        {p.canPropose && (
          <Link
            viewTransition
            className="btn btn-soft block"
            to="/announcements/new"
          >
            <Icon name="plus" />
            {p.decider ? "Нове оголошення" : "Запропонувати оголошення"}
          </Link>
        )}
        <Link viewTransition className="history" to="/announcements">
          Усі оголошення
          {p.more > 0 && <small>ще {p.more} в історії</small>}
          <Icon name="chev" small />
        </Link>
      </div>
      <Credit />
    </>
  );
}
