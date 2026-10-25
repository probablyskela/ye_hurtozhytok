import type { ReactNode } from "react";
import { Link } from "react-router";

import {
  BUFFER_MIN,
  CLOSE_MIN,
  OPEN_MIN,
  fmtMin,
  type Slot,
} from "~/lib/booking";

export type IconName =
  | "washer"
  | "plus"
  | "user"
  | "back"
  | "clock"
  | "bell"
  | "cal"
  | "mail"
  | "info"
  | "check"
  | "chev"
  | "home"
  | "logout"
  | "shield";

/** One SVG sprite per page; icons reference it with <use>. */
export function IconSprite() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
    >
      <symbol id="i-washer" viewBox="0 0 24 24">
        <rect x="4" y="2.8" width="16" height="18.4" rx="3.5" />
        <circle cx="12" cy="13" r="4.6" />
        <path d="M9.6 13.6c1.1-.9 2.3.9 4.8 0" />
        <path d="M7.5 6h3" />
      </symbol>
      <symbol id="i-plus" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </symbol>
      <symbol id="i-user" viewBox="0 0 24 24">
        <circle cx="12" cy="8.5" r="3.8" />
        <path d="M4.8 20c1.2-3.6 4-5.3 7.2-5.3s6 1.7 7.2 5.3" />
      </symbol>
      <symbol id="i-back" viewBox="0 0 24 24">
        <path d="M14.5 5.5 8 12l6.5 6.5" />
      </symbol>
      <symbol id="i-clock" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.6" />
        <path d="M12 7.5V12l3 2" />
      </symbol>
      <symbol id="i-bell" viewBox="0 0 24 24">
        <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" />
        <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
      </symbol>
      <symbol id="i-cal" viewBox="0 0 24 24">
        <rect x="3.8" y="5" width="16.4" height="15.2" rx="3.2" />
        <path d="M3.8 9.8h16.4M8.3 3v4M15.7 3v4" />
      </symbol>
      <symbol id="i-mail" viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="14" rx="3.2" />
        <path d="m4 7 8 6 8-6" />
      </symbol>
      <symbol id="i-info" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.6" />
        <path d="M12 11v5.2M12 7.8v.2" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path d="m5.5 12.5 4 4 9-9.5" />
      </symbol>
      <symbol id="i-chev" viewBox="0 0 24 24">
        <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
      </symbol>
      <symbol id="i-home" viewBox="0 0 24 24">
        <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z" />
      </symbol>
      <symbol id="i-logout" viewBox="0 0 24 24">
        <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" />
        <path d="M10 8l-4 4 4 4M6 12h9" />
      </symbol>
      <symbol id="i-shield" viewBox="0 0 24 24">
        <path d="M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </symbol>
      <symbol id="porthole" viewBox="0 0 200 200">
        <circle
          cx="100"
          cy="100"
          r="96"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
        <circle
          cx="100"
          cy="100"
          r="74"
          fill="none"
          stroke="#fff"
          strokeWidth="10"
        />
        <circle
          cx="100"
          cy="100"
          r="52"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <path
          d="M58 112c18-14 30 12 56 0s26-12 34-6"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
      </symbol>
      <symbol id="logo-facade" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="lf-ink" x1="0" y1="0" x2=".6" y2="1">
            <stop offset="0" stopColor="#2b2f38" />
            <stop offset="1" stopColor="#0d0f14" />
          </linearGradient>
          <linearGradient id="lf-mine" x1="0" y1="0" x2=".7" y2="1">
            <stop offset="0" stopColor="#4250ee" />
            <stop offset="1" stopColor="#1b23a3" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="23" fill="url(#lf-ink)" />
        <g fill="rgb(255 255 255 / .16)">
          <rect x="20" y="20" width="16" height="16" rx="4.5" />
          <rect x="64" y="20" width="16" height="16" rx="4.5" />
          <rect x="42" y="42" width="16" height="16" rx="4.5" />
          <rect x="20" y="64" width="16" height="16" rx="4.5" />
          <rect x="64" y="64" width="16" height="16" rx="4.5" />
        </g>
        <g fill="#fff">
          <rect x="42" y="20" width="16" height="16" rx="4.5" />
          <rect x="20" y="42" width="16" height="16" rx="4.5" />
          <rect x="42" y="64" width="16" height="16" rx="4.5" />
        </g>
        <rect
          x="64"
          y="42"
          width="16"
          height="16"
          rx="4.5"
          fill="url(#lf-mine)"
        />
      </symbol>
    </svg>
  );
}

export function Icon({ name, small }: { name: IconName; small?: boolean }) {
  return (
    <svg className={small ? "ico sm" : "ico"} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="єГуртожиток, головна">
      <svg className="mark" aria-hidden="true">
        <use href="#logo-facade" />
      </svg>
      <span className="wordmark">єГуртожиток</span>
    </Link>
  );
}

export function Field() {
  return <div className="field" aria-hidden="true" />;
}

export function BackButton({ to }: { to: string }) {
  return (
    <Link className="icon-btn" to={to} aria-label="Назад" viewTransition>
      <Icon name="back" />
    </Link>
  );
}

export function TopBar({
  back,
  title,
  right,
}: {
  back?: string;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <div className="topbar">
      {back ? <BackButton to={back} /> : <Brand />}
      {title && <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>}
      {right ?? (back ? <span style={{ width: 44 }} /> : null)}
    </div>
  );
}

const pct = (m: number) =>
  `${(((m - OPEN_MIN) / (CLOSE_MIN - OPEN_MIN)) * 100).toFixed(3)}%`;
