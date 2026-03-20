# Nothing2See — Phase 1 Review Checklist

**Version:** 1.0
**Date:** 2026-03-20
**Reviewer Role:** Code Reviewer & Product Manager
**Scope:** Phase 1 — Core Search & Availability (Use Cases 1 & 2)

---

## Reviewer's Opening Notes

Before working through the full checklist, these are the five things I would most want to verify in the developer's implementation, and why they are the most critical for Phase 1 success.

**1. Redis caching is actually protecting the Streaming Availability API.**
The free tier of the Streaming Availability API allows only 100 requests per day. Without aggressive Redis caching (12h TTL, correct cache key construction including region), this budget will be exhausted within minutes of real traffic. A cache miss on every request is not just a cost problem — it will break the app entirely under any meaningful load. This is the single highest-risk integration point in Phase 1.

**2. The region parameter flows correctly through every layer.**
Region awareness is described in the architecture as a "first-class concern." It must flow correctly from the frontend selector → query param → API handler → cache key → Streaming Availability API call → response filtering. A bug at any single layer — for example, a hardcoded `US` default somewhere in the service layer, or a cache key that omits the region — will silently serve wrong availability data to all non-US users, which is the core product failure mode.

**3. The TMDB → OMDb → Streaming Availability merge produces a complete, correct response envelope.**
The entire Phase 1 value proposition depends on three external API calls being merged into one clean response. The reviewer should trace a real search request end-to-end to confirm: (a) the IMDb ID obtained from TMDB is correctly passed to OMDb, (b) OMDb failure gracefully falls back to TMDB vote average, and (c) the merged object matches the exact shape documented in ARCHITECTURE.md section 5.1. A shape mismatch here breaks the frontend cards silently.

**4. No API keys appear anywhere in source code or git history.**
With three paid external APIs (TMDB, OMDb, Streaming Availability), a single accidentally committed key is a security and cost incident. The reviewer must check not just the current HEAD but also run a git log scan for any accidental key commits that may have been "removed" in a later commit but remain in history. All three keys must be loaded exclusively from environment variables.

**5. The search and discover pages satisfy the Use Case 1 and Use Case 2 acceptance criteria from the PRD.**
Phase 1 is defined as done when a user can search a title and see accurate availability for their region, and when a user can select services and receive a ranked recommendation list. These are product-level acceptance criteria, not just technical ones. The reviewer must manually test representative cases — including a title not available in the user's region, a partial/fuzzy search query, and the top-30 discover flow filtered by service and type — before signing off.

---

## 1. Architecture & Code Quality

### 1.1 Monorepo Structure

- [ ] The root directory contains `apps/`, `packages/`, `turbo.json`, `package.json`, and `pnpm-workspace.yaml` exactly as specified in ARCHITECTURE.md section 8.
- [ ] `apps/web/` exists and contains a React + Vite application.
- [ ] `apps/api/` exists and contains a Fastify Node.js application.
- [ ] `apps/mobile/` exists as a placeholder or is explicitly noted as Phase 3 scaffolding only.
- [ ] `packages/types/` exists with `src/title.ts`, `src/user.ts`, `src/availability.ts`, and `src/index.ts`.
- [ ] `packages/core/` exists with `src/api/client.ts` and `src/hooks/` (at minimum `useSearch.ts` and `useDiscover.ts`).
- [ ] `turbo.json` defines a pipeline for `dev`, `build`, `lint`, and `typecheck` tasks.
- [ ] `pnpm-workspace.yaml` correctly declares all workspace packages.

### 1.2 Shared Types

- [ ] All shared TypeScript types (Title, Availability, StreamingService, API response envelopes) are defined exclusively in `packages/types`.
- [ ] There are no duplicate type definitions in `apps/web/src/` or `apps/api/src/` that re-declare what is already in `packages/types`.
- [ ] `packages/types` exports Zod schemas alongside (or as the source of) TypeScript types, so that the same schema is used for runtime validation on the API and type inference on the frontend.
- [ ] The `availability.ts` type correctly models the per-region, per-service shape shown in ARCHITECTURE.md section 5.1 (includes `service`, `display_name`, `region`, `available`, and optionally `link` and `quality`).

### 1.3 API Layer Separation

