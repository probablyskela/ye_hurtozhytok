import { useEffect, useState } from "react";

type State = "loading" | "unsupported" | "denied" | "off" | "on" | "busy";

function urlBase64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function toB64url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The service worker registration, or an error if it never becomes ready. */
function swReady(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("sw")), 8000),
    ),
  ]);
}

async function post(body: unknown) {
  const res = await fetch("/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
}

/** Turns 15-minute reminders on or off for this device. Needs JavaScript and push support. */
export function ReminderSwitch({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [standalone, setStandalone] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true,
    );
    if (
      !vapidKey ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    swReady()
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidKey]);

  async function toggle() {
    const wasOn = state === "on";
    setState("busy");
    setFailed(false);
    if (wasOn) {
      try {
        const reg = await swReady();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await post({ op: "unsubscribe", endpoint: sub.endpoint }).catch(
            () => {},
          );
          await sub.unsubscribe();
        }
        setState("off");
      } catch {
        setFailed(true);
        setState("on");
      }
      return;
    }
    try {
      const reg = await swReady();
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await post({
        op: "subscribe",
        subscription: {
          endpoint: sub.endpoint,
          p256dh: toB64url(sub.getKey("p256dh")),
          auth: toB64url(sub.getKey("auth")),
        },
      });
      setState("on");
    } catch {
      setFailed(true);
      setState("off");
    }
  }

  const note =
    state === "unsupported"
      ? standalone
        ? "Цей браузер не підтримує сповіщення."
        : "На iPhone сповіщення працюють, коли єГуртожиток додано на початковий екран: «Поділитися» → «На початковий екран»."
      : state === "denied"
        ? "Сповіщення заборонені в налаштуваннях браузера. Дозвольте їх для цього сайту."
        : failed
          ? "Не вдалося змінити сповіщення. Спробуйте ще раз."
          : "Нагадаємо за 15 хвилин до початку на цьому пристрої.";
  const hasSwitch =
    state === "on" ||
    state === "off" ||
    state === "busy" ||
    state === "loading";

  return (
    <div className="glass notify">
      <span className="notify-ico">
        <svg className="ico" aria-hidden="true">
          <use href="#i-bell" />
        </svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <b>Нагадати за 15 хвилин</b>
          {/* While checking, the switch keeps its place unseen, so nothing moves. */}
          {hasSwitch && (
            <button
              className="switch"
              type="button"
              role="switch"
              aria-checked={state === "on"}
              aria-label="Нагадати за 15 хвилин"
              aria-hidden={state === "loading" ? true : undefined}
              style={state === "loading" ? { visibility: "hidden" } : undefined}
              disabled={state === "busy" || state === "loading"}
              onClick={toggle}
            />
          )}
        </div>
        <p aria-live="polite">{note}</p>
      </div>
    </div>
  );
}
