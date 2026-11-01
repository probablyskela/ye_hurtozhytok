import { useEffect, useRef, useState } from "react";

import { Icon } from "~/components/ui";

/**
 * «Поділитися»: the phone's own share sheet (Telegram, Instagram, …); where
 * there is none, the link is copied, and if even that is refused it is shown
 * ready to copy. Needs JavaScript, so it appears only once the page is live.
 */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [live, setLive] = useState(false);
  const [state, setState] = useState<"idle" | "copied" | "show">("idle");
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => setLive(true), []);
  useEffect(() => {
    if (state === "show") field.current?.select();
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);
  if (!live) return null;

  const url = new URL(path, window.location.origin).href;
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (e) {
        // Closing the sheet is not a failure.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("show");
    }
  }

  return (
    <div className="share">
      <button type="button" className="btn btn-soft block" onClick={share}>
        <Icon name={state === "copied" ? "check" : "share"} small />
        {state === "copied" ? "Посилання скопійовано" : "Поділитися"}
      </button>
      {state === "show" && (
        <input
          ref={field}
          className="share-url"
          readOnly
          value={url}
          aria-label="Посилання на оголошення"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
      <small>Відкриють ті, хто входить з поштою Політехніки.</small>
    </div>
  );
}
