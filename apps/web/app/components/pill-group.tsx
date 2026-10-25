import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A horizontal switcher whose selection is one pill that slides to the
 * chosen item. Items are the direct children marked `data-pill-item`; the
 * current one carries `aria-current="true"`. The pill moves on tap, before
 * the next page data arrives. Without JavaScript the items keep their own
 * highlight (the `has-pill` class is added only after hydration).
 */
export function PillGroup({
  as: Tag = "nav",
  className,
  label,
  style,
  children,
}: {
  as?: "nav" | "div";
  className: string;
  label: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const location = useLocation();
  const [pending, setPending] = useState<number | null>(null);
  const [box, setBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [ready, setReady] = useState(false);

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const items = [
      ...el.querySelectorAll<HTMLElement>(":scope > [data-pill-item]"),
    ];
    const index =
      pending ??
      items.findIndex((i) => i.getAttribute("aria-current") === "true");
    const item = items[index];
    // Text colour follows the pill at once, not the page data.
    items.forEach((i, n) => i.toggleAttribute("data-pill-on", n === index));
    const next = item
      ? {
          x: item.offsetLeft,
          y: item.offsetTop,
          w: item.offsetWidth,
          h: item.offsetHeight,
        }
      : null;
    setBox((prev) =>
      prev &&
      next &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.w === next.w &&
      prev.h === next.h
        ? prev
        : next,
    );
  };
  const measureRef = useRef(measure);
  measureRef.current = measure;

  // New page data: the real selection takes over from the tap.
  useEffect(() => setPending(null), [location.key]);

  useIso(measure);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measureRef.current());
    ro.observe(el);
    document.fonts?.ready.then(() => measureRef.current());
    // Enable the transition only after the first placement, so it does not fly in from 0.
    const id = requestAnimationFrame(() => setReady(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`${className}${box ? " has-pill" : ""}`}
      aria-label={label}
      style={style}
      onClick={(e) => {
        // A link opened in a new tab or window does not change this page.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        const item = (e.target as HTMLElement).closest<HTMLElement>(
          "[data-pill-item]",
        );
        if (!item || item.parentElement !== ref.current) return;
        const items = [
          ...ref.current!.querySelectorAll(":scope > [data-pill-item]"),
        ];
        const n = items.indexOf(item);
        items.forEach((i, k) => i.toggleAttribute("data-pill-on", k === n));
        setPending(n);
        item.scrollIntoView?.({
          block: "nearest",
          inline: "nearest",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      }}
    >
      {box && (
        <span
          className={`pill${ready ? " pill-ready" : ""}`}
          aria-hidden="true"
          style={{
            width: box.w,
            height: box.h,
            transform: `translate(${box.x}px, ${box.y}px)`,
          }}
        />
      )}
      {children}
    </Tag>
  );
}