- [ ] All communication with TMDB, OMDb, and the Streaming Availability API is isolated inside `apps/api/src/clients/`.
- [ ] `apps/api/src/clients/tmdb.ts` exists and contains only TMDB-specific HTTP logic.
- [ ] `apps/api/src/clients/omdb.ts` exists and contains only OMDb-specific HTTP logic.
- [ ] `apps/api/src/clients/streamingAvailability.ts` exists and contains only Streaming Availability API-specific HTTP logic.
- [ ] Route handlers in `apps/api/src/routes/` do not make direct HTTP calls to any external API — all external calls are delegated to clients or services.
- [ ] The frontend (`apps/web/` and `packages/core/`) never calls TMDB, OMDb, or the Streaming Availability API directly. All data fetching goes through the Nothing2See API.

### 1.4 Business Logic Placement

- [ ] Business logic (merging metadata, applying filters, ranking by IMDb score, enforcing minimum vote counts) lives in `apps/api/src/services/`, not in route handlers.
- [ ] `apps/api/src/services/titleService.ts` exists and handles orchestration of TMDB + OMDb + Streaming Availability data.
- [ ] `apps/api/src/services/availabilityService.ts` exists and handles availability lookups and caching.
- [ ] `apps/api/src/services/discoverService.ts` exists and handles the top-30 ranking and filtering logic.
- [ ] Route handlers are thin: they validate input, call a service, and return the response envelope.

### 1.5 Validation

- [ ] Every Phase 1 route validates incoming query parameters using Zod schemas.
- [ ] Validation schemas are sourced from (or consistent with) `packages/types`, not defined ad-hoc inside route files.
- [ ] Invalid requests (e.g., missing `q` parameter on `/titles/search`, non-ISO-3166 region codes) return a 400 response with the standard error envelope, not an unhandled 500.
- [ ] The `limit` parameter on `/titles/search` enforces a maximum of 50 (as specified in ARCHITECTURE.md section 5.1).

### 1.6 TypeScript Configuration

- [ ] TypeScript strict mode is enabled (`"strict": true`) in every `tsconfig.json` across `apps/api`, `apps/web`, `packages/types`, and `packages/core`.
- [ ] There are no `@ts-ignore` or `@ts-expect-error` suppressions in production code paths (test files are acceptable).
- [ ] There are no implicit `any` types in the codebase.

---

## 2. API Correctness

### 2.1 `GET /titles/search`

- [ ] The endpoint exists at the path `/api/v1/titles/search` (versioned base URL).
- [ ] Accepts `q` (required), `region` (optional, default `US`), `type` (optional), `page` (optional, default `1`), and `limit` (optional, default `20`, max `50`) as documented.
- [ ] Returns the standard success envelope: `{ "success": true, "data": [...], "meta": { "page": ..., "total": ... } }`.
- [ ] Each item in `data` includes: `tmdb_id`, `imdb_id`, `title`, `type`, `release_year`, `poster_url`, `imdb_rating`, `genres`, and `availability` array — matching the shape in ARCHITECTURE.md section 5.1 exactly.
- [ ] The `availability` array is scoped to the requested `region` (not all regions mixed together unless the `regions` multi-param is used).
- [ ] Missing `q` parameter returns HTTP 400 with `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- [ ] A query that returns no results returns HTTP 200 with `{ "success": true, "data": [] }`, not a 404.
- [ ] A title not available in the requested region is still returned in results, but with an empty or `available: false` `availability` array (so the frontend can display "Not available in [region]").
- [ ] The endpoint handles TMDB search returning zero results gracefully (empty data array, no 500).

### 2.2 `GET /titles/:tmdb_id`

- [ ] The endpoint exists at `/api/v1/titles/:tmdb_id`.
- [ ] Accepts `region` (optional, default `US`) and `regions` (comma-separated, optional) query params.
- [ ] Returns the standard success envelope with a single title object (not an array).
- [ ] Returns HTTP 404 with the standard error envelope when the `tmdb_id` does not resolve to a known title.
- [ ] Returns HTTP 400 for a non-numeric `:tmdb_id` parameter.

### 2.3 `GET /discover/top`

- [ ] The endpoint exists at `/api/v1/discover/top`.
- [ ] `region` is **required** for this endpoint, as documented in ARCHITECTURE.md section 5.2.
- [ ] `services` is **required**, accepts comma-separated slugs (e.g., `netflix,hulu`).
- [ ] Accepts optional `type`, `genre`, and `min_rating` params.
- [ ] Returns at most 30 results, ranked by IMDb rating descending.
- [ ] Only returns titles with a minimum of 1,000 IMDb votes (per PRD Use Case 2 acceptance criteria).
- [ ] Results are filtered to titles available in the specified region on at least one of the specified services.
- [ ] Missing `region` or `services` returns HTTP 400 with the standard error envelope.
- [ ] Response shape matches the same title object shape as `/titles/search`.

### 2.4 `GET /services`

- [ ] The endpoint exists at `/api/v1/services`.
- [ ] Returns an array of service objects: `{ "slug": "...", "display_name": "...", "logo_url": "..." }`.
- [ ] Returns the standard success envelope (even if `services` is returned directly in `data`).
- [ ] The list is not empty and includes at minimum the major services (Netflix, Hulu, Disney+, Amazon Prime, Apple TV+, etc.).

### 2.5 `GET /health`

- [ ] A health check endpoint exists (path may be `/health` or `/api/v1/health` — confirm it is reachable without versioned prefix as well, for load balancer probes).
- [ ] Returns HTTP 200 with a minimal JSON body (e.g., `{ "status": "ok" }`) when the service is healthy.
- [ ] Does not require authentication.

### 2.6 General API Conventions

- [ ] All endpoints use the `/api/v1/` base path prefix.
- [ ] All success responses use the envelope `{ "success": true, "data": ..., "meta": ... }`.
- [ ] All error responses use the envelope `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- [ ] HTTP status codes are used correctly (200 for success, 400 for bad input, 404 for not found, 500 for unexpected server errors).
- [ ] Unhandled exceptions do not leak stack traces or internal error messages to API consumers.
- [ ] CORS is configured to allow requests from the deployed frontend origin (and `localhost:5173` for local development).

