import { data, redirect } from "react-router";

import { AnnouncementForm } from "~/components/announcement-form";
import { Credit, TopBar } from "~/components/ui";
import {
  getAnnouncement,
  updateAnnouncement,
} from "~/lib/announcements.server";
import { requireProfile } from "~/lib/auth.server";
import { canPublishAnnouncements } from "~/lib/permissions";
import { kyivNow } from "~/lib/time";
import type { Route } from "./+types/announcement-edit";

export const handle = { tab: "home" };
export const meta: Route.MetaFunction = () => [
  { title: "Змінити оголошення · єГуртожиток" },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const me = await requireProfile(request, env);
  const a = await getAnnouncement(env, me, Number(params.id));
  if (!a || !a.canEdit)
    throw new Response("Це оголошення змінити не можна.", { status: 403 });
  return {
    id: a.id,
    canPublish: canPublishAnnouncements(me),
    today: kyivNow().date,
    initial: {
      title: a.title,
      body: a.body,
      place: a.place,
      date: a.date,
      startMin: a.startMin,
      important: a.important,
      images: a.images.map((i) => ({ id: i.id, key: i.key })),
    },
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env, ctx } = context.cloudflare;
  const me = await requireProfile(request, env);
  const id = Number(params.id);
  const result = await updateAnnouncement(
    env,
    ctx,
    me,
    id,
    await request.formData(),
  );
  if (!result)
    throw new Response("Це оголошення змінити не можна.", { status: 403 });
  if (!result.ok) return data({ errors: result.errors }, { status: 400 });
  throw redirect(`/announcements/${id}`);
}

export default function EditAnnouncement({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { id, canPublish, initial, today } = loaderData;
  return (
    <>
      <TopBar back={`/announcements/${id}`} title="Змінити оголошення" />
      <AnnouncementForm
        today={today}
        initial={initial}
        canPublish={canPublish}
        errors={actionData?.errors}
        submitLabel="Зберегти"
      />
      <Credit />
    </>
  );
}
