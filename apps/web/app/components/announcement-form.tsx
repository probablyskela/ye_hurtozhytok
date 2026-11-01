import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { mediaUrl } from "~/components/announcement";
import { Icon } from "~/components/ui";
import {
  BODY_MAX,
  IMAGE_TYPES,
  MAX_IMAGES,
  PLACE_MAX,
  TITLE_MAX,
  type AnnouncementErrors,
} from "~/lib/announcements";
import { MINUTE_STEP } from "~/lib/date-fields";
import { MONTHS_GENITIVE } from "~/lib/time";

type Initial = {
  title: string;
  body: string | null;
  place: string | null;
  date: string | null;
  startMin: number | null;
  important: boolean;
  images: { id: number; key: string }[];
};

/** Longest side of a picture after the phone shrinks it. */
const MAX_SIDE = 1600;

/** Shrinks a photo on the phone; returns the original if anything goes wrong. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600_000 && file.type !== "image/heic")
      return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.82),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function Field({
  id,
  label,
  optional,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field-row">
      <label htmlFor={id}>
        {label} {optional && <span className="opt">необовʼязково</span>}
      </label>
      {children}
      {error ? (
        <small className="field-error" id={`${id}-error`}>
          {error}
        </small>
      ) : (
        hint && <small>{hint}</small>
      )}
    </div>
  );
}

/** New pictures: shrunk on the phone, previewed, removable; plain upload without JavaScript. */
function ImagePicker({
  existing,
  error,
}: {
  existing: { id: number; key: string }[];
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [removed, setRemoved] = useState<number[]>([]);
  const [picked, setPicked] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const kept = existing.filter((e) => !removed.includes(e.id));
  const room = MAX_IMAGES - kept.length - picked.length;

  // Keep the real input's files in step with the previews.
  useEffect(() => {
    if (!input.current || typeof DataTransfer === "undefined") return;
    const dt = new DataTransfer();
    for (const p of picked) dt.items.add(p.file);
    input.current.files = dt.files;
  }, [picked]);
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), []);

  return (
    <div className="field-row">
      <span className="label-like" id="images-label">
        Картинки{" "}
        <span className="opt">до {MAX_IMAGES}, перша — обкладинка</span>
      </span>
      {(kept.length > 0 || picked.length > 0) && (
        <ul className="pics" aria-labelledby="images-label">
          {existing.map((img) => {
            const gone = removed.includes(img.id);
            return (
              <li key={img.id} className={gone ? "gone" : undefined}>
                <img src={mediaUrl(img.key)} alt="" />
                <label className="pic-remove">
                  <input
                    type="checkbox"
                    name="remove_image"
                    value={img.id}
                    checked={gone}
                    onChange={(e) =>
                      setRemoved((r) =>
                        e.target.checked
                          ? [...r, img.id]
                          : r.filter((x) => x !== img.id),
                      )
                    }
                  />
                  <span>{gone ? "Повернути" : "Прибрати"}</span>
                </label>
              </li>
            );
          })}
          {picked.map((p, i) => (
            <li key={p.url}>
              <img src={p.url} alt="" />
              <button
                type="button"
                className="pic-remove"
                onClick={() => {
                  URL.revokeObjectURL(p.url);
                  setPicked((all) => all.filter((_, k) => k !== i));
                }}
              >
                <span>Прибрати</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className={`add-pics${room <= 0 ? " is-full" : ""}`}>
        <Icon name="image" small />
        {busy
          ? "Стискаємо…"
          : room <= 0
            ? `Уже ${MAX_IMAGES} картинок`
            : "Додати картинки"}
        <input
          ref={input}
          type="file"
          name="images"
          accept={IMAGE_TYPES.join(",")}
          multiple
          disabled={room <= 0}
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])].slice(0, room);
            if (typeof DataTransfer === "undefined" || files.length === 0)
              return;
            setBusy(true);
            const small = await Promise.all(files.map(shrink));
            setBusy(false);
            setPicked((all) => [
              ...all,
              ...small.map((file) => ({
                file,
                url: URL.createObjectURL(file),
              })),
            ]);
          }}
        />
      </label>
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

export function AnnouncementForm({
  initial,
  errors,
  canPublish,
  submitLabel,
}: {
  initial?: Initial;
  errors?: AnnouncementErrors;
  canPublish: boolean;
  submitLabel: string;
}) {
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const [y, m, d] = initial?.date ? initial.date.split("-").map(Number) : [];
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1];
  if (y && !years.includes(y)) years.unshift(y);
  const h = initial?.startMin != null ? Math.floor(initial.startMin / 60) : "";
  const min = initial?.startMin != null ? initial.startMin % 60 : "";

  return (
    <Form method="post" encType="multipart/form-data" className="glass form">
      {initial?.date && (
        <input type="hidden" name="date_keep" value={initial.date} />
      )}
      <Field id="title" label="Про що" error={errors?.title}>
        <input
          id="title"
          name="title"
          defaultValue={initial?.title}
          maxLength={TITLE_MAX}
          required
          placeholder="Збори мешканців"
          aria-invalid={!!errors?.title || undefined}
        />
      </Field>

      <fieldset className="field-row date-row">
        <legend>
          Коли <span className="opt">необовʼязково</span>
        </legend>
        <div className="date-grid">
          <label className="sr-only" htmlFor="date_d">
            День
          </label>
          <select
            id="date_d"
            name="date_d"
            className="select"
            defaultValue={d ?? ""}
          >
            <option value="">день</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="date_m">
            Місяць
          </label>
          <select
            id="date_m"
            name="date_m"
            className="select"
            defaultValue={m ?? ""}
          >
            <option value="">місяць</option>
            {MONTHS_GENITIVE.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="date_y">
            Рік
          </label>
          <select
            id="date_y"
            name="date_y"
            className="select"
            defaultValue={y ?? ""}
          >
            <option value="">рік</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="time-grid">
          <label className="sr-only" htmlFor="time_h">
            Година
          </label>
          <select id="time_h" name="time_h" className="select" defaultValue={h}>
            <option value="">год</option>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, "0")}
              </option>
            ))}
          </select>
          <span aria-hidden="true">:</span>
          <label className="sr-only" htmlFor="time_min">
            Хвилини
          </label>
          <select
            id="time_min"
            name="time_min"
            className="select"
            defaultValue={min}
          >
            <option value="">хв</option>
            {Array.from(
              { length: 60 / MINUTE_STEP },
              (_, i) => i * MINUTE_STEP,
            ).map((v) => (
              <option key={v} value={v}>
                {String(v).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
        {errors?.date || errors?.time ? (
          <small className="field-error">{errors.date ?? errors.time}</small>
        ) : (
          <small>
            Для подій: зборів, прибирання, відключень. Новину можна без дати.
          </small>
        )}
      </fieldset>

      <Field id="place" label="Де" optional error={errors?.place}>
        <input
          id="place"
          name="place"
          defaultValue={initial?.place ?? ""}
          maxLength={PLACE_MAX}
          placeholder="Читальна зала, 1 поверх"
        />
      </Field>

      <Field id="body" label="Подробиці" optional error={errors?.body}>
        <textarea
          id="body"
          name="body"
          className="area"
          rows={5}
          defaultValue={initial?.body ?? ""}
          maxLength={BODY_MAX}
        />
      </Field>

      <ImagePicker existing={initial?.images ?? []} error={errors?.images} />

      {canPublish && (
        <label className="check-row">
          <input
            type="checkbox"
            name="important"
            defaultChecked={initial?.important}
          />
          <span>
            <b>Важливе</b>
            <small>
              Зверху на головній і сповіщення всім, хто їх увімкнув.
            </small>
          </span>
        </label>
      )}

      <button className="btn btn-primary block" type="submit" disabled={busy}>
        {busy ? "Надсилаємо…" : submitLabel}
      </button>
      {!canPublish && (
        <p className="form-note">
          Оголошення зʼявиться на головній після того, як його схвалить
          студрада.
        </p>
      )}
    </Form>
  );
}