---

## 3. Caching

### 3.1 Redis Integration

- [ ] `apps/api/src/cache/redis.ts` exists and implements an Upstash Redis client using the environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- [ ] A cache-aside pattern is implemented: check Redis first; on miss, fetch from external APIs, store in Redis, then return.
- [ ] Cache keys are deterministic and include all parameters that affect the result — critically, the `region` parameter must be part of every cache key for availability data.
- [ ] Cache keys follow a consistent naming convention (e.g., `titles:search:inception:US`, `titles:27205:US`, `discover:top:netflix,hulu:US`).

### 3.2 TTL Configuration

- [ ] Availability data (Streaming Availability API responses) is cached with a TTL of **12 hours**, as specified in ARCHITECTURE.md section 2.3.
- [ ] IMDb rating data (OMDb responses) is cached with a TTL of **24 hours**, as specified in ARCHITECTURE.md section 2.3.
- [ ] TMDB metadata responses are cached (TTL is at developer discretion, but must be documented).
- [ ] TTL values are defined as named constants, not magic numbers scattered through the codebase.

### 3.3 Resilience

- [ ] If Redis is unavailable (connection refused, timeout), the application falls back gracefully to fetching directly from external APIs rather than returning a 500 error.
- [ ] Redis errors are logged but do not propagate as user-visible failures.
- [ ] There is no scenario where a Redis cache failure causes the entire request to fail if the external APIs are available.

---

## 4. External API Integration

### 4.1 TMDB

- [ ] `apps/api/src/clients/tmdb.ts` calls the TMDB search endpoint to retrieve metadata (title, year, type, poster URL, genres, overview).
- [ ] The `imdb_id` is fetched from TMDB's `/movie/:id/external_ids` or equivalent endpoint (not assumed from the search response alone).
- [ ] The TMDB API key is loaded from the `TMDB_API_KEY` environment variable — it is never hardcoded.
- [ ] TMDB API errors (rate limit, invalid key, network timeout) are caught and result in a graceful API error response, not an uncaught exception.
- [ ] Poster URLs are constructed using TMDB's standard image base URL (`https://image.tmdb.org/t/p/w500/...`), not hardcoded to a different size or path.

### 4.2 OMDb

- [ ] `apps/api/src/clients/omdb.ts` queries OMDb **by IMDb ID** (using the `i=tt...` parameter), not by title string.
- [ ] The OMDb API key is loaded from the `OMDB_API_KEY` environment variable — it is never hardcoded.
- [ ] If OMDb returns `{ "Response": "False" }` or has no `imdbRating` value, the code falls back to TMDB's `vote_average` field for the rating display.
- [ ] The fallback behavior is logged so that data quality issues can be monitored.
- [ ] OMDb API errors (rate limit, network timeout) are caught and do not crash the request — the title is still returned with whatever data is available.

