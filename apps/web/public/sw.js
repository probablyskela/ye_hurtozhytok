// єГуртожиток service worker: offline read-only pages and booking reminders.
// Bump the version when the caching rules change: activate drops older caches.
const CACHE = "eh-v6";

// The home page with announcements, announcements themselves, the laundry
// page and machine pages are kept for offline reading; «Моє», profile,
// bookings, forms, the review queue, council and roles are never cached.
// Logout clears everything. React Router fetches page data from
// "<path>.data" ("/_root.data" for "/"), so data requests follow the same rule.
const pagePath = (path) =>
  path === "/_root.data"
    ? "/"
    : path.endsWith(".data")
      ? path.slice(0, -5)
      : path;
const OFFLINE_OK = (path) =>
  path === "/" ||
  path === "/laundry" ||
  path.startsWith("/machines/") ||
  path === "/announcements" ||
  /^\/announcements\/\d+$/.test(path);

// The error text and the online flag help tell a real loss of network from a
// failed request on a phone that is online.
const escape = (text) =>
  text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const offlineHtml = (error) => `<!doctype html>
<html lang="uk">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Немає зʼєднання · єГуртожиток</title>
<body style="margin:0;padding:24px 16px;font:16px/1.5 system-ui,sans-serif;background:#edf2f8;color:#101217">
<h1 style="margin:0 0 8px;font-size:22px">Немає зʼєднання</h1>
<p style="margin:0 0 16px">Без інтернету можна переглянути лише головну з оголошеннями, пральню й сторінки пралок, які ви вже відкривали. Записатися, скасувати запис чи запропонувати оголошення можна, коли зʼєднання повернеться.</p>
<p style="margin:0 0 16px"><a href="" style="color:#2a37d8;font-weight:600">Спробувати ще</a> · <a href="/" style="color:#2a37d8;font-weight:600">На головну</a></p>
<p style="margin:0;font-size:13px;color:#5b6270">Для розробника: ${escape(String(error && error.message ? `${error.name}: ${error.message}` : error))}; мережа ${self.navigator.onLine ? "є" : "немає"}.</p>
</body>
</html>`;

const keep = (req, res) => {
  if (res.status !== 200 || res.type !== "basic") return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy));
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/favicon.svg", "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (
    url.origin !== location.origin ||
    url.pathname.startsWith("/auth") ||
    url.pathname === "/push"
  )
    return;

  // Built assets have hashed names and announcement pictures never change
  // under their key: cache first.
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/media/")
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            keep(req, res);
            return res;
          }),
      ),
    );
    return;
  }

  const offlineOk = OFFLINE_OK(pagePath(url.pathname));

  // Pages kept for offline reading: network first, the last copy when offline.
  // Other pages are left to the browser: the worker has nothing to add there,
  // and some phones fail navigations it handles while being online.
  if (req.mode === "navigate") {
    if (!offlineOk) return;
    event.respondWith(
      fetch(req)
        .then((res) => {
          keep(req, res);
          return res;
        })
        .catch((error) =>
          caches.match(req).then(
            (hit) =>
              hit ||
              new Response(offlineHtml(error), {
                status: 503,
                headers: { "Content-Type": "text/html; charset=utf-8" },
              }),
          ),
        ),
    );
    return;
  }

  // Page data for the same pages, so a page opened offline survives its 20-second refresh.
  if (offlineOk && url.pathname.endsWith(".data")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          keep(req, res);
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "logout") event.waitUntil(caches.delete(CACHE));
});

self.addEventListener("push", (event) => {
  let data = { title: "єГуртожиток", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      lang: "uk",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", location.origin)
    .href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const open = list.find((c) => c.url.startsWith(location.origin));
        if (open) return open.navigate(url).then((c) => c && c.focus());
        return self.clients.openWindow(url);
      }),
  );
});
