import { useState } from "react";
import { Form, useNavigation } from "react-router";

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
            id="room"
            name="room"
            inputMode="numeric"
            pattern="[0-9]{3}"
            maxLength={3}
            required
            autoComplete="off"
            value={roomValue}
            onChange={(e) =>
              setRoom(e.target.value.replace(/\D/g, "").slice(0, 3))
            }
            aria-invalid={errors?.room ? true : undefined}
            aria-describedby="room-help"
          />
          <small
            id="room-help"
            style={errors?.room ? { color: "var(--danger)" } : undefined}
          >
            {errors?.room ?? "Три цифри, як на дверях. Обовʼязково."}
          </small>
        </div>
        <div className="field-row">
          <label htmlFor="tg">Імʼя користувача в Telegram</label>
          <div className="affix">
            <span aria-hidden="true">@</span>
            <input
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
              "Щоб вам могли написати, якщо пралка звільнилась раніше чи ви забули білизну. Необовʼязково."}
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
            кімната {roomValue || "—"}
            {tgPreview && <> · @{tgPreview}</>}
          </span>
        </div>
      </div>
    </>
  );
}
