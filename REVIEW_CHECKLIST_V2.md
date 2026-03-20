# Nothing2See — Phase 2 Review Checklist

**Version:** 1.0
**Date:** 2026-03-20
**Reviewer:** Code Reviewer & Product Manager
**Phase:** 2 — Discovery & Engagement (Weeks 7–10)
**Status:** Pre-merge

> Instructions: Work through each section before approving any Phase 2 PR. Mark each item `[x]` when verified, `[-]` when not applicable, or `[!]` when a concern is raised. Add a comment inline for any `[!]` item.

---

## Table of Contents

1. [Auth & Security](#1-auth--security)
2. [Watchlist](#2-watchlist)
3. [What's New Feed](#3-whats-new-feed)
4. [Email Notifications](#4-email-notifications)
5. [GDPR](#5-gdpr)
6. [Session Persistence](#6-session-persistence)
7. [Frontend](#7-frontend)
8. [PRD Acceptance Criteria — Use Case 3 (What's New)](#8-prd-acceptance-criteria--use-case-3-whats-new-this-week)
9. [PRD Acceptance Criteria — Use Case 4 (Watchlist)](#9-prd-acceptance-criteria--use-case-4-watchlist)
10. [Architecture Conformance](#10-architecture-conformance)
11. [Definition of Done (Phase 2)](#11-definition-of-done-phase-2)

---

## 1. Auth & Security

### Token Handling

- [ ] The refresh token is stored in an `httpOnly` cookie — confirm it is **not** placed in `localStorage`, `sessionStorage`, or any JS-accessible location.
- [ ] The access token (JWT) has a short TTL of **15 minutes or less** — verify the `exp` claim in the token payload and the Better Auth / JWT signing configuration.
- [ ] The refresh token has a distinct, longer TTL (e.g. 7–30 days) and its expiry is enforced server-side, not just client-side.
- [ ] The `auth.ts` JWT middleware in `apps/api/src/middleware/auth.ts` correctly blocks all requests to protected routes when no valid access token is present — returns `401`, not a 500 or silent pass-through.
- [ ] Expired or tampered JWTs are rejected with a `401` and do not cause unhandled exceptions.
- [ ] `POST /auth/refresh` validates the httpOnly refresh token cookie, issues a new access token, and rotates the refresh token (single-use or sliding window) to prevent replay attacks.
- [ ] `POST /auth/logout` invalidates / deletes the refresh token server-side (DB or blocklist) so it cannot be reused after logout.

### Credentials & Secrets

- [ ] Google OAuth `client_id` and `client_secret` are loaded from environment variables only — confirm no hardcoded values appear anywhere in source code (search for `GOCSPX-`, `client_secret`, and the literal credential values).
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are set in `.env` and referenced only via `process.env` — never interpolated into client-side bundles.
- [ ] `apps/api/.env.example` documents the required Phase 2 env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) without real values.
- [ ] `.gitignore` includes all `.env` files — run `git log --all --full-history -- '**/.env'` to confirm no `.env` file has ever been committed.

### OAuth & CSRF

- [ ] The Google OAuth callback endpoint validates the `state` parameter (anti-CSRF nonce) before exchanging the authorization code for tokens.
- [ ] The OAuth `redirect_uri` is validated against an allowlist — it cannot be overridden by a query parameter at runtime.
- [ ] The OAuth callback does not expose the authorization `code` in logs, error responses, or redirect URLs.

### SQL Injection

- [ ] All database queries use Drizzle ORM's parameterized query builders — no raw SQL string concatenation is used anywhere in `apps/api/src/`.
- [ ] Any Drizzle `sql` template tag usages (for raw expressions) are reviewed individually to confirm user input is never interpolated directly.

### General

- [ ] All Phase 2 endpoints that operate on user data (`/users/me/*`, `/users/me/watchlist/*`) apply the JWT middleware — no endpoint is accidentally left unprotected.
- [ ] Rate limiting is applied to auth endpoints (`/auth/login`, `/auth/refresh`, `/auth/register`) to mitigate brute-force and token-stuffing attacks.
- [ ] Error messages from auth endpoints do not reveal whether an email address exists in the system (use generic "Invalid credentials" messages).

---

## 2. Watchlist

### Cap Enforcement

- [ ] The 100-item hard cap is enforced **server-side** in the `POST /users/me/watchlist` handler — a request that would exceed 100 items returns `400` or `422` with a clear error message.
- [ ] The cap is **not** enforced only on the client — verify the server rejects the request even if the frontend guard is bypassed (e.g. via direct API call).
- [ ] The error response for a full watchlist includes a human-readable message (e.g. `"Watchlist is full. Remove a title before adding a new one."`) that the frontend can surface to the user.

### Data Correctness

- [ ] `GET /users/me/watchlist` response includes, for each entry: `poster_url`, `title`, `imdb_rating`, `added_at`, current availability on the user's selected services (filtered to their region), and `watched` status.
- [ ] Availability data in the watchlist response is sourced from the same availability pipeline as the rest of the app (not a stale snapshot stored at add-time).
- [ ] Titles that are no longer available on any of the user's selected services are flagged in the response (e.g. an `available: false` or `flagged: true` field) so the frontend can render the "No longer available" visual state.
- [ ] The `watched` boolean field exists on each watchlist entry and is correctly toggled by `PATCH /users/me/watchlist/:tmdb_id` with `{ "watched": true }`.

### Authorization

- [ ] Every watchlist endpoint resolves the user ID from the verified JWT — the `user_id` in the watchlist query is never taken from a request body or query parameter.
- [ ] `DELETE /users/me/watchlist/:tmdb_id` returns `404` if the specified title is not on the authenticated user's watchlist (not a silent `200`).
- [ ] Cross-user access is impossible: a request with User A's token cannot read, modify, or delete entries from User B's watchlist — verify the DB query always scopes by the authenticated `user_id`.
- [ ] `POST /users/me/watchlist` returns `409 Conflict` (or equivalent) if the title is already on the watchlist, rather than creating a duplicate row (the `UNIQUE (user_id, title_id)` constraint must be surfaced gracefully).

### Data Model

- [ ] The `watchlist` table in `apps/api/src/db/schema.ts` has the `UNIQUE (user_id, title_id)` constraint as specified in the architecture.
- [ ] `ON DELETE CASCADE` is set on `user_id` so that deleting a user's account removes their watchlist entries.

---

## 3. What's New Feed

### "New" Definition

- [ ] The feed is populated based on the **date a title was first made available on the streaming service** — not the title's original theatrical or VOD release date.
- [ ] The availability timestamp used for the 7-day window maps to a field like `availability.first_seen_at` or equivalent — confirm this field is being set correctly when new availability records are written.
- [ ] The 7-day window is calculated server-side from `NOW() - INTERVAL '7 days'` (or equivalent) — it is not computed on the client and passed as a query parameter.

### Filtering & Ranking

- [ ] The feed is filtered to the authenticated user's saved services and region — it does not include titles from services the user has not selected.
- [ ] The feed endpoint reads the user's service and region preferences from the DB (not from query parameters that a client could manipulate).
- [ ] Results are ranked by IMDb rating descending.
- [ ] A minimum vote threshold of **500 IMDb votes** is applied before ranking (per PRD Use Case 3).
- [ ] Newly released theatrical films with fewer than 500 votes are surfaced with a "New Release" badge rather than being excluded entirely (per PRD Use Case 3).
- [ ] Filters for `type` (Movies / TV Shows) and `genre` are functional and correctly applied server-side.

### Freshness

- [ ] The feed data is refreshed at least once every 24 hours via the availability data pipeline — confirm the cron job or scheduled task is in place.
- [ ] Each card in the feed includes the date the title became available on the service.
- [ ] If no titles have been added in the past 7 days for the user's services, the endpoint returns an empty array (not an error), and the frontend renders a clear empty state with guidance.

---

## 4. Email Notifications

### Trigger Logic

- [ ] Email is sent **only** when a watchlisted title transitions from unavailable to available on one of the user's services — it is not sent on every availability check run.
- [ ] The notification trigger logic uses a state-change comparison (previous availability vs. current availability), not a simple "is available now" check.
- [ ] The availability change detection job stores the previous availability state so it can compute the delta.

### Credentials & Configuration

- [ ] SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) are stored in environment variables only — not hardcoded in the mailer service.
- [ ] The `From` address in notification emails matches the domain and is configured via env var (not hardcoded).

### Rate Limiting & Deduplication

- [ ] A deduplication mechanism is in place to prevent sending the same "title is now available" email more than once for the same user/title/service combination.
- [ ] If the availability check job runs more frequently than the email deduplication window, duplicate emails cannot be triggered (e.g. use a `notified_at` timestamp or a sent-notifications log table).
- [ ] There is a per-user rate limit or cooldown on notification emails to prevent a thunderstorm of emails if many titles become available simultaneously.
- [ ] Users can opt out of email notifications — confirm there is either an opt-out preference field or that the PRD's "optionally an email notification" language is reflected in the UI (email notifications are opt-in, not mandatory).

### Content & Deliverability

- [ ] The email body includes the title name, the service it is now available on, and a link to the Nothing2See watchlist page.
- [ ] Emails are sent with a plain-text fallback in addition to any HTML version.
- [ ] The email sending step is handled asynchronously (queued or fire-and-forget) so that it does not block the availability check job or any API response.

---

## 5. GDPR

### Consent Banner

- [ ] The GDPR consent banner is shown on the user's **first visit** — it does not appear on every page load.
- [ ] Consent state is stored in `localStorage` (e.g. key `gdpr_consent`) so the banner does not reappear after acceptance.
- [ ] The banner does not set any non-essential cookies or tracking scripts before the user grants consent.
- [ ] The banner provides a genuine choice — it does not use dark patterns (pre-ticked boxes, no "reject" option, misleading button labels).
- [ ] The banner includes a link to the privacy policy page.

### Privacy Policy

- [ ] A privacy policy page exists and is accessible from the consent banner and from the footer/navigation.
- [ ] The privacy policy accurately describes what data is stored: email address, OAuth provider identifier, region preference, service selections, watchlist contents.
- [ ] The privacy policy states that **no passwords are stored** (OAuth only) and that no PII beyond email and OAuth token is retained (per PRD Section 5.6).
- [ ] The privacy policy identifies the data controller, their contact method, and the legal basis for processing (legitimate interest / contractual necessity for EU users).
- [ ] The privacy policy describes the user's rights under GDPR: access, rectification, erasure, portability, and the right to withdraw consent.

### Data Deletion

- [ ] There is a mechanism for users to delete their account and all associated data — confirm this is accessible from the profile/settings page.
- [ ] Account deletion cascades to all related data: `user_services`, `watchlist`, `user_genre_preferences` (verify `ON DELETE CASCADE` on all FK references to `users.id`).
- [ ] The deletion endpoint is protected — a user can only delete their own account, not another user's.
- [ ] After deletion, the user's session is immediately invalidated (refresh token removed, access token cannot be refreshed).

---

## 6. Session Persistence

### Login Sync (DB → Store)

- [ ] When a user logs in, their saved `region` from the `users` table is loaded and written to the Zustand store, overriding any previously cached localStorage value.
- [ ] When a user logs in, their saved services from the `user_services` table are loaded and written to the Zustand store.
- [ ] If the DB values differ from the browser's localStorage values (e.g. the user last used a different device), the DB values take precedence.
- [ ] The sync happens as part of the login flow (e.g. on the `/auth/login` response or the `GET /users/me` call) — users do not see a stale state before the sync completes.

### Update Sync (Store → DB)

- [ ] When an authenticated user changes their region, the new value is persisted to `users.region` via `PATCH /users/me` — it is not only saved to localStorage.
- [ ] When an authenticated user changes their selected services, the new selection is persisted to `user_services` via `PUT /users/me/services` — not only to localStorage.
- [ ] Both update calls are made on user action (or debounced), not only on logout, so that changes are not lost if the session expires or the tab is closed.
- [ ] The `updated_at` timestamp on the `users` row is updated when region or services change (via Drizzle `updated_at` trigger or explicit update).

---

## 7. Frontend

### Route Protection

- [ ] The Watchlist page (`/watchlist`) is wrapped in an `AuthGuard` component (or equivalent) that redirects unauthenticated users to the login flow.
- [ ] The Profile page is likewise protected by `AuthGuard`.
- [ ] Unauthenticated users who navigate directly to a protected URL are redirected and then returned to the intended destination after login (post-login redirect).
- [ ] Protected API calls include the access token in the `Authorization: Bearer <token>` header — not as a query parameter.

### TitleCard Component

- [ ] The "Add to Watchlist" button on `TitleCard` is only rendered when the user is authenticated — unauthenticated users do not see the button (or see a prompt to log in).
- [ ] The button provides immediate optimistic UI feedback (e.g. filled vs. empty bookmark icon) before the API call resolves.
- [ ] If the watchlist is full (100 items), the button is disabled or the user receives a clear message — the UI does not silently fail.
- [ ] The "Report incorrect availability" button is present on all title cards (authenticated and unauthenticated, per PRD Section 5.5) and submits a report to the backend feedback log.

### GDPR Banner

- [ ] The consent banner does not re-appear after the user has accepted — the `localStorage` flag is read on app init and the banner is conditionally rendered.
- [ ] The banner is dismissed (not just hidden) — it is removed from the DOM after consent so it does not affect layout or tab order.
- [ ] The banner is keyboard-navigable and screen-reader accessible (WCAG 2.1 AA).

### Sign Out Flow

- [ ] Clicking "Sign Out" calls `POST /auth/logout` to invalidate the refresh token server-side.
- [ ] After logout, the Zustand auth store is cleared (user object set to `null`, access token cleared from memory).
- [ ] After logout, the httpOnly refresh token cookie is cleared (either the server sets `Set-Cookie` with `Max-Age=0`, or the client confirms the cookie is gone).
- [ ] After logout, the user is redirected to the home or login page — they cannot navigate back to a protected page without re-authenticating.
- [ ] Cached TanStack Query data for user-specific resources (`/users/me`, `/users/me/watchlist`) is invalidated or cleared on logout so stale data is not shown on re-login.

### General UI

- [ ] The "What's New" feed is accessible from the home screen without additional input once services are configured (per PRD Use Case 3).
- [ ] The feed displays which service each title is available on and the date it became available.
- [ ] The watchlist page shows the date each title was added (`added_at`).
- [ ] Loading and error states are handled gracefully on all new Phase 2 screens — no blank screens, no unhandled promise rejections surfaced to the user.

---

## 8. PRD Acceptance Criteria — Use Case 3 (What's New This Week)

> Source: PRD.md, Use Case 3, Acceptance Criteria section.

- [ ] **AC-3.1** — The feed is accessible from the home screen without any additional input once services are configured.
- [ ] **AC-3.2** — Titles in the feed are filtered to the user's selected services and region.
- [ ] **AC-3.3** — "New" is defined as: first made available on any of the user's selected services within the past 7 days — not the content's original release date.
- [ ] **AC-3.4** — Results are ranked by IMDb rating descending with a minimum of 500 votes required.
- [ ] **AC-3.5** — Newly released theatrical films with fewer than 500 votes are surfaced with a "New Release" badge rather than being excluded.
- [ ] **AC-3.6** — The feed is refreshed at least once every 24 hours.
- [ ] **AC-3.7** — Users can filter the feed by type (Movies / TV Shows) and genre.
- [ ] **AC-3.8** — Each card indicates which service the title is available on and the date it became available.
- [ ] **AC-3.9** — If no new content has been added in the past 7 days for the user's selected services, a clear empty state message is shown with a suggestion to expand services or check back later.

---

## 9. PRD Acceptance Criteria — Use Case 4 (Watchlist)

> Source: PRD.md, Use Case 4, Acceptance Criteria section.

- [ ] **AC-4.1** — Any authenticated user can add a title to their watchlist from any result card with a single tap or click.
- [ ] **AC-4.2** — The watchlist is accessible from a dedicated screen.
- [ ] **AC-4.3** — The watchlist persists across sessions (data is stored in the DB, not only in browser state).
- [ ] **AC-4.4** — Each watchlist entry shows: poster, title, IMDb rating, current availability on the user's services, and the date it was added.
- [ ] **AC-4.5** — If a title on the watchlist is no longer available on any of the user's services, it is flagged visually (e.g. "No longer available" label).
- [ ] **AC-4.6** — If a title on the watchlist becomes available on one of the user's services, the user receives an in-app notification.
- [ ] **AC-4.7** — If a title on the watchlist becomes available on one of the user's services, the user optionally receives an email notification.
- [ ] **AC-4.8** — Users can remove titles from the watchlist individually.
- [ ] **AC-4.9** — Users can clear all titles from the watchlist at once.
- [ ] **AC-4.10** — The watchlist is hard-capped at 100 titles per user, with a clear message displayed when the cap is reached.
- [ ] **AC-4.11** — The watchlist requires user authentication — unauthenticated users cannot access or create a watchlist.

---

## 10. Architecture Conformance

> Verify that the implementation matches the decisions recorded in ARCHITECTURE.md.

### API Design

- [ ] All Phase 2 endpoints follow the base URL pattern `https://api.nothing2see.app/api/v1` (versioned from day one, per Section 5).
- [ ] All responses follow the envelope format: `{ "success": true, "data": {...}, "meta": {...} }`.
- [ ] Error responses follow the format: `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- [ ] Watchlist endpoints are implemented as specified in Section 5.5: `GET`, `POST`, `DELETE`, `PATCH` on `/users/me/watchlist` and `/users/me/watchlist/:tmdb_id`.
- [ ] User/auth endpoints are implemented as specified in Section 5.4 (login, refresh, logout, `GET/PATCH /users/me`, `GET/PUT /users/me/services`).

### Data Model

- [ ] The `users`, `user_services`, `watchlist`, and `user_genre_preferences` tables are present in the Drizzle schema (`apps/api/src/db/schema.ts`) with the exact column definitions specified in Section 4.2.
- [ ] The `watchlist` table has `UNIQUE (user_id, title_id)` and `ON DELETE CASCADE` on `user_id`.
- [ ] The `user_services` table has `PRIMARY KEY (user_id, service_id)` and `ON DELETE CASCADE` on both FK columns.

### Separation of Concerns

- [ ] Business logic for watchlist operations lives in `apps/api/src/services/userService.ts` (or a dedicated `watchlistService.ts`) — not inline in the route handler.
- [ ] The frontend never calls external APIs (TMDB, OMDb, Streaming Availability) directly — all calls go through the Nothing2See API.
- [ ] Shared TypeScript types for Phase 2 (`User`, `WatchlistEntry`, auth token shapes) are defined in `packages/types` and imported by both `apps/web` and `apps/api` — not duplicated.

### Environment Variables

- [ ] The Phase 2 env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and SMTP credentials) are documented in `apps/api/.env.example`.
- [ ] No Phase 2 secrets are committed to the repository or present in `apps/web/.env` (frontend env is `VITE_`-prefixed and must not contain secrets).

---

## 11. Definition of Done (Phase 2)

> From PRD.md, Phase 2 Definition of Done section. All four items must be verifiable before Phase 2 is considered complete.

- [ ] **DoD-2.1** — An authenticated user can maintain a persistent watchlist across sessions (add, view, remove, mark watched — all data survives a full browser close and re-open).
- [ ] **DoD-2.2** — The "What's New" feed accurately reflects titles added to the user's services in the past 7 days (verify against a known availability dataset or staging environment with controlled data).
- [ ] **DoD-2.3** — Users receive email notifications when a watchlisted title becomes available on one of their services (verify end-to-end in staging with a real SMTP send or a sandbox mailer).
- [ ] **DoD-2.4** — Feedback submissions ("Report incorrect availability") are captured and visible in an admin log (verify that submissions appear in the backend log or admin interface).

---

*End of Checklist*

**Prepared by:** Code Reviewer & Product Manager — Nothing2See
**Date:** 2026-03-20
**Documents reviewed:** `PRD.md` v1.0, `ARCHITECTURE.md` v1.0
