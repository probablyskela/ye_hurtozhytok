import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

/**
 * Quietly refreshes loader data while the page is visible, so bookings made or
 * cancelled by others show up without a manual reload.
 */
export function usePolling(intervalMs = 20_000) {
  const revalidator = useRevalidator();
  const ref = useRef(revalidator);
  ref.current = revalidator;

  useEffect(() => {
    const id = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        ref.current.state === "idle"
      ) {
        void ref.current.revalidate();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
