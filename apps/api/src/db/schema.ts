import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

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
    last_updated: timestamp("last_updated").defaultNow().notNull(),
  },
  (t) => ({
    uniqueAvailability: primaryKey({
      columns: [t.title_tmdb_id, t.service_id, t.region],
    }),
    regionIdx: index("availability_region_idx").on(t.region),
    serviceIdx: index("availability_service_idx").on(t.service_id),
  })
);
