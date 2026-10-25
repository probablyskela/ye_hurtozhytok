import { Outlet, useMatches } from "react-router";

import { TabBar } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import type { Route } from "./+types/app-layout";

export async function loader({ request, context }: Route.LoaderArgs) {
  const r = await requireProfile(request, context.cloudflare.env);
  return {
    resident: { id: r.id, name: r.name, role: r.role, blocked: r.blocked },
  };
}

type Tab = "home" | "book" | "bookings" | "profile" | null;

export default function AppLayout() {
  const matches = useMatches();
  const handle = matches.at(-1)?.handle as
    { tab?: Tab; sheet?: boolean; wide?: boolean } | undefined;
  return (
    <>
      <main className={handle?.wide ? "page wide" : "page"}>
        <Outlet />
      </main>
      {!handle?.sheet && <TabBar active={handle?.tab ?? null} />}
    </>
  );
}
