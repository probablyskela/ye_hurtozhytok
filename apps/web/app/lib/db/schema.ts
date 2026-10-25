import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const ROLES = ["resident", "council"] as const;
export type Role = (typeof ROLES)[number];

export const MACHINE_STATUSES = ["working", "broken"] as const;
export const BOOKING_STATUSES = ["active", "cancelled"] as const;

// All *_at columns hold UTC milliseconds.

export const residents = sqliteTable(
  "residents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Stable Google account id ("sub"); "dev:<email>" for local development sign-in.
    googleSub: text("google_sub").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // Three digits; null until the person fills in the profile.
    room: text("room"),
    // Telegram username without "@", optional, so others can reach the person.
    telegram: text("telegram"),
    role: text("role", { enum: ROLES }).notNull().default("resident"),
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
  (t) => [index("activity_created_idx").on(t.createdAt)],
);

export type Resident = typeof residents.$inferSelect;
export type Machine = typeof machines.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
