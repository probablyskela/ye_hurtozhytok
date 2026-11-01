import { data, redirect } from "react-router";

import { AnnouncementForm } from "~/components/announcement-form";
import { Credit, TopBar } from "~/components/ui";
import { createAnnouncement } from "~/lib/announcements.server";
import { requireProfile } from "~/lib/auth.server";
import {
  canProposeAnnouncement,
  canPublishAnnouncements,
} from "~/lib/permissions";
import type { Route } from "./+types/announcement-new";

export const handle = { tab: "home" };
export const meta: Route.MetaFunction = () => [
  { title: "Нове оголошення · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const me = await requireProfile(request, context.cloudflare.env);
  if (!canProposeAnnouncement(me))
    throw new Response("Ваш акаунт заблоковано.", { status: 403 });
  return { canPublish: canPublishAnnouncements(me) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.cloudflare;
  const me = await requireProfile(request, env);
  const result = await createAnnouncement(
    env,
    ctx,
    me,
    await request.formData(),
  );
  if (!result.ok) return data({ errors: result.errors }, { status: 400 });
  throw redirect(
    `/announcements/${result.id}${result.status === "pending" ? "?sent=1" : ""}`,
  );
}

export default function NewAnnouncement({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { canPublish } = loaderData;
  return (
    <>
      <TopBar
        back="/"
        title={canPublish ? "Нове оголошення" : "Запропонувати оголошення"}
      />
      {!canPublish && (
        <p className="lede" style={{ margin: "0 4px 14px" }}>
          Будь-хто може запропонувати оголошення. Студрада перегляне його й
          опублікує або напише, чому ні.
        </p>
      )}
      <AnnouncementForm
        canPublish={canPublish}
        errors={actionData?.errors}
        submitLabel={canPublish ? "Опублікувати" : "Надіслати на розгляд"}
      />
      <Credit />
    </>
  );
}
