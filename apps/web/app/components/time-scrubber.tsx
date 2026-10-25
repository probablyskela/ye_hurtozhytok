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
    el.scrollTo({
      left: (start - OPEN_MIN) * PX_PER_MIN,
      behavior: smooth ? "smooth" : "auto",
    });
    window.setTimeout(() => (programmatic.current = false), smooth ? 450 : 30);
  }, []);

  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Follow the chosen start when it changes from outside (another day, length or machine).
  useIso(() => {
    const target = value ?? starts[0] ?? null;
    if (target === null) return;
    setLive(target);
    scrollToStart(target, false);
  }, [len, starts, width]);

  const nearestValid = useCallback(
    (start: number) => {
      if (valid.has(start) || starts.length === 0)
        return valid.has(start) ? start : null;
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
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
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 140);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [settle, startAt]);

  /** Previous or next free start, for the arrow buttons and keys. */
  const jump = useCallback(
    (dir: 1 | -1) => {
      const side = starts.filter((s) => (dir > 0 ? s > live : s < live));
      const next = dir > 0 ? side[0] : side.at(-1);
      if (next === undefined) return;
      scrollToStart(next, true);
      setLive(next);
      onChange(next);
    },
    [live, onChange, scrollToStart, starts],
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
      scrollToStart(target, true);
      setLive(target);
      onChange(target);
    },
    [len, nearestValid, onChange, pad, scrollToStart],
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
      acc += e.deltaY;
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
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Mouse: grab and drag the day like on a phone.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = e.currentTarget;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
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
    const el = e.currentTarget;
    el.releasePointerCapture(e.pointerId);
    suppressClick.current = d.moved;
    // Snap to the nearest 5-minute step where the drag ended.
    const left = Math.round(el.scrollLeft / STEP_PX) * STEP_PX;
    el.style.scrollSnapType = "";
    if (d.moved) el.scrollTo({ left, behavior: "smooth" });
  };

  const free = valid.has(live);
  const past =
    nowMin !== null && live < Math.ceil(nowMin / STEP_MIN) * STEP_MIN;
  const status =
    starts.length === 0 ? "none" : free ? "free" : past ? "past" : "busy";
  const x = (m: number) => (m - OPEN_MIN) * PX_PER_MIN;

  const hours: number[] = [];
  for (let h = OPEN_MIN / 60; h <= CLOSE_MIN / 60; h++) hours.push(h);

  return (
    <div className={`scrubber is-${status}${settling ? " is-moving" : ""}`}>
      <div className="scrub-readout" aria-live="polite">
        <span className="scrub-time">
          {fmtMin(live)}
          <span className="dash">–</span>
          {fmtMin(live + len)}
        </span>
        <span className="scrub-status">
          {status === "free" && "Вільно"}
          {status === "busy" && "Зайнято — посуньте"}
          {status === "past" && "Уже минуло"}
          {status === "none" && "Немає вільного часу"}
        </span>
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
          aria-valuetext={`${fmtMin(live)}–${fmtMin(live + len)}, ${free ? "вільно" : "зайнято"}`}
          onKeyDown={(e) => {
            const dir =
              e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!dir) return;
            e.preventDefault();
            jump(dir);
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
          aria-label="Попередній вільний час"
          onClick={() => jump(-1)}
          disabled={!starts.some((x) => x < live)}
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
          aria-label="Наступний вільний час"
          onClick={() => jump(1)}
          disabled={!starts.some((x) => x > live)}
        >
          <svg className="ico" aria-hidden="true">
            <use href="#i-chev" />
          </svg>
        </button>
      </div>
    </div>
  );
}
