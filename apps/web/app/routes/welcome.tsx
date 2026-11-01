import { redirect } from "react-router";

import { ProfileForm } from "~/components/profile-form";
import { TopBar } from "~/components/ui";
import { requireResident } from "~/lib/auth.server";
import { safeNext } from "~/lib/next-path";
import { vocative } from "~/lib/profile";
import { saveProfile } from "~/lib/residents.server";
import type { Route } from "./+types/welcome";

export const meta: Route.MetaFunction = () => [
  { title: "Профіль · єГуртожиток" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const resident = await requireResident(request, context.cloudflare.env);
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  if (resident.room) throw redirect(next ?? "/");
  return {
    name: resident.name,
    firstName: resident.firstName ?? resident.name.split(" ")[0],
    telegram: resident.telegram,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const resident = await requireResident(request, env);
  const result = await saveProfile(env, resident, await request.formData());
  if (!result.ok) return { errors: result.errors };
  throw redirect(
    safeNext(new URL(request.url).searchParams.get("next")) ?? "/",
  );
}

/** First run: no back button and no tabs; the room is the only way forward. */
export default function Welcome({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const first = vocative(loaderData.firstName);
  return (
    <main className="page bare">
      <TopBar />
      <h2 className="title">{first ? `Вітаємо, ${first}` : "Вітаємо!"}</h2>
      <p className="lede">
        Залишився один крок: вкажіть кімнату, щоб інші знали, чий запис.
      </p>
      <ProfileForm
        name={loaderData.name}
        room={null}
        telegram={loaderData.telegram}
        errors={actionData?.errors}
        submitLabel="Продовжити"
      />
    </main>
  );
}
