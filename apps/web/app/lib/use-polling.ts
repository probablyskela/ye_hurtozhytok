import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

/**
 * Quietly refreshes loader data while the page is visible, so changes made by
 * others (a taken task, a filled shift) show up without a manual reload.
 */
export function usePolling(intervalMs = 15_000) {
  const revalidator = useRevalidator();
  const ref = useRef(revalidator);
  ref.current = revalidator;

  useEffect(() => {
    const id = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        ref.current.state === "idle"
      ) {
        void ref.current.revalidate();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
