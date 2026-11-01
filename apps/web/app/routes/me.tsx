import { Link } from "react-router";

import { Credit, Icon, type IconName } from "~/components/ui";
import { requireProfile } from "~/lib/auth.server";
import { MAX_ACTIVE, durationLabel, fmtMin } from "~/lib/booking";
import { upcomingFor } from "~/lib/bookings.server";
import { isCouncil, isSiteManager } from "~/lib/permissions";
import { initials, roomLabel } from "~/lib/profile";
import { ROLE_LABELS } from "~/lib/roles";
import { dayName, kyivNow } from "~/lib/time";
import type { Route } from "./+types/me";

export const handle = { tab: "me" };
export const meta: Route.MetaFunction = () => [{ title: "Моє · єГуртожиток" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const r = await requireProfile(request, env);
  const now = kyivNow();
  const list = await upcomingFor(env, r.id, now);
  return {
    name: r.name,
    room: r.room,
    telegram: r.telegram,
    blocked: r.blocked,
    roles: r.roles.map((role) => ROLE_LABELS[role]),
    council: isCouncil(r),
    siteManager: isSiteManager(r),
    today: now.date,
    bookings: list.map((b) => ({
      id: b.id,
      date: b.date,
      startMin: b.startMin,
      endMin: b.endMin,
      machine: b.machineName,
      running: b.date === now.date && b.startMin <= now.minute,
    })),
  };
}

function Row({
  to,
  icon,
  title,
  sub,
}: {
  to: string;
  icon: IconName;
  title: string;
  sub: string;
}) {
  return (
    <Link viewTransition className="list-row" to={to}>
      <span className="who-av">
        <Icon name={icon} small />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{title}</b>
        <span className="sub">{sub}</span>
      </span>
      <Icon name="chev" small />
    </Link>
  );
}

export default function Me({ loaderData }: Route.ComponentProps) {
  const p = loaderData;
  return (
    <>
      <div className="me" style={{ marginTop: 4 }}>
        <span className="me-av" aria-hidden="true">
          {initials(p.name)}
        </span>
        <div>
          <b>{p.name}</b>
          <span>
            {roomLabel(p.room)}
            {p.telegram ? ` · @${p.telegram}` : ""}
          </span>
        </div>
      </div>
      {p.roles.length > 0 && (
        <p className="role-tags" aria-label="Ваші ролі">
          {p.roles.map((label) => (
            <span className="council-tag" key={label}>
              {label}
            </span>
          ))}
        </p>
      )}
      {p.blocked && (
        <p className="error-note" role="alert">
          Ваш акаунт заблоковано: записуватися зараз не можна.
        </p>
      )}

      <div className="section-h">
        <h3>Мої записи</h3>
        <Link to="/laundry">Пральня</Link>
      </div>
      {p.bookings.length ? (
        <div className="glass" style={{ padding: "4px 0" }}>
          {p.bookings.map((b) => (
            <Link
              viewTransition
              className="list-row"
              to={`/bookings/${b.id}`}
              key={b.id}
            >
              <span
                className="who-av"
                style={
                  b.running
                    ? { background: "var(--mine)", color: "#fff" }
                    : { background: "var(--mine-soft)", color: "var(--mine)" }
                }
              >
                <Icon name="clock" small />
              </span>
              <span style={{ flex: 1 }}>
                <b>
                  {dayName(b.date, p.today)} · {fmtMin(b.startMin)}–
                  {fmtMin(b.endMin)}
                </b>
                <span className="sub">
                  {b.machine} ·{" "}
                  {b.running
                    ? "зараз ваш час"
                    : durationLabel(b.endMin - b.startMin)}
                </span>
              </span>
              <Icon name="chev" small />
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass empty">
          <b>Записів немає</b>
          Записатися можна в «Пральні».
        </div>
      )}
      <p className="muted" style={{ margin: "10px 4px 0", fontSize: 13.5 }}>
        Одночасно можна мати до {MAX_ACTIVE} записів.
      </p>

      <div className="section-h">
        <h3>Налаштування</h3>
      </div>
      <div className="glass" style={{ padding: "4px 0" }}>
        <Row
          to="/profile"
          icon="user"
          title="Профіль і сповіщення"
          sub="Кімната, Telegram, нагадування, вихід"
        />
      </div>

      {(p.council || p.siteManager) && (
        <>
          <div className="section-h">
            <h3>Робота</h3>
          </div>
          <div className="glass" style={{ padding: "4px 0" }}>
            {p.council && (
              <Row
                to="/council"
                icon="shield"
                title="Студрада"
                sub="Мешканці гуртожитку"
              />
            )}
            {p.siteManager && (
              <Row
                to="/roles"
                icon="user"
                title="Люди й ролі"
                sub="Усі мешканці та їхні ролі"
              />
            )}
          </div>
        </>
      )}
      <Credit />
    </>
  );
}
