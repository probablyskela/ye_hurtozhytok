import { useEffect } from "react";

/**
 * Tells the page transition which way to slide, through
 * <html data-nav="left|right|forward|back">: between bottom-menu sections in
 * menu order, deeper into a section forward, «Назад» and browser back the
 * other way. Without JavaScript nothing slides and nothing breaks.
 */

// Section roots in menu order.
const SECTIONS: Record<string, number> = { "/": 0, "/laundry": 1, "/me": 2 };

function currentSection(): number | null {
  const tabs = [...document.querySelectorAll(".tabbar .tab")];
  const i = tabs.findIndex((t) => t.getAttribute("aria-current") === "page");
  return i >= 0 ? i : (SECTIONS[location.pathname] ?? null);
}

function directionFor(link: HTMLAnchorElement): string {
  const url = new URL(link.href, location.href);
  if (link.classList.contains("icon-btn")) return "back";
  const target = SECTIONS[url.pathname];
  if (target === undefined) return "forward";
  const from = currentSection();
  if (from === null || from === target)
    return SECTIONS[location.pathname] === undefined ? "back" : "forward";
  return target > from ? "right" : "left";
}

export function useNavDirection() {
  useEffect(() => {
    const root = document.documentElement;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (link instanceof HTMLAnchorElement && link.origin === location.origin)
        root.dataset.nav = directionFor(link);
    };
    const onBack = () => (root.dataset.nav = "back");
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onBack);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onBack);
    };
  }, []);
}
