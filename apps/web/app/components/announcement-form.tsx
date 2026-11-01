import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { mediaUrl } from "~/components/announcement";
import { Check, DateField, TimeField } from "~/components/controls";
import { Icon } from "~/components/ui";
import {
  BODY_MAX,
  IMAGE_TYPES,
  MAX_IMAGES,
  PLACE_MAX,
  TITLE_MAX,
  type AnnouncementErrors,
} from "~/lib/announcements";

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
  today,
}: {
  today: string;
  initial?: Initial;
  errors?: AnnouncementErrors;
  canPublish: boolean;
  submitLabel: string;
}) {
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
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

      <DateField
        name="date"
        legend={
          <>
            Коли <span className="opt">необовʼязково</span>
          </>
        }
        today={today}
        defaultValue={initial?.date ?? null}
        error={errors?.date}
      />
      <TimeField
        name="time"
        defaultValue={initial?.startMin ?? null}
        error={errors?.time}
      />

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
        <Check
          name="important"
          defaultChecked={initial?.important}
          title="Важливе"
          hint="Зверху на головній і сповіщення всім, хто їх увімкнув."
        />
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
