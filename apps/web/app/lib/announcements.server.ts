import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import {
  MAX_IMAGES,
  MAX_PENDING,
  MAX_PROPOSALS_PER_DAY,
  MAX_IMAGE_BYTES,
  REASON_MAX,
  parseAnnouncementForm,
  whenLabel,
  type AnnouncementErrors,
} from "./announcements";
import { activity, getDb } from "./db";
import { detectImageType, stripMetadata, type ImageType } from "./images";
import { markdownExcerpt } from "./markdown.server";
import {
  announcementImages,
  announcements,
  residents,
  roleGrants,
  type Announcement,
} from "./db/schema";
import {
  canEditAnnouncement,
  canProposeAnnouncement,
  canPublishAnnouncements,
  canSeeAnnouncement,
  isSquad,
  type Actor,
} from "./permissions";
import { drainOutbox, enqueueBroadcast, notify } from "./push.server";
import { kyivNow } from "./time";

type Ctx = { waitUntil(promise: Promise<unknown>): void };

const DAY_MS = 24 * 60 * 60 * 1000;

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Cover (first picture) and picture count for each announcement. */
async function coversFor(env: Env, ids: number[]) {
  if (ids.length === 0)
    return new Map<number, { key: string; count: number }>();
  const rows = await getDb(env)
    .select({
      announcementId: announcementImages.announcementId,
      key: announcementImages.key,
      position: announcementImages.position,
    })
    .from(announcementImages)
    .where(inArray(announcementImages.announcementId, ids))
    .orderBy(asc(announcementImages.position))
    .all();
  const map = new Map<number, { key: string; count: number }>();
  for (const r of rows) {
    const seen = map.get(r.announcementId);
    if (seen) seen.count++;
    else map.set(r.announcementId, { key: r.key, count: 1 });
  }
  return map;
}

function card(a: Announcement, cover?: { key: string; count: number }) {
  return {
    id: a.id,
    title: a.title,
    excerpt: a.body ? markdownExcerpt(a.body) : null,
    place: a.place,
    date: a.date,
    startMin: a.startMin,
    important: a.important,
    status: a.status,
    audience: a.audience,
    publishedAt: a.publishedAt,
    createdAt: a.createdAt,
    cover: cover?.key ?? null,
    imageCount: cover?.count ?? 0,
  };
}
export type AnnouncementCard = ReturnType<typeof card>;

/** Everything published that this person may read. */
export async function listPublished(
  env: Env,
  actor: Actor,
): Promise<AnnouncementCard[]> {
  const rows = await getDb(env)
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.status, "published"),
        isNull(announcements.deletedAt),
      ),
    )
    .orderBy(desc(announcements.publishedAt))
    .all();
  const visible = rows.filter((a) => a.audience === "all" || isSquad(actor));
  const covers = await coversFor(
    env,
    visible.map((a) => a.id),
  );
  return visible.map((a) => card(a, covers.get(a.id)));
}

/** Proposals waiting for a decision, oldest first, with the author's name. */
export async function listPending(env: Env) {
  const rows = await getDb(env)
    .select({ a: announcements, author: residents.name, room: residents.room })
    .from(announcements)
    .innerJoin(residents, eq(residents.id, announcements.authorId))
    .where(
      and(eq(announcements.status, "pending"), isNull(announcements.deletedAt)),
    )
    .orderBy(asc(announcements.createdAt))
    .all();
  const covers = await coversFor(
    env,
    rows.map((r) => r.a.id),
  );
  return rows.map((r) => ({
    ...card(r.a, covers.get(r.a.id)),
    author: r.author,
    room: r.room,
  }));
}

export async function countPending(env: Env): Promise<number> {
  const row = await getDb(env)
    .select({ n: sql<number>`count(*)` })
    .from(announcements)
    .where(
      and(eq(announcements.status, "pending"), isNull(announcements.deletedAt)),
    )
    .get();
  return row?.n ?? 0;
}

/** The person's own proposals that are under review or were turned down. */
export async function listMine(env: Env, actorId: number) {
  const rows = await getDb(env)
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.authorId, actorId),
        inArray(announcements.status, ["pending", "rejected"]),
        isNull(announcements.deletedAt),
      ),
    )
    .orderBy(desc(announcements.createdAt))
    .all();
  return rows.map((a) => ({ ...card(a), rejectReason: a.rejectReason }));
}

