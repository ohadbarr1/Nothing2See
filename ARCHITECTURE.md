# Nothing2See — Technical Architecture Document

**Version:** 1.0
**Date:** 2026-03-20
**Author:** Senior Software Architect
**Audience:** Software Developer, Code Reviewer & Product Manager

---

## Table of Contents

1. [Product Summary](#1-product-summary)
2. [Tech Stack Recommendation](#2-tech-stack-recommendation)
3. [System Architecture Diagram](#3-system-architecture-diagram)
4. [Data Model](#4-data-model)
5. [API Design](#5-api-design)
6. [Phased Implementation Plan](#6-phased-implementation-plan)
7. [Key Technical Risks & Mitigations](#7-key-technical-risks--mitigations)
8. [Folder / Project Structure](#8-folder--project-structure)
9. [Environment Variables Reference](#9-environment-variables-reference)

---

## 1. Product Summary

Nothing2See helps users discover what to watch across streaming services. The two confirmed MVP features are:

| # | Feature | Auth Required |
|---|---------|---------------|
| 1 | Search by title — returns streaming availability per region | No |
| 2 | Top-30 by service + region ranked by IMDb score | No |
| 3–5 | PM-defined (watchlist, comparison, personalized recs, new releases tracker) | Yes (Phase 2) |

**Region awareness is a first-class concern**, not an afterthought.

---

## 2. Tech Stack Recommendation

### 2.1 Frontend

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Web framework | **React 18 + Vite** | Fast DX, huge ecosystem, easy path to React Native |
| Mobile path | **React Native (Expo)** | Shares all business logic / hooks / API clients with the web app via a monorepo. No full rewrite needed. |
| Shared code strategy | **Turborepo monorepo** with `packages/core` for hooks, API clients, and types | Single source of truth for logic |
| UI component library | **shadcn/ui** (Radix + Tailwind) for web; **NativeWind** for mobile | Consistent design tokens; mobile-safe primitives |
| State management | **Zustand** (lightweight, no boilerplate) | Sufficient for MVP; scales to Phase 2 |
| Data fetching | **TanStack Query (React Query)** | Caching, background refresh, loading/error states out of the box |
| Routing | **React Router v6** (web) / **Expo Router** (mobile) | File-based routing on mobile mirrors web structure |

### 2.2 Backend

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Runtime | **Node.js 20 LTS** | Same language as frontend; large ecosystem |
| Framework | **Fastify** | Faster than Express, built-in schema validation via JSON Schema / Zod |
| API style | **REST** | Simpler to reason about for an MVP; no complex nested queries needed yet |
| Auth (Phase 2) | **Better Auth** (or Clerk for managed option) | JWT + refresh tokens; OAuth (Google/Apple) |
| Validation | **Zod** shared between frontend and backend via `packages/types` | Runtime safety + TypeScript inference |

### 2.3 Database

| Store | Technology | What Lives Here |
|-------|-----------|-----------------|
| Primary DB | **PostgreSQL** (via Supabase for MVP simplicity) | Users, Watchlists, cached availability snapshots, user preferences |
| ORM | **Drizzle ORM** | Type-safe, lightweight, works well with Supabase Postgres |
| Cache | **Redis (Upstash serverless)** | External API response cache (TTL: 12 hours for availability, 24 hours for ratings) |

**What to store vs. what to fetch live:**

- **Fetch live (with Redis cache):** Streaming availability data, IMDb/TMDB ratings. These change frequently enough that we do not want to maintain a full sync pipeline in MVP.
- **Store in Postgres:** User accounts, watchlists, user-selected services + region preferences, cached search results (as a write-through cache for popular titles).

### 2.4 External APIs

| API | Purpose | Pricing Tier to Start |
|-----|---------|----------------------|
| **Streaming Availability API** (RapidAPI / Movieof.theday) | Primary source for which service carries a title, per region | Free tier: 100 req/day; Basic: ~$10/mo |
| **TMDB API** | Movie/show metadata, posters, genres, cast | Free (rate limited) |
| **OMDb API** | IMDb ratings by IMDb ID | Free tier: 1000 req/day; $1/mo for more |
| **WATCHMODE API** | Alternative/backup for streaming availability | Free tier available |

**Strategy:** TMDB is the canonical source for metadata and IMDb IDs. OMDb is queried by IMDb ID for ratings. Streaming Availability API is queried for availability. All three responses are merged server-side and cached in Redis.

### 2.5 Hosting & Infrastructure (MVP — Keep It Simple)

| Component | Service | Notes |
|-----------|---------|-------|
| Frontend (web) | **Vercel** | Zero-config, preview deployments per PR |
| Backend API | **Railway** or **Render** | Single Node.js service; auto-deploy from main branch |
| Database | **Supabase** (hosted Postgres) | Free tier sufficient for MVP; adds auth later if needed |
| Redis cache | **Upstash** | Serverless Redis; free tier: 10k commands/day |
| File storage (Phase 2+) | Supabase Storage | Profile images, if needed |
| CI/CD | **GitHub Actions** | Lint, type-check, test on PR; deploy on merge to main |

---

## 3. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENTS                          │
│                                                         │
│   ┌──────────────────┐      ┌──────────────────┐        │
│   │   React Web App  │      │  React Native    │        │
│   │   (Vite/Vercel)  │      │  (Expo — Phase 3)│        │
│   └────────┬─────────┘      └────────┬─────────┘        │
│            │  HTTPS REST                │                │
└────────────┼────────────────────────────┼───────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────────────────────────────────────┐
│                   NOTHING2SEE API                      │
│              (Fastify / Node.js 20 LTS)                │
│                 Hosted on Railway/Render               │
│                                                        │
│  ┌─────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │  /search    │  │  /discover    │  │  /users     │  │
│  │  /titles    │  │  /services    │  │  /watchlist │  │
│  └──────┬──────┘  └──────┬────────┘  └──────┬──────┘  │
│         │                │                  │          │
│         └────────────────┼──────────────────┘          │
│                          │                             │
│              ┌───────────▼──────────┐                  │
│              │   Service Layer      │                  │
│              │  (orchestration,     │                  │
│              │   caching, merging)  │                  │
│              └───────────┬──────────┘                  │
└──────────────────────────┼─────────────────────────────┘
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│    Redis     │  │  PostgreSQL  │  │  External APIs   │
│   (Upstash)  │  │  (Supabase)  │  │                  │
│              │  │              │  │  ┌─────────────┐  │
│  API cache   │  │  Users       │  │  │ TMDB API    │  │
│  TTL 12-24h  │  │  Watchlists  │  │  │ OMDb API    │  │
│              │  │  Preferences │  │  │ Streaming   │  │
│              │  │  Regions     │  │  │ Avail. API  │  │
└──────────────┘  └──────────────┘  │  │ WATCHMODE   │  │
                                    │  └─────────────┘  │
                                    └──────────────────┘
```

**Request flow for "Search by title":**

```
Client → GET /api/titles/search?q=Inception&region=IL
       → Backend checks Redis cache
           → HIT: return cached JSON
           → MISS:
               → Query TMDB for metadata + IMDb ID
               → Query OMDb for IMDb rating
               → Query Streaming Availability API for region=IL
               → Merge results
               → Write to Redis (TTL 12h)
               → Return to client
```

---

## 4. Data Model

### 4.1 Entity Relationship Overview

```
User ──< UserService >── StreamingService
 │
 ├──< Watchlist >── Title
 └── region (string, e.g. "IL", "US")

Title ──< Availability >── StreamingService
Title ──< Availability >── Region
```

### 4.2 Table Definitions (Drizzle ORM / PostgreSQL)

#### `users`
```ts
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
email         text UNIQUE NOT NULL
display_name  text
region        text NOT NULL DEFAULT 'US'   -- ISO 3166-1 alpha-2
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

#### `streaming_services`
```ts
id            uuid PRIMARY KEY
slug          text UNIQUE NOT NULL   -- e.g. "netflix", "hulu", "apple-tv-plus"
display_name  text NOT NULL
logo_url      text
```

#### `user_services`  (many-to-many: users ↔ streaming services)
```ts
user_id       uuid REFERENCES users(id) ON DELETE CASCADE
service_id    uuid REFERENCES streaming_services(id) ON DELETE CASCADE
PRIMARY KEY (user_id, service_id)
```

#### `titles`  (local cache of TMDB data)
```ts
id            uuid PRIMARY KEY
tmdb_id       integer UNIQUE NOT NULL
imdb_id       text                   -- e.g. "tt1375666"
title         text NOT NULL
type          text NOT NULL          -- 'movie' | 'series'
release_year  integer
poster_url    text
genres        text[]
overview      text
imdb_rating   numeric(3,1)
imdb_votes    integer
cached_at     timestamptz            -- when this row was last refreshed
```

#### `availability`  (cached streaming availability per title + region)
```ts
id            uuid PRIMARY KEY
title_id      uuid REFERENCES titles(id) ON DELETE CASCADE
service_id    uuid REFERENCES streaming_services(id) ON DELETE CASCADE
region        text NOT NULL          -- ISO 3166-1 alpha-2
available     boolean NOT NULL
link          text                   -- deep link to the title on the service
quality       text                   -- '4k', 'hd', 'sd'
cached_at     timestamptz
UNIQUE (title_id, service_id, region)
```

#### `watchlist`
```ts
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid REFERENCES users(id) ON DELETE CASCADE
title_id      uuid REFERENCES titles(id) ON DELETE CASCADE
added_at      timestamptz DEFAULT now()
watched       boolean DEFAULT false
UNIQUE (user_id, title_id)
```

#### `user_genre_preferences`  (Phase 2 — personalized recs)
```ts
user_id       uuid REFERENCES users(id) ON DELETE CASCADE
genre         text NOT NULL
weight        integer DEFAULT 1      -- implicit signal from watchlist activity
PRIMARY KEY (user_id, genre)
```

---

## 5. API Design

**Base URL:** `https://api.nothing2see.app/api/v1`

All responses follow the envelope pattern:
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}
```

Errors:
```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Title not found." }
}
```

---

### 5.1 Title Search (Feature 1)

#### `GET /titles/search`

Search for a movie or show by title, with streaming availability per region.

**Query params:**

| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `q` | string | Yes | — | Title search string |
| `region` | string | No | `US` | ISO 3166-1 alpha-2 |
| `type` | string | No | — | `movie` or `series` |
| `page` | integer | No | `1` | |
| `limit` | integer | No | `20` | Max 50 |

**Response `data`:**
```json
[
  {
    "tmdb_id": 27205,
    "imdb_id": "tt1375666",
    "title": "Inception",
    "type": "movie",
    "release_year": 2010,
    "poster_url": "https://image.tmdb.org/t/p/w500/...",
    "imdb_rating": 8.8,
    "genres": ["Action", "Sci-Fi", "Thriller"],
    "availability": [
      {
        "service": "netflix",
        "display_name": "Netflix",
        "region": "IL",
        "available": true,
        "link": "https://www.netflix.com/title/70131314",
        "quality": "4k"
      },
      {
        "service": "netflix",
        "display_name": "Netflix",
        "region": "US",
        "available": false
      }
    ]
  }
]
```

---

#### `GET /titles/:tmdb_id`

Fetch full detail for a single title, including availability for one or more regions.

**Query params:** `region` (string, default `US`), `regions` (comma-separated for multi-region).

---

### 5.2 Discovery / Top-30 (Feature 2)

#### `GET /discover/top`

Returns top 30 titles available on selected services in a region, ranked by IMDb score.

**Query params:**

| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `region` | string | Yes | — | ISO 3166-1 alpha-2 |
| `services` | string | Yes | — | Comma-separated slugs, e.g. `netflix,hulu` |
| `type` | string | No | — | `movie` or `series` |
| `genre` | string | No | — | Filter by genre |
| `min_rating` | number | No | `0` | Minimum IMDb rating |

**Response `data`:** Array of up to 30 title objects (same shape as search response).

---

### 5.3 Streaming Services Reference

#### `GET /services`

Returns all supported streaming services (for dropdowns, filter UIs).

**Response:**
```json
[
  { "slug": "netflix", "display_name": "Netflix", "logo_url": "..." },
  { "slug": "hulu", "display_name": "Hulu", "logo_url": "..." }
]
```

#### `GET /services/:slug/regions`

Returns the list of regions where a specific service is available.

---

### 5.4 User & Auth (Phase 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register with email + password |
| `POST` | `/auth/login` | Login, returns JWT + refresh token |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Invalidate refresh token |
| `GET` | `/users/me` | Get current user profile |
| `PATCH` | `/users/me` | Update profile (name, region) |
| `GET` | `/users/me/services` | Get user's selected streaming services |
| `PUT` | `/users/me/services` | Replace selected services |

---

### 5.5 Watchlist (Phase 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/me/watchlist` | List watchlist items |
| `POST` | `/users/me/watchlist` | Add title (`{ tmdb_id }`) |
| `DELETE` | `/users/me/watchlist/:tmdb_id` | Remove title |
| `PATCH` | `/users/me/watchlist/:tmdb_id` | Mark as watched (`{ watched: true }`) |

---

### 5.6 Potential Phase 3 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/discover/new-releases` | New releases by service + region |
| `GET` | `/discover/personalized` | Recs based on genre preferences |
| `GET` | `/services/compare` | Side-by-side service catalog stats |
| `POST` | `/users/me/notifications` | Subscribe to new release alerts |

---

## 6. Phased Implementation Plan

### Phase 1 — Core Search & Discovery (No Auth)
**Target:** Working web app, publicly accessible, no login required.
**Duration estimate:** 3–4 weeks

**Developer tasks:**

1. **Monorepo setup** — Turborepo, `apps/web`, `apps/api`, `packages/types`, `packages/core`
2. **API scaffolding** — Fastify server, Zod validation, error handling middleware, health check
3. **External API integrations:**
   - TMDB client (metadata + IMDb ID)
   - OMDb client (IMDb rating by ID)
   - Streaming Availability API client (availability by title + region)
4. **Redis caching layer** — Upstash client, cache-aside pattern with TTL
5. **Database** — Supabase project, Drizzle schema for `titles`, `streaming_services`, `availability`
6. **Endpoints:** `GET /titles/search`, `GET /titles/:tmdb_id`, `GET /discover/top`, `GET /services`
7. **Frontend — Search page:**
   - Search bar with debounce (300ms)
   - Region selector (defaulting to browser locale)
   - Results grid with poster, rating, availability badges per service
8. **Frontend — Discover page:**
   - Service multi-select + region selector
   - Top-30 grid ranked by IMDb score
   - Filter by type (movie/series) and genre
9. **Deploy:** Vercel (web) + Railway (API) + Supabase + Upstash

**Reviewer/PM tasks:**
- Validate region detection logic (browser locale vs. manual selection)
- Confirm which streaming services to include in MVP
- Review UI for availability display (badges, flags, links)
- Define acceptance criteria for search relevance

---

### Phase 2 — User Accounts, Watchlist, Personalization
**Target:** Logged-in users with persistent preferences and watchlist.
**Duration estimate:** 3–4 weeks

**Developer tasks:**

1. **Auth implementation** — Better Auth or Clerk integration, JWT middleware on protected routes
2. **Database additions** — `users`, `user_services`, `watchlist`, `user_genre_preferences` tables
3. **Auth endpoints** — Register, login, refresh, logout
4. **User profile endpoints** — `GET/PATCH /users/me`, service preferences, region preference
5. **Watchlist endpoints** — Full CRUD, watched state
6. **Personalized recommendations** — Rank `GET /discover/top` by genre affinity derived from watchlist
7. **Frontend — Auth flows** — Login/register modals, protected routes
8. **Frontend — Watchlist UI** — Add/remove from any title card, dedicated watchlist page
9. **Frontend — Profile page** — Service selector, region selector, saved preferences

**Reviewer/PM tasks:**
- Confirm which 3 additional use cases from the product brief to prioritize
- Review data privacy approach (GDPR considerations for region = EU users)
- Validate personalization logic with real sample data
- Define metrics for "recommendation quality"

---

### Phase 3 — Polish, Notifications, Mobile
**Target:** Production-ready, mobile app in stores.
**Duration estimate:** 4–6 weeks

**Developer tasks:**

1. **Expo / React Native app** — Bootstrap with Expo Router, wire up `packages/core` hooks
2. **NativeWind styling** — Mirror web design system in mobile components
3. **Push notifications** — Expo Notifications for new release alerts (requires notification preference model)
4. **New releases tracker** — Cron job (Railway cron or GitHub Actions schedule) to poll Streaming Availability API for new additions, write to DB, fan out notifications
5. **Streaming service comparison** — Side-by-side catalog stats page
6. **Performance** — Image optimization, API response compression, bundle analysis
7. **Analytics** — Posthog (open-source, self-hostable) for usage insights
8. **App store submission** — Expo EAS Build + Submit

**Reviewer/PM tasks:**
- App store asset review (screenshots, descriptions, age ratings)
- End-to-end QA on both iOS and Android
- Notification copy review
- Final feature prioritization for Phase 3 use cases

---

## 7. Key Technical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Streaming Availability API rate limits** — Free tier is very restrictive (100 req/day) | High | High | Implement Redis caching aggressively (12h TTL). Upgrade to paid tier ($10/mo) before any real traffic. Consider WATCHMODE as a fallback. |
| **IMDb data accuracy** — OMDb can have stale or missing ratings | Medium | Medium | Fall back to TMDB vote average if OMDb returns no data. Display data source label to user. |
| **Region detection errors** — Browser locale ≠ user's actual region | Medium | Medium | Always show a visible, easy-to-change region selector. Store region preference in localStorage for anonymous users, in DB for logged-in users. Never silently infer region. |
| **JustWatch API unavailability** — JustWatch does not offer a public API; scraping is fragile | High | High | Do not use JustWatch directly. Use Streaming Availability API (RapidAPI) or WATCHMODE, which are legitimate paid APIs. |
| **TMDB search relevance** — Poor results for non-English titles or partial queries | Medium | Medium | Add fuzzy matching on the backend. Let users filter by year. Display original title alongside localized title. |
| **Monorepo complexity** — Turborepo overhead for a small team | Low | Low | Keep `packages/` minimal: only `types` and `core` (hooks + API client). Avoid premature abstraction. |
| **Supabase vendor lock-in** — Moving away from Supabase later could be painful | Low | Low | Use Drizzle ORM, not Supabase's own query builder. The database is standard PostgreSQL; migration is straightforward. |
| **External API costs at scale** — Multiple external API calls per search request | Medium | Medium | Write-through cache to Postgres for popular titles. Batch discovery queries where possible. Monitor API usage from day one. |

---

## 8. Folder / Project Structure

```
nothing2see/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint, type-check, test on PRs
│       └── deploy.yml          # Deploy on merge to main
│
├── apps/
│   ├── web/                    # React + Vite web app
│   │   ├── src/
│   │   │   ├── components/     # UI components (shadcn/ui based)
│   │   │   │   ├── search/
│   │   │   │   ├── discover/
│   │   │   │   ├── watchlist/
│   │   │   │   └── common/
│   │   │   ├── pages/          # Route-level components
│   │   │   │   ├── SearchPage.tsx
│   │   │   │   ├── DiscoverPage.tsx
│   │   │   │   ├── WatchlistPage.tsx
│   │   │   │   └── ProfilePage.tsx
│   │   │   ├── hooks/          # Web-specific hooks (reuse from packages/core where possible)
│   │   │   ├── store/          # Zustand stores
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── mobile/                 # React Native + Expo app (Phase 3)
│   │   ├── app/                # Expo Router file-based routes
│   │   │   ├── (tabs)/
│   │   │   │   ├── search.tsx
│   │   │   │   ├── discover.tsx
│   │   │   │   └── watchlist.tsx
│   │   │   └── _layout.tsx
│   │   ├── components/         # Mobile-specific UI components
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── api/                    # Fastify Node.js backend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── titles.ts       # /titles/search, /titles/:id
│       │   │   ├── discover.ts     # /discover/top, /discover/new-releases
│       │   │   ├── services.ts     # /services
│       │   │   ├── auth.ts         # /auth/register, /auth/login, etc.
│       │   │   └── users.ts        # /users/me, /users/me/watchlist
│       │   ├── services/           # Business logic layer
│       │   │   ├── titleService.ts
│       │   │   ├── availabilityService.ts
│       │   │   ├── discoverService.ts
│       │   │   └── userService.ts
│       │   ├── clients/            # External API clients
│       │   │   ├── tmdb.ts
│       │   │   ├── omdb.ts
│       │   │   └── streamingAvailability.ts
│       │   ├── cache/
│       │   │   └── redis.ts        # Upstash Redis client + cache helpers
│       │   ├── db/
│       │   │   ├── schema.ts       # Drizzle schema (all tables)
│       │   │   ├── migrations/
│       │   │   └── index.ts        # DB client
│       │   ├── middleware/
│       │   │   ├── auth.ts         # JWT verification
│       │   │   └── errorHandler.ts
│       │   ├── plugins/            # Fastify plugins
│       │   └── server.ts           # Entry point
│       ├── .env.example
│       └── package.json
│
├── packages/
│   ├── types/                  # Shared TypeScript types & Zod schemas
│   │   ├── src/
│   │   │   ├── title.ts
│   │   │   ├── user.ts
│   │   │   ├── availability.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── core/                   # Shared business logic: hooks, API client
│       ├── src/
│       │   ├── api/
│       │   │   └── client.ts   # Typed fetch wrapper for the Nothing2See API
│       │   ├── hooks/
│       │   │   ├── useSearch.ts
│       │   │   ├── useDiscover.ts
│       │   │   └── useWatchlist.ts
│       │   └── index.ts
│       └── package.json
│
├── turbo.json                  # Turborepo pipeline config
├── package.json                # Root workspace
└── pnpm-workspace.yaml
```

**Key conventions:**
- All shared types live in `packages/types`. Never duplicate type definitions across apps.
- All external API communication happens in `apps/api/src/clients/`. The frontend never calls external APIs directly.
- React Query hooks in `packages/core` call the Nothing2See API, not third-party APIs.
- Environment variables are never committed. Each app has a `.env.example`.

---

## 9. Environment Variables Reference

### `apps/api/.env`

```bash
# Server
PORT=3001
NODE_ENV=development

# Database (Supabase)
DATABASE_URL=postgresql://...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# External APIs
TMDB_API_KEY=...
OMDB_API_KEY=...
STREAMING_AVAILABILITY_API_KEY=...     # RapidAPI key

# Auth (Phase 2)
JWT_SECRET=...
JWT_REFRESH_SECRET=...
```

### `apps/web/.env`

```bash
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

---

## Appendix: Key Decisions Log

| Decision | Alternatives Considered | Reason Chosen |
|----------|------------------------|---------------|
| REST over GraphQL | GraphQL | MVP has simple, predictable queries. GraphQL adds complexity without benefit at this scale. |
| Fastify over Express | Express, Hono | Fastify is faster, has schema validation built in, and is better typed. Hono is great but less mature ecosystem. |
| Drizzle over Prisma | Prisma, Sequelize | Drizzle is lighter, has no code generation step, and works well with edge runtimes if needed later. |
| Zustand over Redux | Redux Toolkit, Jotai | Redux is overkill for MVP. Zustand has the simplest API for the state complexity we have. |
| Turborepo over Nx | Nx, simple npm workspaces | Turborepo is lower config, well-supported, and sufficient for 2 apps + 2 packages. |
| Upstash Redis over self-hosted | ElastiCache, Railway Redis add-on | Serverless, zero-ops, free tier, HTTP-based (works from edge). |
| OMDb for IMDb ratings over scraping | Scraping IMDb directly | Scraping IMDb violates ToS. OMDb is a legitimate, cheap API that sources from IMDb data. |
