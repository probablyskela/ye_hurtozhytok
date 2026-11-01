import { AnnouncementRow } from "~/components/announcement";
import { Credit, TopBar } from "~/components/ui";
import { agoLabel } from "~/lib/announcements";
import { listPending } from "~/lib/announcements.server";
import { requireProfile } from "~/lib/auth.server";
import { canPublishAnnouncements } from "~/lib/permissions";
import { kyivDateKey, kyivNow } from "~/lib/time";
import type { Route } from "./+types/announcements-review";

export const handle = { tab: "home" };
export const meta: Route.MetaFunction = () => [
  { title: "Пропозиції оголошень · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  if (!canPublishAnnouncements(me))
    throw new Response("Ця сторінка для студради й розпорядника.", {
      status: 403,
    });
  const today = kyivNow().date;
  const list = await listPending(env);
  return {
    list: list.map((a) => ({
      ...a,
      sub: `${a.author}${a.room ? `, ${a.room}` : ""} · ${agoLabel(kyivDateKey(a.createdAt), today)}`,
    })),
  };
}

export default function Review({ loaderData }: Route.ComponentProps) {
  const { list } = loaderData;
  return (
    <>
      <TopBar back="/" title="Пропозиції оголошень" />
      <p className="lede" style={{ margin: "0 4px 14px" }}>
        Від мешканців. Відкрийте пропозицію, щоб опублікувати її або відхилити з
        поясненням для автора.
      </p>
      {list.length ? (
        <div className="ann-list">
          {list.map((a) => (
            <AnnouncementRow a={{ ...a, date: null }} sub={a.sub} key={a.id} />
          ))}
        </div>
      ) : (
        <div className="glass empty">
          <b>Нових пропозицій немає</b>
          Коли хтось запропонує оголошення, прийде сповіщення.
        </div>
      )}
      <Credit />
    </>
  );
}
