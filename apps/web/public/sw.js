// єГуртожиток service worker: offline read-only pages and booking reminders.
const CACHE = "eh-v1";
const OFFLINE_PAGES = ["/"];

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

  // Built assets have hashed names: cache first.
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network first, the last copy when offline (booking still needs the network).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match(OFFLINE_PAGES[0]))
            .then(
              (hit) =>
                hit ||
                new Response(
                  "<meta charset=utf-8><p style='font:16px system-ui;padding:24px'>Немає зʼєднання. Спробуйте пізніше.</p>",
                  {
                    headers: { "Content-Type": "text/html; charset=utf-8" },
                  },
                ),
            ),
        ),
    );
  }
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
      badge: "/icons/icon-192.png",
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
