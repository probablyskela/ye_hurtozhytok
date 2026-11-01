import { Outlet, useMatches } from "react-router";

import { TabBar, type Tab } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { useNavDirection } from "~/lib/nav-direction";
import { skipForPhotoViewer } from "~/lib/revalidate";
import type { Route } from "./+types/app-layout";

export const shouldRevalidate = skipForPhotoViewer;

export async function loader({ request, context }: Route.LoaderArgs) {
  const r = await requireProfile(request, context.cloudflare.env);
  return {
    resident: { id: r.id, name: r.name, roles: r.roles, blocked: r.blocked },
  };
}

export default function AppLayout() {
  useNavDirection();
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