### 4.3 Streaming Availability API

- [ ] `apps/api/src/clients/streamingAvailability.ts` queries availability **per region**, passing the correct region parameter with each request.
- [ ] The Streaming Availability API key is loaded from the `STREAMING_AVAILABILITY_API_KEY` environment variable — it is never hardcoded.
- [ ] The response from the Streaming Availability API is correctly mapped to the `availability` array shape used in the Nothing2See API response.
- [ ] The client correctly handles the case where a title is not found in the Streaming Availability API (returns empty availability, does not throw).
- [ ] Rate limit errors (HTTP 429) from the Streaming Availability API are caught and handled — ideally with a logged warning and cached fallback, not a 500 returned to the user.

### 4.4 Environment Variable Hygiene

- [ ] No API keys, database URLs, or secrets appear anywhere in committed source code (check `git log` and `git grep` in addition to current HEAD).
- [ ] `apps/api/.env.example` is present and documents all required variables: `PORT`, `NODE_ENV`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TMDB_API_KEY`, `OMDB_API_KEY`, `STREAMING_AVAILABILITY_API_KEY`.
- [ ] `apps/web/.env.example` is present and documents `VITE_API_BASE_URL`.
- [ ] The application fails fast with a clear error message at startup if any required environment variable is missing (do not let missing keys cause silent failures or cryptic runtime errors).

---

## 5. Frontend

### 5.1 Search Page (Use Case 1)

- [ ] A dedicated Search page exists at `apps/web/src/pages/SearchPage.tsx` (or equivalent route).
- [ ] The page contains a free-text search input that accepts movie and TV show title queries.
- [ ] A 300ms debounce is applied to the search input before triggering an API request (per ARCHITECTURE.md section 6, developer task 7).
- [ ] A region selector is present on the Search page, defaulting to the browser locale or a previously stored preference.
- [ ] Search results are rendered as cards. Each card displays: **title, year, type (movie/series), IMDb rating, poster image, and a list of streaming services where the title is available** (per PRD Use Case 1 acceptance criteria).
- [ ] If a title is not available on any service in the user's region, the card displays a clear "Not available in [region]" message (per PRD Use Case 1 acceptance criteria).
- [ ] If a title is available in other regions but not the user's, a secondary note is shown (e.g., "Available on Netflix UK") — per PRD Use Case 1 acceptance criteria.
- [ ] Partial and fuzzy search matches are surfaced (e.g., "Harry Potter" returns all films in the series). This depends on TMDB's search behavior; confirm the frontend is not applying additional client-side filtering that would suppress valid results.
- [ ] TV show results indicate season-level availability where the data from the Streaming Availability API supports it.
- [ ] A loading state is shown while the search request is in flight.
- [ ] An error state is shown if the API request fails, with a user-friendly message (not a raw error or blank screen).

### 5.2 Discover Page (Use Case 2)

- [ ] A dedicated Discover page exists at `apps/web/src/pages/DiscoverPage.tsx` (or equivalent route).
- [ ] A streaming service multi-select UI is present, allowing users to select one or more services from the supported list.
- [ ] A region selector is present on the Discover page.
- [ ] The top-30 results are displayed in a grid ranked by IMDb rating descending.
- [ ] Each result card shows: **title, year, type, IMDb rating, genre tags, and which of the user's selected services carries it** (per PRD Use Case 2 acceptance criteria).
- [ ] Users can filter results by type (Movies / TV Shows / Both) and by genre (per PRD Use Case 2 acceptance criteria).
- [ ] A maximum of 30 results are shown per query.
- [ ] Results reflect a minimum of 1,000 IMDb votes (this is enforced server-side, but the reviewer should spot-check that low-vote titles are not appearing).
- [ ] A loading state is shown while the discover request is in flight.
- [ ] An error state is shown if the API request fails.
- [ ] If no results are returned for the selected services and region, a clear empty state message is displayed.

### 5.3 Region Persistence

- [ ] The user's selected region is persisted to `localStorage` (per PRD section 5.2 and ARCHITECTURE.md).
- [ ] On page load, the app reads the region from `localStorage` if present, falling back to IP-based geolocation or browser locale.
- [ ] A manually selected region override updates `localStorage` immediately.
- [ ] The region selector is visible and accessible on both the Search and Discover pages without navigating to a settings screen.

### 5.4 Service Selection Persistence

- [ ] The user's selected streaming services are persisted to `localStorage` for unauthenticated users (per PRD Use Case 2 acceptance criteria: "persisted for the session").
- [ ] On returning to the Discover page, previously selected services are pre-populated from `localStorage`.

### 5.5 General Frontend Quality

- [ ] The web app is responsive (mobile-friendly layout, not just desktop) per PRD Phase 1 scope.
- [ ] All interactive elements (search input, service selectors, region selector, filter controls) are keyboard-navigable (PRD section 5.7 WCAG 2.1 AA requirement — at minimum for Phase 1).
- [ ] All poster images include descriptive `alt` text (PRD section 5.7).
- [ ] TanStack Query (React Query) is used for data fetching on the Search and Discover pages, providing caching, loading, and error states.
- [ ] Zustand is used for global state (region, selected services) rather than prop-drilling or context misuse.

---

## 6. Product / Acceptance Criteria

### 6.1 Use Case 1 — Search by Title (PRD section 4, Use Case 1)

- [ ] **AC: Free-text search input** — The search input on the Search page accepts any free-text movie or TV show title.
- [ ] **AC: Results within 2 seconds** — For titles in the top 10,000 by IMDb popularity, a search response is returned in under 2 seconds (test with Redis cache warm; document cold-cache behavior separately).
- [ ] **AC: Card fields** — Each result card shows title, year, type (movie/series), IMDb rating, poster image, and a list of streaming services where the title is available.
- [ ] **AC: Region-scoped availability** — Availability shown on each card is scoped to the user's detected or manually selected region, not a global union.
- [ ] **AC: "Not available in [region]"** — When a title is not available on any service in the user's region, the card clearly states this (not a blank availability section).
- [ ] **AC: Cross-region hint** — When a title is available in other regions but not the user's, a secondary note indicates this (e.g., "Available on Netflix UK").
- [ ] **AC: Fuzzy/partial matches** — Searching "Harry Potter" returns all Harry Potter films. Searching a partial title (e.g., "Incep") returns "Inception" and similar titles.
- [ ] **AC: TV show season-level availability** — TV show results distinguish season-level availability where the Streaming Availability API data supports it.

### 6.2 Use Case 2 — Recommended Content by Service (PRD section 4, Use Case 2)

- [ ] **AC: Multi-service selection** — Users can select one or more services from the supported provider list on the Discover page.
- [ ] **AC: Session persistence** — Selected services and region are persisted for the session (and across sessions via localStorage for unauthenticated users).
- [ ] **AC: Region-filtered results** — Results are filtered to content available in the user's region on at least one of the selected services — no out-of-region titles appear.
- [ ] **AC: IMDb ranking with vote floor** — Results are ranked by IMDb rating descending. Titles with fewer than 1,000 IMDb votes are excluded.
- [ ] **AC: Maximum 30 results** — No more than 30 results are shown per query.
- [ ] **AC: Card fields** — Each card shows title, year, type, IMDb rating, genre tags, and which of the user's selected services carries it.
- [ ] **AC: Type and genre filters** — Users can filter results by type (Movies / TV Shows / Both) and by genre.
- [ ] **AC: Near-real-time availability** — Results reflect availability data refreshed within the last 24 hours (the 12h Redis TTL on availability data satisfies this — confirm TTL is applied correctly).

---

## 7. Security

### 7.1 Secret Management

- [ ] No API keys (TMDB, OMDb, Streaming Availability) appear in any committed file, including `.env` files, config files, or comments.
- [ ] `git log -p | grep -i "api_key\|secret\|token\|password"` (or equivalent) produces no findings in the repo history.
- [ ] The `VITE_API_BASE_URL` in `apps/web/.env` is the only frontend environment variable and does not expose any secret.
- [ ] The Vite frontend does not expose `VITE_TMDB_API_KEY` or any other third-party key — these belong exclusively on the API server.

### 7.2 `.gitignore`

- [ ] `.env` files are listed in `.gitignore` at the repo root (or at each app level).
- [ ] `node_modules/` is in `.gitignore`.
- [ ] No `.env` file (other than `.env.example`) is tracked by git.

### 7.3 CORS

- [ ] CORS is configured in the Fastify server to allow requests from the production frontend URL and from `localhost` during development.
- [ ] CORS is not set to `*` (wildcard) in production configuration.
- [ ] The CORS allowed-origins list is loaded from an environment variable, not hardcoded.

### 7.4 Input Handling

- [ ] Query parameters are validated and sanitized before use (Zod schemas handle this — confirm they are applied before any parameter is used in a cache key, database query, or external API call).
- [ ] There are no SQL injection vectors (Drizzle ORM with parameterized queries provides this — confirm raw SQL strings are not used).

---

## 8. Developer Experience

### 8.1 Documentation

- [ ] A `README.md` exists at the repo root with: project overview, prerequisites, setup instructions (clone → install → configure env → run dev), and a description of the monorepo structure.
- [ ] Setup instructions cover running `pnpm install` at the repo root and starting all apps with a single command (e.g., `pnpm dev`).
- [ ] The README documents the required environment variables or links to `.env.example` files.

### 8.2 Environment Setup

- [ ] `apps/api/.env.example` is present and populated with all variables listed in ARCHITECTURE.md section 9.
- [ ] `apps/web/.env.example` is present and contains `VITE_API_BASE_URL`.
- [ ] Example values in `.env.example` files are clearly placeholder values (e.g., `your_tmdb_api_key_here`), not real credentials.

### 8.3 Scripts & Tooling

- [ ] `pnpm dev` (from the repo root, via Turborepo) starts both `apps/web` and `apps/api` in development mode concurrently.
- [ ] `pnpm build` produces production builds for both apps without errors.
- [ ] `pnpm lint` runs ESLint across all workspaces and passes cleanly.
- [ ] `pnpm typecheck` runs `tsc --noEmit` across all workspaces and passes cleanly with no TypeScript errors.
- [ ] `turbo.json` defines correct task dependencies (e.g., `build` depends on `^build` so `packages/types` is built before `apps/`).

### 8.4 CI Pipeline

- [ ] A `.github/workflows/ci.yml` file exists.
- [ ] The CI pipeline runs on pull requests to `main`.
- [ ] CI executes: install, lint, typecheck, and (if present) tests.
- [ ] CI fails the PR if any of the above steps fail.
- [ ] A `.github/workflows/deploy.yml` file exists (or is explicitly noted as a TODO for Phase 1 completion) for deploying on merge to `main`.

---

## 9. Known Risks to Verify

Based on the risks documented in ARCHITECTURE.md section 7:

### 9.1 Streaming Availability API Rate Limit Risk

- [ ] Redis caching is applied to every Streaming Availability API call — there should be no code path that calls the Streaming Availability API without first checking the cache.
- [ ] Cache keys for availability data include the `region` parameter, so that availability for `netflix/US` and `netflix/IL` are stored as separate cache entries (not overwriting each other).
- [ ] The free-tier limit (100 req/day) is acknowledged in the README or a developer note, with guidance to upgrade to a paid tier before any production traffic.
- [ ] WATCHMODE is either integrated as a fallback or there is a documented plan for using it if the primary Streaming Availability API becomes unavailable or prohibitively expensive.

### 9.2 Region Detection Errors

- [ ] The region selector is visible on every page that displays availability data (Search and Discover). It must not be hidden in a settings screen only.
- [ ] Region is always overridable by the user with no friction — a single click or selection, not a multi-step flow.
- [ ] The app never silently falls back to a default region (e.g., `US`) without informing the user what region is currently active.
- [ ] The currently active region is always displayed in the UI (not just selectable but invisible when unchanged from default).
- [ ] Region preference is stored in `localStorage` for unauthenticated users so that it persists across page refreshes and new sessions.

### 9.3 OMDb Data Accuracy and Fallback

- [ ] When OMDb returns `{ "Response": "False" }` or an `imdbRating` of `"N/A"`, the code does not display `null`, `undefined`, or `NaN` to the user.
- [ ] The fallback to TMDB's `vote_average` is implemented and tested with a title that has no OMDb rating.
- [ ] When the fallback is used, the UI either labels the rating appropriately (e.g., "TMDB Rating" instead of "IMDb Rating") or clearly indicates limited data availability — it does not falsely present a TMDB score as an IMDb score.
- [ ] The 1,000-vote minimum for `/discover/top` is applied based on `imdb_votes` from the data model — if `imdb_votes` is null due to a missing OMDb response, the title is excluded from discovery results rather than incorrectly included.

---

*End of Checklist*
