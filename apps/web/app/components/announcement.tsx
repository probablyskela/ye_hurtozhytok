import { Link } from "react-router";

import { Icon } from "~/components/ui";
import { fmtTime, whenLabel } from "~/lib/announcements";
import { WEEKDAYS_SHORT, dayOfMonth, weekdayIndex } from "~/lib/time";

/** A stored picture; served by the Worker after a permission check. */
export function mediaUrl(key: string) {
  return `/media/${key}`;
}

type Item = {
  id: number;
  title: string;
  body: string | null;
  place: string | null;
  date: string | null;
  startMin: number | null;
  important: boolean;
  status: "pending" | "published" | "rejected";
  cover: string | null;
  imageCount: number;
};

/** Weekday and day number, like a tear-off calendar leaf. */
export function CalendarLeaf({ date }: { date: string }) {
  return (
    <span className="cal-leaf" aria-hidden="true">
      <small>{WEEKDAYS_SHORT[weekdayIndex(date)]}</small>
      <b>{dayOfMonth(date)}</b>
    </span>
  );
}

export function StatusPill({
  status,
}: {
  status: "pending" | "published" | "rejected";
}) {
  if (status === "pending")
    return <span className="st review">На розгляді</span>;
  if (status === "rejected") return <span className="st no">Відхилено</span>;
  return null;
}

/** The important announcement: the largest card on the home page. */
export function ImportantCard({ a, today }: { a: Item; today: string }) {
  const when = whenLabel(a.date, null, today);
  return (
    <Link
      viewTransition
      className="glass ann-hero"
      to={`/announcements/${a.id}`}
    >
      {a.cover && (
        <img
          className="ann-cover"
          src={mediaUrl(a.cover)}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <span className="ann-flag">
        <Icon name="bell" small />
        Важливе
      </span>
      <h3 className="ann-title">{a.title}</h3>
      {a.date ? (
        <span className="ann-when">
          {a.startMin !== null && (
            <span className="t">{fmtTime(a.startMin)}</span>
          )}
          <span className="d">
            <b>{when}</b>
            {a.place && <span>{a.place}</span>}
          </span>
        </span>
      ) : (
        a.body && <span className="ann-excerpt">{a.body}</span>
      )}
    </Link>
  );
}

/** A row in the feed: a calendar leaf for events, a thumbnail when there is a picture. */
export function AnnouncementRow({
  a,
  sub,
}: {
  a: Item;
  /** What the second line says for undated news, e.g. «вчора». */
  sub?: string;
}) {
  return (
    <Link
      viewTransition
      className="glass ann-row"
      to={`/announcements/${a.id}`}
    >
      {a.date ? <CalendarLeaf date={a.date} /> : null}
      <span className="ann-row-text">
        <b>{a.title}</b>
        {!a.date && a.body && <span className="ann-excerpt">{a.body}</span>}
        <span className="meta">
          {a.startMin !== null && (
            <span>
              <Icon name="clock" small />
              {fmtTime(a.startMin)}
            </span>
          )}
          {a.place && (
            <span>
              <Icon name="pin" small />
              {a.place}
            </span>
          )}
          {!a.date && sub && <span>{sub}</span>}
          {a.imageCount > 1 && (
            <span>
              <Icon name="image" small />
              {a.imageCount}
            </span>
          )}
          <StatusPill status={a.status} />
        </span>
      </span>
      {a.cover && (
        <img
          className="ann-thumb"
          src={mediaUrl(a.cover)}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
    </Link>
  );
}
