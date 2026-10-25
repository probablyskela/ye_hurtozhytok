import { redirect } from "react-router";

import { logout } from "~/lib/auth.server";
import type { Route } from "./+types/logout";

export async function action({ request, context }: Route.ActionArgs) {
  return logout(request, context.cloudflare.env);
}

export function loader() {
  return redirect("/profile");
}