/** One announcement with its pictures, or null when it may not be seen. */
export async function getAnnouncement(env: Env, actor: Actor, id: number) {
  const db = getDb(env);
  const a = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .get();
  if (!a || !canSeeAnnouncement(actor, a)) return null;
  const [images, author, decider] = await Promise.all([
    db
      .select({
        id: announcementImages.id,
        key: announcementImages.key,
        width: announcementImages.width,
        height: announcementImages.height,
      })
      .from(announcementImages)
      .where(eq(announcementImages.announcementId, id))
      .orderBy(asc(announcementImages.position))
      .all(),
    db
      .select({ name: residents.name, room: residents.room })
      .from(residents)
      .where(eq(residents.id, a.authorId))
      .get(),
    a.decidedBy
      ? db
          .select({ name: residents.name })
          .from(residents)
          .where(eq(residents.id, a.decidedBy))
          .get()
      : undefined,
  ]);
  return {
    ...a,
    images,
    author: author?.name ?? "",
    authorRoom: author?.room ?? null,
    decidedByName: decider?.name ?? null,
    canEdit: canEditAnnouncement(actor, a),
    canDecide: a.status === "pending" && canPublishAnnouncements(actor),
  };
}

type Picture = { bytes: Uint8Array; type: ImageType };

/**
 * Pictures to add from the form. The format is taken from the file's bytes,
 * not from what the browser says, and metadata (EXIF with GPS, XMP, text) is
 * removed before anything is stored.
 */
async function newImages(
  form: FormData,
): Promise<{ pictures: Picture[]; error?: string }> {
  const files = form
    .getAll("images")
    .filter(
      (f): f is File => typeof f === "object" && f !== null && f.size > 0,
    );
  const pictures: Picture[] = [];
  // Counted before any file is read, so a request with dozens of pictures
  // never fills the Worker's memory.
  if (files.length > MAX_IMAGES)
    return { pictures, error: `До ${MAX_IMAGES} картинок.` };
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES)
      return {
        pictures,
        error: `Картинка «${f.name}» завелика: до ${MAX_IMAGE_BYTES / 1024 / 1024} МБ.`,
      };
    const raw = new Uint8Array(await f.arrayBuffer());
    const type = detectImageType(raw);
    if (!type)
      return { pictures, error: "Картинки — у форматі JPEG, PNG або WebP." };
    try {
      pictures.push({ bytes: stripMetadata(raw, type), type });
    } catch {
      return {
        pictures,
        error: `Картинку «${f.name}» не вдалося прочитати. Спробуйте інше фото.`,
      };
    }
  }
  return { pictures };
}

async function storeImages(
  env: Env,
  announcementId: number,
  pictures: Picture[],
  firstPosition: number,
) {
  const db = getDb(env);
  let position = firstPosition;
  for (const p of pictures) {
    const key = `a/${announcementId}/${crypto.randomUUID()}.${IMAGE_EXT[p.type]}`;
    await env.MEDIA.put(key, p.bytes, {
      httpMetadata: { contentType: p.type },
    });
    await db.insert(announcementImages).values({
      announcementId,
      key,
      position: position++,
      contentType: p.type,
      size: p.bytes.length,
      createdAt: Date.now(),
    });
  }
}

async function deciderIds(env: Env): Promise<number[]> {
  const rows = await getDb(env)
    .selectDistinct({ id: residents.id })
    .from(residents)
    .innerJoin(roleGrants, sql`${roleGrants.email} = lower(${residents.email})`)
    .where(
      inArray(roleGrants.role, ["council", "council_head", "site_manager"]),
    )
    .all();
  return rows.map((r) => r.id);
}

/** Pushes an important announcement to everyone; the cron sends the rest of the queue. */
function broadcastImportant(
  env: Env,
  ctx: Ctx,
  a: Announcement,
  actorId: number,
) {
  const when = whenLabel(a.date, a.startMin, kyivNow().date);
  ctx.waitUntil(
    // Only the first time: unticking and ticking «важливе» again, or two
    // saves at once, must not send everyone a second push.
    getDb(env)
      .update(announcements)
      .set({ broadcastAt: Date.now() })
      .where(and(eq(announcements.id, a.id), isNull(announcements.broadcastAt)))
      .returning({ id: announcements.id })
      .get()
      .then((claimed) =>
        claimed
          ? enqueueBroadcast(
              env,
              {
                title: "Важливе оголошення",
                body: when ? `${a.title} — ${when}` : a.title,
                url: `/announcements/${a.id}`,
              },
              actorId,
            ).then(() => drainOutbox(env))
          : undefined,
      )
      .catch((e) => console.error("broadcast failed", a.id, e)),
  );
}

export type SaveResult =
  | { ok: true; id: number; status: Announcement["status"] }
  | { ok: false; errors: AnnouncementErrors };

/**
 * A new announcement. Deciders publish at once (and may mark it important);
 * everyone else sends a proposal for review.
 */