const wid = (a: number, z: number) =>
  `${(((z - a) / (CLOSE_MIN - OPEN_MIN)) * 100).toFixed(3)}%`;

/** A machine's day as one capsule ribbon (the signature move). */
export function DayStrip({
  label,
  bookings,
  mineIds,
  nowMin,
  pick,
  mini,
}: {
  label: string;
  bookings: readonly (Slot & { id: number })[];
  mineIds: ReadonlySet<number>;
  nowMin: number | null;
  pick?: Slot | null;
  mini?: boolean;
}) {
  const aria = bookings.length
    ? `${label}: зайнято ${bookings.map((b) => `${fmtMin(b.startMin)}–${fmtMin(b.endMin)}`).join(", ")}`
    : `${label}: увесь день вільно`;
  return (
    <div className="strip" role="img" aria-label={aria}>
      <div className="strip-track">
        {bookings.flatMap((b) => [
          b.startMin - BUFFER_MIN >= OPEN_MIN ? (
            <span
              key={`a${b.id}`}
              className="seg-buf"
              style={{
                left: pct(b.startMin - BUFFER_MIN),
                width: wid(b.startMin - BUFFER_MIN, b.startMin),
              }}
            />
          ) : null,
          b.endMin + BUFFER_MIN <= CLOSE_MIN ? (
            <span
              key={`z${b.id}`}
              className="seg-buf"
              style={{
                left: pct(b.endMin),
                width: wid(b.endMin, b.endMin + BUFFER_MIN),
              }}
            />
          ) : null,
        ])}
        {bookings.map((b) => (
          <span
            key={b.id}
            className={mineIds.has(b.id) ? "seg-mine" : "seg-busy"}
            style={{ left: pct(b.startMin), width: wid(b.startMin, b.endMin) }}
          />
        ))}
        {nowMin !== null && nowMin > OPEN_MIN && (
          <span
            className="seg-past"
            style={{ width: wid(OPEN_MIN, Math.min(nowMin, CLOSE_MIN)) }}
          />
        )}
        {pick && (
          <span
            key="pick"
            className="seg-pick"
            style={{
              left: pct(pick.startMin),
              width: wid(pick.startMin, pick.endMin),
            }}
          />
        )}
      </div>
      {nowMin !== null && nowMin >= OPEN_MIN && nowMin < CLOSE_MIN && (
        <span className="strip-now" style={{ left: pct(nowMin) }} />
      )}
      {!mini && <StripScale />}
    </div>
  );
}

export function StripScale({ className }: { className?: string }) {
  return (
    <div
      className={`strip-scale${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <span>06</span>
      <span>12</span>
      <span>18</span>
      <span>24</span>
    </div>
  );
}

/** The booking as a document card. */
export function Ticket({
  to,
  heading,
  startMin,
  endMin,
  machine,
  footLeft,
  footRight,
  status,
  big,
  vtName,
  celebrate,
}: {
  vtName?: string;
  celebrate?: boolean;
  to?: string;
  heading: string;
  startMin: number;
  endMin: number;
  machine: string;
  footLeft: ReactNode;
  footRight?: ReactNode;
  status?: string;
  big?: boolean;
}) {
  const body = (
    <>
      <svg className="porthole" aria-hidden="true">
        <use href="#porthole" />
      </svg>
      {celebrate && (
        <span className="splash" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      {status && (
        <div className="ticket-top">
          <span className="ticket-tag">
            <span className="dot" />
            {status}
          </span>
        </div>
      )}
      <div
        className="ticket-when"
        style={status ? undefined : { marginTop: 0 }}
      >
        {heading}
      </div>
      <div className="ticket-time">
        {fmtMin(startMin)}
        <span className="dash">–</span>
        {fmtMin(endMin)}
      </div>
      <div className="ticket-machine">{machine}</div>
      <div className="ticket-foot">
        <span>{footLeft}</span>
        {footRight}
      </div>
    </>
  );
  const cls = `ticket${big ? " big" : " compact"}${celebrate ? " celebrate" : ""}`;
  const vt = vtName ? { viewTransitionName: vtName } : undefined;
  return to ? (
    <Link
      className={cls}
      to={to}
      viewTransition
      style={{ display: "block", textDecoration: "none", ...vt }}
    >
      {body}
    </Link>
  ) : (
    <div className={cls} style={vt}>
      {body}
    </div>
  );
}

export function TabBar({
  active,
}: {
  active: "home" | "book" | "bookings" | "profile" | null;
}) {
  return (
    <nav className="tabbar" aria-label="Розділи">
      <Link
        viewTransition
        className="tab"
        to="/"
        aria-current={active === "home" ? "page" : undefined}
      >
        <Icon name="home" />
        Головна
      </Link>
      <Link className="tab-main" to="/book" viewTransition>
        <Icon name="plus" />
        Записатися
      </Link>
      <Link
        viewTransition
        className="tab"
        to="/bookings"
        aria-current={active === "bookings" ? "page" : undefined}
      >
        <Icon name="cal" />
        Мої записи
      </Link>
    </nav>
  );
}

export function Port({ free }: { free: boolean }) {
  return (
    <span className={`port ${free ? "free" : "busy"}`} aria-hidden="true" />
  );
}

/** The team behind the app: one quiet line, never a banner. */
export const TEAM_CREDIT =
  "Зроблено командою Софії Полупан — кандидатки на посаду голови студради.";

export function Credit({ children }: { children?: ReactNode }) {
  return (
    <p className="credit">
      {children}
      {children && <br />}
      {TEAM_CREDIT}
    </p>
  );
}
