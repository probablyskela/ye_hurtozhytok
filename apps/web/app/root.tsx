import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { Field, IconSprite } from "./components/ui";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
  { rel: "manifest", href: "/manifest.webmanifest" },
];

export const meta: Route.MetaFunction = () => [
  { title: "єГуртожиток" },
  { name: "description", content: "Запис на пралки гуртожитку №14." },
  { name: "theme-color", content: "#e6eef6" },
  { name: "apple-mobile-web-app-capable", content: "yes" },
  { name: "apple-mobile-web-app-title", content: "єГуртожиток" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <IconSprite />
        <Field />
        {children}
        <ScrollRestoration />
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(()=>document.documentElement.classList.add("booted"),1500);if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));`,
          }}
        />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Щось пішло не так";
  let details = "Спробуйте оновити сторінку.";
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) title = "Такої сторінки немає";
    if (error.status === 403) title = "Немає доступу";
    if (typeof error.data === "string" && error.data) details = error.data;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <main className="page bare">
      <div className="topbar" />
      <h2 className="title">{title}</h2>
      <p className="lede">{details}</p>
      <Link className="btn btn-primary" to="/">
        На головну
      </Link>
    </main>
  );
}
