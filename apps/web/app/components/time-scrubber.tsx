import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BUFFER_MIN,
  CLOSE_MIN,
  OPEN_MIN,
  STEP_MIN,
  fmtMin,
  type Slot,
} from "~/lib/booking";

/** Pixels per 5-minute step: an hour is 96px, big enough for a thumb. */
const STEP_PX = 8;
const PX_PER_MIN = STEP_PX / STEP_MIN;
const STEPS = (CLOSE_MIN - OPEN_MIN) / STEP_MIN;

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

const STATUS_LABEL = {
  free: "Вільно",
  busy: "Зайнято",
  past: "Минуло",
  none: "Немає місця",
} as const;

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

export type ScrubberProps = {
  bookings: readonly (Slot & { id: number; mine?: boolean })[];
  len: number;
  nowMin: number | null;
  /** Starts that fit whole; the frame may only rest on one of these. */
  starts: readonly number[];
  value: number | null;
  onChange: (start: number | null) => void;
};

/**
 * The day scrolls under a fixed frame the size of the booking. Native
 * momentum scrolling with 5-minute snap points; if the frame comes to rest
 * on a busy time it glides to the nearest free start.
 */
export function TimeScrubber({
  bookings,
  len,
  nowMin,
  starts,
  value,
  onChange,
}: ScrubberProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [live, setLive] = useState<number>(value ?? starts[0] ?? OPEN_MIN);
  const [settling, setSettling] = useState(false);
  const [nudge, setNudge] = useState(0);
  const valid = useMemo(() => new Set(starts), [starts]);
  const frameW = len * PX_PER_MIN;
  const pad = Math.max(0, (width - frameW) / 2);
  const lastStep = useRef<number | null>(null);
  const programmatic = useRef(false);
  const programmaticTimer = useRef(0);
  const settleTimer = useRef(0);
  // A finger or the mouse is on the day: never glide away from under it.
  const holding = useRef(false);
  const movedWhileHolding = useRef(false);

  const startAt = useCallback(
    (left: number) => {
      const step = Math.round(left / STEP_PX);
      return Math.min(
        CLOSE_MIN - len,
        Math.max(OPEN_MIN, OPEN_MIN + step * STEP_MIN),
      );
    },
    [len],
  );

  const scrollToStart = useCallback((start: number, smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = true;
    window.clearTimeout(settleTimer.current);
    el.scrollTo({
      left: (start - OPEN_MIN) * PX_PER_MIN,
      behavior: smooth ? "smooth" : "auto",
    });
    window.clearTimeout(programmaticTimer.current);
    programmaticTimer.current = window.setTimeout(
      () => (programmatic.current = false),
      smooth ? 450 : 30,
    );
  }, []);

  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => {
      ro.disconnect();
      window.clearTimeout(programmaticTimer.current);
      window.clearTimeout(settleTimer.current);
    };
  }, []);

  // Follow the chosen start when the day is laid out again (first mount,
  // new free starts after a refresh, a new width). `value` is left out on
  // purpose: it changes while the person scrolls and must not pull back.
  useIso(() => {
    const target = value ?? starts[0] ?? null;
    if (target === null) return;
    setLive(target);
    scrollToStart(target, false);
  }, [len, starts, width]);

  const nearestValid = useCallback(
    (start: number) => {
      if (valid.has(start)) return start;
      if (starts.length === 0) return null;
      return starts.reduce(
        (best, s) => (Math.abs(s - start) < Math.abs(best - start) ? s : best),
        starts[0],
      );
    },
    [starts, valid],
  );

  const settle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = startAt(el.scrollLeft);
    const target = nearestValid(start);
    setSettling(false);
    if (target === null) {
      onChange(null);
      return;
    }
    if (target !== start) {
      setNudge((n) => n + 1);
      scrollToStart(target, true);
    }
    setLive(target);
    onChange(target);
  }, [nearestValid, onChange, scrollToStart, startAt]);

  const settleRef = useRef(settle);
  settleRef.current = settle;
  const queueSettle = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => settleRef.current(), 140);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const start = startAt(el.scrollLeft);
      setLive(start);
      const step = Math.round(el.scrollLeft / STEP_PX);
      if (
        lastStep.current !== null &&
        step !== lastStep.current &&
        "vibrate" in navigator &&
        !programmatic.current
      ) {
        try {
          navigator.vibrate(3);
        } catch {}
      }
      lastStep.current = step;
      if (programmatic.current) return;
      setSettling(true);
      if (holding.current) {
        movedWhileHolding.current = true;
        window.clearTimeout(settleTimer.current);
        return;
      }
      queueSettle();
    };
    const onTouchStart = () => {
      holding.current = true;
      movedWhileHolding.current = false;
      window.clearTimeout(settleTimer.current);
    };
    // Momentum keeps scrolling after the finger lifts and queues its own settle;
    // a finger that stopped before lifting needs one here. A plain tap does not.
    const onTouchEnd = () => {
      holding.current = false;
      if (movedWhileHolding.current) queueSettle();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      window.clearTimeout(settleTimer.current);
    };
  }, [queueSettle, startAt]);

  const choose = useCallback(
    (start: number) => {
      scrollToStart(start, true);
      setLive(start);
      onChange(start);
    },
    [onChange, scrollToStart],
  );

  /** Beginnings of free stretches: starts not directly after another start. */
  const windowStarts = useMemo(
    () => starts.filter((s, i) => i === 0 || s - starts[i - 1] !== STEP_MIN),
    [starts],
  );

  /**
   * The arrow buttons move by free window, not by 5 minutes: forward to the
   * beginning of the next free stretch, back to the beginning of this one or
   * the one before.
   */
  const jumpTarget = useCallback(
    (dir: 1 | -1, from: number) =>
      dir > 0
        ? windowStarts.find((s) => s > from)
        : windowStarts.filter((s) => s < from).at(-1),
    [windowStarts],
  );

  const jump = useCallback(
    (dir: 1 | -1) => {
      // While the frame still glides, count from where it is heading.
      const from = programmatic.current && value !== null ? value : live;
      const next = jumpTarget(dir, from);
      if (next !== undefined) choose(next);
    },
    [choose, jumpTarget, live, value],
  );

  /** A click or tap on the day centres the booking there (or on the nearest free start). */
  const placeAt = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const minute =
        OPEN_MIN + (clientX - rect.left + el.scrollLeft - pad) / PX_PER_MIN;
      const wanted = Math.round((minute - len / 2) / STEP_MIN) * STEP_MIN;
      const target = nearestValid(
        Math.min(CLOSE_MIN - len, Math.max(OPEN_MIN, wanted)),
      );
      if (target === null) return;
      if (target !== wanted) setNudge((n) => n + 1);
      choose(target);
    },
    [choose, len, nearestValid, pad],
  );

  // A mouse wheel moves the day one 5-minute step per notch; trackpads keep their own sideways scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = 0;
    let target: number | null = null;
    let idle = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      // Firefox may report lines (3 per notch) or pages instead of pixels.
      acc +=
        e.deltaY * (e.deltaMode === 1 ? 100 / 3 : e.deltaMode === 2 ? 100 : 1);
      const steps = Math.trunc(acc / 100);
      if (!steps) return;
      acc -= steps * 100;
      // Count from where the wheel is heading, not from a scroll still in flight.
      const max = el.scrollWidth - el.clientWidth;
      const from = target ?? Math.round(el.scrollLeft / STEP_PX) * STEP_PX;
      target = Math.min(max, Math.max(0, from + steps * STEP_PX));
      el.scrollTo({ left: target, behavior: "smooth" });
      window.clearTimeout(idle);
      idle = window.setTimeout(() => (target = null), 400);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(idle);
    };
  }, []);

  // Mouse: grab and drag the day like on a phone.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = e.currentTarget;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
    holding.current = true;
    movedWhileHolding.current = false;
    window.clearTimeout(settleTimer.current);
    el.style.scrollSnapType = "none";
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    e.currentTarget.scrollLeft = d.left - dx;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    holding.current = false;
    const el = e.currentTarget;
    if (el.hasPointerCapture(e.pointerId))
      el.releasePointerCapture(e.pointerId);
    suppressClick.current = d.moved;
    el.style.scrollSnapType = "";
    if (!d.moved) return;
    // Snap to the nearest 5-minute step where the drag ended, then settle.
    const left = Math.round(el.scrollLeft / STEP_PX) * STEP_PX;
    el.scrollTo({ left, behavior: "smooth" });
    queueSettle();
  };

  const free = valid.has(live);
  const past =
    nowMin !== null && live < Math.ceil(nowMin / STEP_MIN) * STEP_MIN;
  const status =
    starts.length === 0 ? "none" : free ? "free" : past ? "past" : "busy";
  const statusLabel = STATUS_LABEL[status];
  const x = (m: number) => (m - OPEN_MIN) * PX_PER_MIN;

  const hours: number[] = [];
  for (let h = OPEN_MIN / 60; h <= CLOSE_MIN / 60; h++) hours.push(h);

  return (
    <div className={`scrubber is-${status}${settling ? " is-moving" : ""}`}>
      {/* The readout changes on every step while the day moves; screen readers
          hear only the settled choice. */}
      <span aria-live="polite" style={VISUALLY_HIDDEN}>
        {value !== null && `Обрано ${fmtMin(value)}–${fmtMin(value + len)}`}
      </span>
      <div className="scrub-readout" aria-hidden="true">
        <span className="scrub-time">
          {fmtMin(live)}
          <span className="dash">–</span>
          {fmtMin(live + len)}
        </span>
        <span className="scrub-status">{statusLabel}</span>
      </div>

      <div className="scrub-window">
        <div
          ref={ref}
          className="scrub-track"
          style={{ paddingInline: pad, scrollPaddingInline: pad }}
          tabIndex={0}
          role="slider"
          aria-label="Початок запису"
          aria-valuemin={OPEN_MIN}
          aria-valuemax={CLOSE_MIN - len}
          aria-valuenow={live}
          aria-valuetext={`${fmtMin(live)}–${fmtMin(live + len)}, ${statusLabel.toLowerCase()}`}
          onKeyDown={(e) => {
            if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              const edge = e.key === "Home" ? starts[0] : starts.at(-1);
              if (edge !== undefined) choose(edge);
              return;
            }
            const dir =
              e.key === "ArrowRight" || e.key === "ArrowUp"
                ? 1
                : e.key === "ArrowLeft" || e.key === "ArrowDown"
                  ? -1
                  : 0;
            if (!dir) return;
            e.preventDefault();
            // Keys step to the neighbouring free start (5 minutes); buttons skip whole windows.
            const from = programmatic.current && value !== null ? value : live;
            const side = starts.filter((x) => (dir > 0 ? x > from : x < from));
            const next = dir > 0 ? side[0] : side.at(-1);
            if (next !== undefined) choose(next);
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={(e) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            placeAt(e.clientX);
          }}
        >
          <div
            className="scrub-day"
            style={{
              width: STEPS * STEP_PX + frameW,
              ["--frame" as string]: `${frameW}px`,
            }}
          >
            {Array.from({ length: STEPS + 1 }, (_, i) => (
              <span
                key={i}
                className="scrub-snap"
                style={{ left: i * STEP_PX }}
              />
            ))}
            {hours.map((h) => (
              <span key={h} className="scrub-hour" style={{ left: x(h * 60) }}>
                {String(h).padStart(2, "0")}
              </span>
            ))}
            <div className="scrub-band">
              {bookings.map((b) => (
                <span key={`b${b.id}`}>
                  {b.startMin - BUFFER_MIN >= OPEN_MIN && (
                    <span
                      className="seg-buf"
                      style={{
                        left: x(b.startMin - BUFFER_MIN),
                        width: BUFFER_MIN * PX_PER_MIN,
                      }}
                    />
                  )}
                  {b.endMin + BUFFER_MIN <= CLOSE_MIN && (
                    <span
                      className="seg-buf"
                      style={{
                        left: x(b.endMin),
                        width: BUFFER_MIN * PX_PER_MIN,
                      }}
                    />
                  )}
                  <span
                    className={b.mine ? "seg-mine" : "seg-busy"}
                    style={{
                      left: x(b.startMin),
                      width: (b.endMin - b.startMin) * PX_PER_MIN,
                    }}
                  />
                </span>
              ))}
              {nowMin !== null && nowMin > OPEN_MIN && (
                <span
                  className="seg-past"
                  style={{ width: x(Math.min(nowMin, CLOSE_MIN)) }}
                />
              )}
              {nowMin !== null && nowMin >= OPEN_MIN && nowMin < CLOSE_MIN && (
                <span className="scrub-now" style={{ left: x(nowMin) }} />
              )}
            </div>
          </div>
        </div>
        <div
          key={nudge}
          className="scrub-frame"
          style={{ width: frameW }}
          aria-hidden="true"
        >
          <span className="scrub-grip" />
          <span className="scrub-grip" />
        </div>
        <div className="scrub-fade left" aria-hidden="true" />
        <div className="scrub-fade right" aria-hidden="true" />
      </div>
      <div className="scrub-controls">
        <button
          type="button"
          className="icon-btn"
          aria-label="Попереднє вільне вікно"
          onClick={() => jump(-1)}
          disabled={jumpTarget(-1, live) === undefined}
        >
          <svg className="ico" aria-hidden="true">
            <use href="#i-back" />
          </svg>
        </button>
        <p className="scrub-hint">
          Тягніть шкалу або натисніть на вільне місце
        </p>
        <button
          type="button"
          className="icon-btn"
          aria-label="Наступне вільне вікно"
          onClick={() => jump(1)}
          disabled={jumpTarget(1, live) === undefined}
        >
          <svg className="ico" aria-hidden="true">
            <use href="#i-chev" />
          </svg>
        </button>
      </div>
    </div>
  );
}
