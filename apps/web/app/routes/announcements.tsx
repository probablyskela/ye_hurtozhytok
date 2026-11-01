import { AnnouncementRow } from "~/components/announcement";
import { Credit, TopBar } from "~/components/ui";
import { agoLabel } from "~/lib/announcements";
import { listPublished } from "~/lib/announcements.server";
import { requireProfile } from "~/lib/auth.server";
import { kyivDateKey, kyivNow } from "~/lib/time";
import type { Route } from "./+types/announcements";

export const handle = { tab: "home" };
export const meta: Route.MetaFunction = () => [
  { title: "Усі оголошення · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  const today = kyivNow().date;
  const list = await listPublished(env, me);
  return {
    list: list.map((a) => ({
      ...a,
      ago: a.publishedAt ? agoLabel(kyivDateKey(a.publishedAt), today) : "",
    })),
  };
}

export default function Announcements({ loaderData }: Route.ComponentProps) {
  const { list } = loaderData;
  return (
    <>
      <TopBar back="/" title="Усі оголошення" />
      {list.length ? (
        <div className="ann-list">
          {list.map((a) => (
            <AnnouncementRow a={a} sub={a.ago} key={a.id} />
          ))}
        </div>
      ) : (
        <div className="glass empty">
          <b>Оголошень поки немає</b>
          Опубліковані оголошення збираються тут, навіть коли подія минула.
        </div>
      )}
      <Credit />
    </>
  );
}
