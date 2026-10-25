import { Link, redirect } from "react-router";

import { TopBar } from "~/components/ui";
import { finishGoogleLogin } from "~/lib/auth.server";
import type { Route } from "./+types/auth-callback";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  if (url.searchParams.get("error"))
    return { error: "Вхід скасовано. Спробуйте ще раз." };
  const result = await finishGoogleLogin(request, context.cloudflare.env);
  if (!result.ok) return { error: result.error };
  throw redirect(result.needsProfile ? "/welcome" : "/", {
    headers: result.headers,
  });
}

export default function AuthCallback({ loaderData }: Route.ComponentProps) {
  return (
    <main className="page bare">
      <TopBar />
      <h2 className="title">Не вдалося увійти</h2>
      <p className="error-note" role="alert">
        {loaderData.error}
      </p>
      <Link className="btn btn-primary block" to="/login">
        Спробувати ще раз
      </Link>
    </main>
  );
}
