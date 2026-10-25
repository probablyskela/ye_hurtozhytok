import { startGoogleLogin } from "~/lib/auth.server";
import type { Route } from "./+types/auth-google";

export async function action({ request, context }: Route.ActionArgs) {
  return startGoogleLogin(request, context.cloudflare.env);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return startGoogleLogin(request, context.cloudflare.env);
}
