import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  uuid,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ────────────────────────────────────────────────────────────
// streaming_services
// ────────────────────────────────────────────────────────────
export const streamingServicesTable = pgTable(
  "streaming_services",
  {
    id: varchar("id", { length: 100 }).primaryKey(), // e.g. "netflix"
    name: varchar("name", { length: 100 }).notNull(),
    logo_url: text("logo_url"),
    supported_regions: text("supported_regions").array().notNull().default([]),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  }
);

// ────────────────────────────────────────────────────────────
// titles
// ────────────────────────────────────────────────────────────
export const titlesTable = pgTable(
  "titles",
  {
    id: serial("id").primaryKey(),
    tmdb_id: integer("tmdb_id").notNull(),
    imdb_id: varchar("imdb_id", { length: 20 }),
    title: varchar("title", { length: 500 }).notNull(),
    original_title: varchar("original_title", { length: 500 }),
    overview: text("overview"),
    poster_url: text("poster_url"),
    backdrop_url: text("backdrop_url"),
    type: varchar("type", { length: 10 }).notNull(), // "movie" | "series"
    year: integer("year"),
    genres: text("genres").array().notNull().default([]),
    imdb_rating: real("imdb_rating"),
    imdb_votes: integer("imdb_votes"),
    tmdb_rating: real("tmdb_rating"),
    runtime: integer("runtime"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tmdbIdIdx: uniqueIndex("titles_tmdb_id_idx").on(t.tmdb_id),
    imdbIdIdx: index("titles_imdb_id_idx").on(t.imdb_id),
    titleIdx: index("titles_title_idx").on(t.title),
  })
);

// ────────────────────────────────────────────────────────────
// availability
// ────────────────────────────────────────────────────────────
export const availabilityTable = pgTable(
  "availability",
  {
    id: serial("id").primaryKey(),
    title_tmdb_id: integer("title_tmdb_id")
      .notNull()
      .references(() => titlesTable.tmdb_id, { onDelete: "cascade" }),
    service_id: varchar("service_id", { length: 100 })
      .notNull()
      .references(() => streamingServicesTable.id, { onDelete: "cascade" }),
    region: varchar("region", { length: 10 }).notNull(),
    link: text("link"),
    availability_type: varchar("availability_type", { length: 20 }), // subscription | rent | buy | free
    quality: varchar("quality", { length: 20 }),
    is_active: boolean("is_active").notNull().default(true),
    first_seen_at: timestamp("first_seen_at"), // set on first insert only, never updated
    last_updated: timestamp("last_updated").defaultNow().notNull(),
  },
  (t) => ({
    uniqueAvailability: primaryKey({
      columns: [t.title_tmdb_id, t.service_id, t.region],
    }),
    regionIdx: index("availability_region_idx").on(t.region),
    serviceIdx: index("availability_service_idx").on(t.service_id),
    firstSeenIdx: index("availability_first_seen_idx").on(t.first_seen_at),
  })
);

// ────────────────────────────────────────────────────────────
// users
// ────────────────────────────────────────────────────────────
export const usersTable = pgTable(
  "users",
  {
    id: varchar("id", { length: 128 }).primaryKey(), // Google sub / provider ID
    email: varchar("email", { length: 255 }).notNull(),
    display_name: varchar("display_name", { length: 255 }),
    region: varchar("region", { length: 10 }).notNull().default("US"),
    refresh_token_hash: text("refresh_token_hash"), // bcrypt hash of refresh token
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

// ────────────────────────────────────────────────────────────
// user_services (many-to-many: users ↔ streaming_services)
// ────────────────────────────────────────────────────────────
export const userServicesTable = pgTable(
  "user_services",
  {
    user_id: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    service_id: varchar("service_id", { length: 100 })
      .notNull()
      .references(() => streamingServicesTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.user_id, t.service_id] }),
  })
);

// ────────────────────────────────────────────────────────────
// watchlist
// ────────────────────────────────────────────────────────────
export const watchlistTable = pgTable(
  "watchlist",
  {
    id: serial("id").primaryKey(),
    user_id: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title_id: integer("title_id")
      .notNull()
      .references(() => titlesTable.tmdb_id, { onDelete: "cascade" }),
    added_at: timestamp("added_at").defaultNow().notNull(),
    watched: boolean("watched").notNull().default(false),
    email_notifications: boolean("email_notifications").notNull().default(true),
  },
  (t) => ({
    uniqueWatchlist: uniqueIndex("watchlist_user_title_idx").on(
      t.user_id,
      t.title_id
    ),
    userIdx: index("watchlist_user_idx").on(t.user_id),
  })
);

// ────────────────────────────────────────────────────────────
// availability_reports
// ────────────────────────────────────────────────────────────
export const availabilityReportsTable = pgTable(
  "availability_reports",
  {
    id: serial("id").primaryKey(),
    title_id: integer("title_id")
      .notNull()
      .references(() => titlesTable.tmdb_id, { onDelete: "cascade" }),
    region: varchar("region", { length: 10 }).notNull(),
    service_id: varchar("service_id", { length: 100 })
      .notNull()
      .references(() => streamingServicesTable.id, { onDelete: "cascade" }),
    reported_at: timestamp("reported_at").defaultNow().notNull(),
    notes: text("notes"),
    reporter_user_id: varchar("reporter_user_id", { length: 128 }).references(
      () => usersTable.id,
      { onDelete: "set null" }
    ),
  },
  (t) => ({
    titleIdx: index("availability_reports_title_idx").on(t.title_id),
  })
);

// ────────────────────────────────────────────────────────────
// sessions  (FIX-6: O(1) refresh-token lookup)
// ────────────────────────────────────────────────────────────
export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    token_hash: text("token_hash").notNull().unique(),
    expires_at: timestamp("expires_at").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tokenHashIdx: uniqueIndex("sessions_token_hash_idx").on(t.token_hash),
    userIdx: index("sessions_user_idx").on(t.user_id),
  })
);

// ────────────────────────────────────────────────────────────
// watchlist_notifications  (FIX-2: email deduplication)
// ────────────────────────────────────────────────────────────
export const watchlistNotificationsTable = pgTable(
  "watchlist_notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title_id: integer("title_id")
      .notNull()
      .references(() => titlesTable.tmdb_id, { onDelete: "cascade" }),
    service_id: varchar("service_id", { length: 100 })
      .notNull()
      .references(() => streamingServicesTable.id, { onDelete: "cascade" }),
    notified_at: timestamp("notified_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueNotification: uniqueIndex("watchlist_notifications_user_title_service_idx").on(
      t.user_id,
      t.title_id,
      t.service_id
    ),
  })
);

// ────────────────────────────────────────────────────────────
// Relations
// ────────────────────────────────────────────────────────────
export const usersRelations = relations(usersTable, ({ many }) => ({
  services: many(userServicesTable),
  watchlist: many(watchlistTable),
  sessions: many(sessionsTable),
}));

export const userServicesRelations = relations(userServicesTable, ({ one }) => ({
  user: one(usersTable, { fields: [userServicesTable.user_id], references: [usersTable.id] }),
  service: one(streamingServicesTable, {
    fields: [userServicesTable.service_id],
    references: [streamingServicesTable.id],
  }),
}));

export const watchlistRelations = relations(watchlistTable, ({ one }) => ({
  user: one(usersTable, { fields: [watchlistTable.user_id], references: [usersTable.id] }),
}));

export const sessionsRelations = relations(sessionsTable, ({ one }) => ({
  user: one(usersTable, { fields: [sessionsTable.user_id], references: [usersTable.id] }),
}));