export async function createAnnouncement(
  env: Env,
  ctx: Ctx,
  actor: Actor,
  form: FormData,
): Promise<SaveResult> {
  if (!canProposeAnnouncement(actor))
    return { ok: false, errors: { title: "Ваш акаунт заблоковано." } };
  const today = kyivNow().date;
  const parsed = parseAnnouncementForm(form, today);
  const images = await newImages(form);
  if (!parsed.ok || images.error || images.pictures.length > MAX_IMAGES)
    return {
      ok: false,
      errors: {
        ...(parsed.ok ? {} : parsed.errors),
        ...(images.error
          ? { images: images.error }
          : images.pictures.length > MAX_IMAGES
            ? { images: `До ${MAX_IMAGES} картинок.` }
            : {}),
      },
    };

  const publish = canPublishAnnouncements(actor);
  const now = Date.now();
  const db = getDb(env);
  if (!publish) {
    const waiting = await db
      .select({ n: sql<number>`count(*)` })
      .from(announcements)
      .where(
        and(
          eq(announcements.authorId, actor.id),
          eq(announcements.status, "pending"),
          isNull(announcements.deletedAt),
        ),
      )
      .get();
    if ((waiting?.n ?? 0) >= MAX_PENDING)
      return {
        ok: false,
        errors: {
          title: `Уже ${MAX_PENDING} ваші пропозиції чекають рішення. Нову можна надіслати, коли їх розглянуть.`,
        },
      };
    // Withdrawn ones count too: each proposal sends the council a push.
    const recent = await db
      .select({ n: sql<number>`count(*)` })
      .from(announcements)
      .where(
        and(
          eq(announcements.authorId, actor.id),
          gt(announcements.createdAt, now - DAY_MS),
        ),
      )
      .get();
    if ((recent?.n ?? 0) >= MAX_PROPOSALS_PER_DAY)
      return {
        ok: false,
        errors: {
          title: `За добу можна надіслати до ${MAX_PROPOSALS_PER_DAY} пропозицій. Спробуйте завтра.`,
        },
      };
  }
  const a = await db
    .insert(announcements)
    .values({
      ...parsed.values,
      authorId: actor.id,
      important: publish && form.get("important") === "on",
      status: publish ? "published" : "pending",
      decidedBy: publish ? actor.id : null,
      decidedAt: publish ? now : null,
      publishedAt: publish ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  await storeImages(env, a.id, images.pictures, 0);
  await activity(db, {
    actorId: actor.id,
    action: publish ? "announcement.published" : "announcement.proposed",
    entity: "announcement",
    entityId: a.id,
    details: { title: a.title, important: a.important },
  });

  if (publish) {
    if (a.important) broadcastImportant(env, ctx, a, actor.id);
  } else {
    ctx.waitUntil(
      deciderIds(env)
        .then((ids) =>
          notify(
            env,
            ids.filter((id) => id !== actor.id),
            {
              title: "Нова пропозиція оголошення",
              body: a.title,
              url: `/announcements/${a.id}`,
            },
          ),
        )
        .catch((e) => console.error("proposal notify failed", a.id, e)),
    );
  }
  return { ok: true, id: a.id, status: a.status };
}

export async function updateAnnouncement(
  env: Env,
  ctx: Ctx,
  actor: Actor,
  id: number,
  form: FormData,
): Promise<SaveResult | null> {
  const db = getDb(env);
  const a = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .get();
  if (!a || !canEditAnnouncement(actor, a)) return null;

  const today = kyivNow().date;
  // A date that has already passed may stay as it was.
  const parsed = parseAnnouncementForm(form, today, {
    allowPast: form.get("date_keep") === a.date,
  });
  const removeIds = form
    .getAll("remove_image")
    .map(Number)
    .filter(Number.isInteger);
  const existing = await db
    .select()
    .from(announcementImages)
    .where(eq(announcementImages.announcementId, id))
    .orderBy(asc(announcementImages.position))
    .all();
  const kept = existing.filter((img) => !removeIds.includes(img.id));
  const images = await newImages(form);
  const total = kept.length + images.pictures.length;
  if (!parsed.ok || images.error || total > MAX_IMAGES)
    return {
      ok: false,
      errors: {
        ...(parsed.ok ? {} : parsed.errors),
        ...(images.error
          ? { images: images.error }
          : total > MAX_IMAGES
            ? { images: `До ${MAX_IMAGES} картинок разом.` }
            : {}),
      },
    };

  const decider = canPublishAnnouncements(actor);
  const important = decider ? form.get("important") === "on" : a.important;
  const updated = await db
    .update(announcements)
    .set({ ...parsed.values, important, updatedAt: Date.now() })
    .where(eq(announcements.id, id))
    .returning()
    .get();

  const gone = existing.filter((img) => removeIds.includes(img.id));
  if (gone.length) {
    await db.delete(announcementImages).where(
      inArray(
        announcementImages.id,
        gone.map((g) => g.id),
      ),
    );
    await env.MEDIA.delete(gone.map((g) => g.key));
  }
  // Keep the order compact: kept pictures first, new ones after.
  for (const [i, img] of kept.entries())
    if (img.position !== i)
      await db
        .update(announcementImages)
        .set({ position: i })
        .where(eq(announcementImages.id, img.id));
  await storeImages(env, id, images.pictures, kept.length);

  await activity(db, {
    actorId: actor.id,
    action: "announcement.updated",
    entity: "announcement",
    entityId: id,
    details: {
      title: updated.title,
      important,
      imagesAdded: images.pictures.length,
      imagesRemoved: gone.length,
    },
  });
  if (updated.status === "published" && important && !a.important)
    broadcastImportant(env, ctx, updated, actor.id);
  return { ok: true, id, status: updated.status };
}

export type DecideResult =
  { ok: true; status: "published" | "rejected" } | { ok: false; error: string };

/** Publishes a proposal (optionally as important) or turns it down with a reason. */
export async function decideAnnouncement(
  env: Env,
  ctx: Ctx,
  actor: Actor,
  id: number,
  form: FormData,
): Promise<DecideResult> {
  if (!canPublishAnnouncements(actor))
    return { ok: false, error: "Вирішувати можуть студрада й розпорядник." };
  const db = getDb(env);
  const publish = form.get("intent") === "publish";
  const reason = String(form.get("reason") ?? "")
    .trim()
    .slice(0, REASON_MAX);
  if (!publish && reason.length < 3)
    return {
      ok: false,
      error: "Напишіть автору, чому оголошення не підходить.",
    };
  const now = Date.now();
  // Only a proposal still under review changes, so two deciders never clash.
  const a = await db
    .update(announcements)
    .set(
      publish
        ? {
            status: "published",
            important: form.get("important") === "on",
            decidedBy: actor.id,
            decidedAt: now,
            publishedAt: now,
            updatedAt: now,
          }
        : {
            status: "rejected",
            rejectReason: reason,
            decidedBy: actor.id,
            decidedAt: now,
            updatedAt: now,
          },
    )
    .where(
      and(
        eq(announcements.id, id),
        eq(announcements.status, "pending"),
        isNull(announcements.deletedAt),
      ),
    )
    .returning()
    .get();
  if (!a) return { ok: false, error: "Цю пропозицію вже розглянули." };

  await activity(db, {
    actorId: actor.id,
    action: publish ? "announcement.published" : "announcement.rejected",
    entity: "announcement",
    entityId: id,
    details: publish ? { important: a.important } : { reason },
  });
  if (a.authorId !== actor.id)
    ctx.waitUntil(
      notify(env, [a.authorId], {
        title: publish
          ? "Ваше оголошення опубліковано"
          : "Оголошення не опубліковано",
        body: publish ? a.title : `${a.title}: ${reason}`,
        url: `/announcements/${id}`,
      }).catch((e) => console.error("decision notify failed", id, e)),
    );
  if (publish && a.important) broadcastImportant(env, ctx, a, actor.id);
  return { ok: true, status: a.status as "published" | "rejected" };
}

/** Hides the announcement and drops its pictures from storage. */
export async function deleteAnnouncement(
  env: Env,
  actor: Actor,
  id: number,
): Promise<boolean> {
  const db = getDb(env);
  const a = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, id))
    .get();
  if (!a || !canEditAnnouncement(actor, a)) return false;
  const now = Date.now();
  await db
    .update(announcements)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(announcements.id, id));
  const images = await db
    .select({ id: announcementImages.id, key: announcementImages.key })
    .from(announcementImages)
    .where(eq(announcementImages.announcementId, id))
    .all();
  if (images.length) {
    await env.MEDIA.delete(images.map((i) => i.key));
    await db.delete(announcementImages).where(
      inArray(
        announcementImages.id,
        images.map((i) => i.id),
      ),
    );
  }
  await activity(db, {
    actorId: actor.id,
    action: "announcement.deleted",
    entity: "announcement",
    entityId: id,
    details: { title: a.title, status: a.status },
  });
  return true;
}

/** A stored picture, when the person may see its announcement. */
export async function mediaFor(env: Env, actor: Actor, key: string) {
  const db = getDb(env);
  const row = await db
    .select({ a: announcements, contentType: announcementImages.contentType })
    .from(announcementImages)
    .innerJoin(
      announcements,
      eq(announcements.id, announcementImages.announcementId),
    )
    .where(eq(announcementImages.key, key))
    .get();
  if (!row || !canSeeAnnouncement(actor, row.a)) return null;
  const object = await env.MEDIA.get(key);
  return object ? { object, contentType: row.contentType } : null;
}
