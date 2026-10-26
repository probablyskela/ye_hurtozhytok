import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { ROOM_MAX, roomLabel } from "~/lib/profile";

/** Room (required) and Telegram username (optional), with a live preview of how others see you. */
export function ProfileForm({
  name,
  room,
  telegram,
  errors,
  submitLabel,
  saved,
}: {
  name: string;
  room: string | null;
  telegram: string | null;
  errors?: Partial<Record<"room" | "telegram", string>>;
  submitLabel: string;
  saved?: boolean;
}) {
  const [roomValue, setRoom] = useState(room ?? "");
  const [tgValue, setTg] = useState(telegram ?? "");
  const busy = useNavigation().state === "submitting";
  const roomRef = useRef<HTMLInputElement>(null);
  const tgRef = useRef<HTMLInputElement>(null);
  // After a rejected save, take the person to the first field to fix; its
  // help text (now the error) is read out with it.
  useEffect(() => {
    if (errors?.room) roomRef.current?.focus();
    else if (errors?.telegram) tgRef.current?.focus();
  }, [errors]);
  const tgPreview = tgValue
    .replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, "")
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9_]/g, "");
  return (
    <>
      <Form method="post" className="glass form" replace>
        <input type="hidden" name="intent" value="profile" />
        {saved && (
          <p className="ok-note" role="status">
            Збережено.
          </p>
        )}
        <div className="field-row">
          <label htmlFor="room">Кімната</label>
          <input
            ref={roomRef}
            id="room"
            name="room"
            maxLength={ROOM_MAX}
            required
            autoComplete="off"
            value={roomValue}
            onChange={(e) => setRoom(e.target.value)}
            aria-invalid={errors?.room ? true : undefined}
            aria-describedby="room-help"
          />
          <small
            id="room-help"
            style={errors?.room ? { color: "var(--danger)" } : undefined}
          >
            {errors?.room ?? "Номер чи назва: 612, 1б, робочка. Обовʼязково."}
          </small>
        </div>
        <div className="field-row">
          <label htmlFor="tg">
            Імʼя користувача в Telegram{" "}
            <span className="opt">необовʼязково</span>
          </label>
          <div className="affix">
            <span aria-hidden="true">@</span>
            <input
              ref={tgRef}
              id="tg"
              name="telegram"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={tgValue}
              onChange={(e) => setTg(e.target.value)}
              aria-invalid={errors?.telegram ? true : undefined}
              aria-describedby="tg-help"
            />
          </div>
          <small
            id="tg-help"
            style={errors?.telegram ? { color: "var(--danger)" } : undefined}
          >
            {errors?.telegram ??
              "Щоб вам могли написати, якщо пралка звільнилась раніше чи ви забули білизну. Можна лишити порожнім."}
          </small>
        </div>
        <button className="btn btn-primary block" type="submit" disabled={busy}>
          {busy ? "Зберігаємо…" : submitLabel}
        </button>
      </Form>
      <div className="preview-who">
        <small>Так вас бачать інші біля запису</small>
        <div className="tl-block tl-busy who-demo">
          <span className="n">{name}</span>
          <span className="c">
            {roomLabel(roomValue.trim() || null)}
            {tgPreview && <> · @{tgPreview}</>}
          </span>
        </div>
      </div>
    </>
  );
}
