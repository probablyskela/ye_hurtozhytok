import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Everyone signed in is a resident; a role only adds rights. Roles are
// granted by email (see roleGrants), so they work before the first sign-in.
export const ROLES = [
  "council",
  "council_head",
  "squad",
  "squad_head",
  "site_manager",
] as const;
export type Role = (typeof ROLES)[number];

export const MACHINE_STATUSES = ["working", "broken"] as const;
export const BOOKING_STATUSES = ["active", "cancelled"] as const;
// Anyone may propose; the council and the site manager publish or reject.
export const ANNOUNCEMENT_STATUSES = [
  "pending",
  "published",
  "rejected",
] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];
// "squad" is for the squad section that arrives with Оперета.
export const AUDIENCES = ["all", "squad"] as const;

// All *_at columns hold UTC milliseconds.

export const residents = sqliteTable(
  "residents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Stable Google account id ("sub"); "dev:<email>" for local development sign-in.
    googleSub: text("google_sub").notNull(),
    email: text("email").notNull(),
    // «Імʼя Прізвище», kept for display and sorting; the parts are below.
    name: text("name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    // From the Polytechnic directory; shown only to the council.
    patronymic: text("patronymic"),
    // As people say it («612», «1б», «робочка»); null until the profile is filled in.
    room: text("room"),
    // Telegram username without "@", optional, so others can reach the person.
    telegram: text("telegram"),
    blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
    // Bumped on block so open sessions stop working at once.
    sessionVersion: integer("session_version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("residents_google_sub_idx").on(t.googleSub)],
);

export const machines = sqliteTable("machines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Used in URLs and QR codes: "4", "6-1", "6-2".
  slug: text("slug").notNull().unique(),
  // As on the sticker: «6 поверх, №1».
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  position: integer("position").notNull(),
  status: text("status", { enum: MACHINE_STATUSES })
    .notNull()
    .default("working"),
});

export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    machineId: integer("machine_id")
      .notNull()
      .references(() => machines.id),
    residentId: integer("resident_id")
      .notNull()
      .references(() => residents.id),
    // Kyiv calendar date "YYYY-MM-DD" and minutes from Kyiv midnight (end may be 1440).
    date: text("date").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    status: text("status", { enum: BOOKING_STATUSES })
      .notNull()
      .default("active"),
    remindedAt: integer("reminded_at"),
    createdAt: integer("created_at").notNull(),
    cancelledAt: integer("cancelled_at"),
    cancelledBy: integer("cancelled_by").references(() => residents.id),
  },
  (t) => [
    index("bookings_machine_date_idx").on(t.machineId, t.date, t.status),
    index("bookings_resident_idx").on(t.residentId, t.status, t.date),
  ],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    residentId: integer("resident_id")
      .notNull()
      .references(() => residents.id),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("push_endpoint_idx").on(t.endpoint)],
);

export const roleGrants = sqliteTable(
  "role_grants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Lower-case @lpnu.ua address; matched against residents.email.
    email: text("email").notNull(),
    role: text("role", { enum: ROLES }).notNull(),
    // Null when granted by the role:grant script.
    grantedBy: integer("granted_by").references(() => residents.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("role_grants_email_role_idx").on(t.email, t.role)],
);

export const announcements = sqliteTable(
  "announcements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: integer("author_id")
      .notNull()
      .references(() => residents.id),
    title: text("title").notNull(),
    body: text("body"),
    place: text("place"),
    // Kyiv calendar date of the event, "YYYY-MM-DD"; null for news without a date.
    date: text("date"),
    // Minutes from Kyiv midnight; only together with a date.
    startMin: integer("start_min"),
    // Set only by whoever publishes; sends a push to everyone.
    important: integer("important", { mode: "boolean" })
      .notNull()
      .default(false),
    audience: text("audience", { enum: AUDIENCES }).notNull().default("all"),
    status: text("status", { enum: ANNOUNCEMENT_STATUSES })
      .notNull()
      .default("pending"),
    rejectReason: text("reject_reason"),
    decidedBy: integer("decided_by").references(() => residents.id),
    decidedAt: integer("decided_at"),
    publishedAt: integer("published_at"),
    // When everyone got the push for an important one; it is sent only once.
    broadcastAt: integer("broadcast_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("announcements_status_date_idx").on(t.status, t.date),
    index("announcements_status_published_idx").on(t.status, t.publishedAt),
    index("announcements_author_idx").on(t.authorId, t.createdAt),
  ],
);

export const announcementImages = sqliteTable(
  "announcement_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id),
    // Object key in the MEDIA R2 bucket.
    key: text("key").notNull(),
    // 0 is the cover shown in the feed.
    position: integer("position").notNull(),
    contentType: text("content_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("announcement_images_idx").on(t.announcementId, t.position),
    uniqueIndex("announcement_images_key_idx").on(t.key),
  ],
);

// One row per device still to be notified; the minute cron sends them in
// small batches so a broadcast never exceeds the Worker's subrequest limit.
export const pushOutbox = sqliteTable(
  "push_outbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subscriptionId: integer("subscription_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url").notNull(),
    createdAt: integer("created_at").notNull(),
    claimedAt: integer("claimed_at"),
  },
  (t) => [index("push_outbox_claimed_idx").on(t.claimedAt, t.id)],
);

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id")
      .notNull()
      .references(() => residents.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: integer("entity_id").notNull(),
    details: text("details"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("activity_created_idx").on(t.createdAt),
    // The daily limit on actions counts one person's recent entries.
    index("activity_actor_idx").on(t.actorId, t.createdAt),
  ],
);

export type Resident = typeof residents.$inferSelect;
export type RoleGrant = typeof roleGrants.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type AnnouncementImage = typeof announcementImages.$inferSelect;
export type Machine = typeof machines.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
