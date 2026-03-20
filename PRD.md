# Nothing2See — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2026-03-20
**Status:** Draft

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Use Cases](#4-use-cases)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Out of Scope for MVP](#6-out-of-scope-for-mvp)
7. [Phased Delivery](#7-phased-delivery)

---

## 1. Product Vision

**Nothing2See** eliminates the modern streaming dilemma: too many services, too little clarity. We give users a single, intelligent destination to find what is worth watching — on the services they already pay for, in the region they live in.

Our north star: **zero frustration from the moment someone decides they want to watch something to the moment they press play.**

---

## 2. Problem Statement

Streaming has fragmented entertainment across a growing number of services, each with a different library that varies by country. The average subscriber pays for 3–4 services simultaneously yet frequently reports not knowing what to watch. Discovery is broken because:

- There is no single source of truth for "is this available where I live?"
- IMDb, Rotten Tomatoes, and streaming apps each surface different content and none integrate cross-service availability with quality signals in a useful way.
- Recommendation surfaces inside streaming apps are biased toward the platform's own content and engagement metrics, not user preference or quality.
- Regional licensing means that content available to a friend in one country may not exist for a user in another — and there is no easy way to check.

Nothing2See solves this by combining authoritative streaming availability data, region awareness, and IMDb quality signals into one clean, fast interface.

---

## 3. Target Users

### Primary User: The Overwhelmed Subscriber

- Age 22–45, streaming-native
- Pays for 2–5 streaming services simultaneously
- Watches 3–7 hours of streaming content per week
- Frequently spends 15+ minutes choosing what to watch before giving up or picking something mediocre
- Not necessarily a film buff — values convenience and quality over comprehensiveness

### Secondary User: The Recommendation Seeker

- Has a specific title in mind (heard about it from a friend, saw a trailer) and needs to know where to find it
- Values accuracy and speed above all — they are not browsing, they are searching
- May be traveling or an expat dealing with region mismatches

### Tertiary User: The Service Optimizer

- Actively evaluates which streaming services are worth keeping
- Wants to understand what quality content is available per service before subscribing or canceling
- Price-conscious, research-oriented

---

## 4. Use Cases

### Use Case 1 — Search by Title (Existing)

**Description:** A user searches for a specific movie or TV show by name and receives a list of streaming services where it is available, with full region awareness.

**User Story:**
> As a user, I want to search for a specific title and see exactly which streaming services carry it in my country, so I can start watching immediately without guessing.

**Acceptance Criteria:**

- The search input accepts free-text movie and TV show titles.
- Results display within 2 seconds for titles in the top 10,000 by IMDb popularity.
- Each result card shows: title, year, type (movie/series), IMDb rating, poster image, and a list of streaming services where it is available.
- Availability is scoped to the user's detected or manually selected region.
- If the title is not available on any service in the user's region, a clear "Not available in [region]" message is displayed.
- If the title is available in other regions but not the user's, a secondary note indicates this (e.g., "Available on Netflix UK").
- Partial and fuzzy search matches are surfaced (e.g., "Harry Potter" returns all films in the series).
- TV show results distinguish between season-level availability where data permits.

---

### Use Case 2 — Recommended Content by Service (Existing)

**Description:** A user selects one or more streaming services they subscribe to and receives a curated list of top 30 movies and shows available on those services in their region, ranked by IMDb score.

**User Story:**
> As a user, I want to tell the app which services I have and immediately get a ranked list of the best content available to me right now, so I can make a confident choice without browsing endlessly.

**Acceptance Criteria:**

- Users can select one or more services from a list of supported providers.
- The selected services and region are persisted for the session (and across sessions if the user has an account).
- Results are filtered to content available in the user's region on at least one of the selected services.
- Results are ranked by IMDb rating descending, with a minimum of 1,000 IMDb votes required to filter noise.
- A maximum of 30 results are shown per query (paginated if content warrants).
- Each result card shows: title, year, type, IMDb rating, genre tags, and which of the user's selected services carries it.
- Users can filter results by type (Movies / TV Shows / Both) and genre.
- Results reflect real-time or near-real-time availability (refreshed at least daily).

---

### Use Case 3 — "What's New This Week" Feed (New)

**Description:** A user sees a curated feed of titles that newly arrived on their selected streaming services in the past 7 days, ranked by IMDb score. This creates a habitual return visit and solves the "I want something fresh" intent.

**User Story:**
> As a user, I want to see what's new this week on my streaming services, so I don't have to check each app individually or miss something good that just dropped.

**Acceptance Criteria:**

- The feed is accessible from the home screen without any additional input once services are configured.
- Titles are filtered to the user's selected services and region.
- "New" is defined as: first made available on any of the user's selected services within the past 7 days (not the content's original release date).
- Results are ranked by IMDb rating descending (minimum 500 votes), with newly released theatrical films that may have lower vote counts surfaced with a "New Release" badge.
- The feed is refreshed at least once every 24 hours.
- Users can filter the feed by type (Movies / TV Shows) and genre.
- Each card indicates which service the title is available on and the date it became available.
- If no new content has been added in the past 7 days for the user's selected services, a clear empty state message is shown with a suggestion to expand services or check back later.

---

### Use Case 4 — Watchlist (New)

**Description:** A user saves titles they want to watch later into a personal watchlist. The watchlist persists across sessions and surfaces availability changes — for example, alerting the user if a saved title is about to leave a service or has become available on a new one.

**User Story:**
> As a user, I want to save titles I'm interested in and come back to them later, so I don't lose track of things I want to watch and can act quickly when availability changes.

**Acceptance Criteria:**

- Any authenticated user can add a title to their watchlist from any result card with a single tap/click.
- The watchlist is accessible from a dedicated screen and persists across sessions.
- Each watchlist entry shows: poster, title, IMDb rating, current availability on the user's services, and the date it was added.
- If a title on the watchlist is no longer available on any of the user's services, it is flagged visually (e.g., "No longer available").
- If a title on the watchlist becomes available on one of the user's services, the user receives an in-app notification and (optionally) an email notification.
- Users can remove titles from the watchlist individually or clear all.
- Watchlist is limited to 100 titles per user in MVP (a hard cap with a clear message when reached).
- Watchlist requires user authentication (see Out of Scope for guest/anonymous watchlist).

---

### Use Case 5 — Service Value Score (New)

**Description:** A user can view a ranked breakdown of their selected streaming services by the volume and quality of content available to them in their region. This helps users evaluate which services are delivering value and supports decisions about subscribing or canceling.

**User Story:**
> As a user, I want to see which of my streaming services has the most high-quality content available to me right now, so I can decide whether each service is worth keeping.

**Acceptance Criteria:**

- Accessible from a dedicated "My Services" or "Service Scorecard" screen.
- For each of the user's selected services, the app displays:
  - Total number of titles available in the user's region.
  - Number of titles with an IMDb rating of 7.0 or above.
  - Average IMDb rating across all available titles.
  - A composite "Value Score" (calculated as: weighted average of title count and quality ratio, normalized to 100).
- Services are ranked by Value Score descending.
- The user can drill into any service to see its top 20 titles by IMDb rating.
- Data reflects the most recent availability snapshot (refreshed at least daily).
- The screen displays a "Last updated" timestamp so users know data freshness.
- No subscription pricing data is shown in MVP (the feature is about content quality, not cost).

---

## 5. Non-Functional Requirements

### 5.1 Performance

- Title search must return results in under 2 seconds for the top 50,000 titles by IMDb popularity under normal load.
- The "What's New" feed and recommendations must load in under 3 seconds.
- The system must support at least 1,000 concurrent users in MVP without degradation.
- Availability data must be refreshed at least once every 24 hours per region/service combination.

### 5.2 Region Support

- MVP must support a minimum of 10 regions at launch. Suggested initial set: United States, United Kingdom, Canada, Australia, Germany, France, Israel, Japan, Brazil, India.
- Region is auto-detected via IP geolocation on first load.
- Users can manually override their detected region from the settings screen.
- Region selection is persisted per user account (authenticated) or browser localStorage (unauthenticated).
- Availability data is always scoped to the selected region — no cross-region data is mixed into results unless explicitly indicated.

### 5.3 Data & Integrations

- Streaming availability data must be sourced from a reliable third-party API (e.g., Watchmode, Streaming Availability by Movie of the Night, or equivalent). Direct scraping of streaming platforms is not permitted.
- IMDb rating data must be sourced from a licensed or publicly available dataset (e.g., IMDb Non-Commercial Datasets, or OMDb API). Ratings must be refreshed at least weekly.
- Poster images are fetched from TMDb (The Movie Database) API.
- All external API keys and credentials must be stored as environment secrets — never in source code.

### 5.4 Architecture & Platform

- The MVP is a web application built with a component framework that supports a future React Native mobile port (React + shared logic layer recommended).
- Business logic (search, filtering, scoring) must live in a platform-agnostic service layer, not in UI components, to facilitate mobile reuse.
- The API layer must be stateless and RESTful (or GraphQL), versioned from day one (e.g., `/api/v1/`).
- The frontend and backend must be independently deployable.

### 5.5 Reliability & Data Accuracy

- Streaming availability data carries an inherent lag; the UI must display a "last updated" timestamp on all availability information.
- If a third-party API is unavailable, the app must gracefully degrade (show cached data with a staleness warning) rather than failing entirely.
- A feedback mechanism ("Report incorrect availability") must be present on title cards to capture user-reported inaccuracies — submitted reports are logged for manual review.

### 5.6 Security & Privacy

- User authentication (for watchlist) uses OAuth 2.0 via a trusted provider (Google, Apple) — no password storage in MVP.
- No personally identifiable information beyond email and OAuth token is stored.
- Region preference and service selections are the only behavioral data stored per user.
- The app must comply with GDPR (for EU users) and include a minimal privacy policy at launch.

### 5.7 Accessibility

- The web app must meet WCAG 2.1 AA compliance for all core user flows.
- All interactive elements must be keyboard-navigable.
- All images must include descriptive alt text.

---

## 6. Out of Scope for MVP

The following are explicitly deferred to post-MVP releases:

- **Mobile apps** (iOS / Android) — MVP is web only; architecture must support them, but they are not built in MVP.
- **Personalized recommendations** based on watch history or stated preferences (e.g., "recommend me thrillers I haven't seen").
- **User reviews or ratings** — Nothing2See surfaces IMDb ratings only; users cannot submit their own.
- **Social features** — sharing watchlists, seeing what friends are watching, collaborative watchlists.
- **Push notifications** — watchlist availability changes are in-app and email only in MVP; push requires a mobile app.
- **Guest/anonymous watchlist** — watchlist requires authentication in MVP.
- **Pricing and subscription management** — the app tells users what is available, not how much a service costs.
- **Trailer playback** — deep links to the streaming service are out of scope; the app does not embed video.
- **Torrent or piracy-adjacent features** — any availability data for non-licensed sources.
- **Content beyond movies and TV shows** — no sports, live events, podcasts, or documentaries as a separate category (documentaries appear within the standard movie/show results).
- **Multiple user profiles per account** — single profile per account in MVP.
- **Localization / internationalization** — the app launches in English only in MVP.

---

## 7. Phased Delivery

### Phase 1 — Core Search & Availability (Weeks 1–6)

**Goal:** Ship a working, publicly accessible web app that answers the most immediate user question: "Where can I watch this?"

**Scope:**
- Project scaffolding: repo, CI/CD pipeline, staging and production environments.
- Third-party API integrations: streaming availability provider, IMDb/OMDb, TMDb for posters.
- Region detection (IP-based) and manual region override.
- Use Case 1: Title search with streaming availability and region-aware results.
- Basic service selection UI (multi-select, persisted in localStorage).
- Use Case 2: Top 30 recommendations by IMDb score for selected services and region.
- Responsive web UI (mobile-friendly layout, not a native app).
- Public launch with no authentication required for search and recommendations.

**Definition of Done:**
- A user can search any title and see accurate streaming availability for their detected region.
- A user can select services and receive a ranked recommendation list.
- All data is sourced from live third-party APIs (no hardcoded mock data in production).
- Page load and search response times meet the NFR thresholds defined in Section 5.1.

---

### Phase 2 — Discovery & Engagement (Weeks 7–10)

**Goal:** Give users a reason to return daily and introduce account-level personalization.

**Scope:**
- User authentication via Google and Apple OAuth.
- Use Case 4: Watchlist (add, view, remove titles; availability change flagging; email notification on availability change).
- Use Case 3: "What's New This Week" feed on the home screen for authenticated users with saved service preferences.
- Filters on recommendations and new arrivals (type: Movie/TV, genre).
- "Report incorrect availability" feedback button on title cards.
- GDPR consent banner and privacy policy page.
- Session persistence: service selections and region saved to user account on login.

**Definition of Done:**
- An authenticated user can maintain a persistent watchlist across sessions.
- The "What's New" feed accurately reflects titles added to the user's services in the past 7 days.
- Users receive email notifications when a watchlisted title becomes available on one of their services.
- Feedback submissions are captured and visible in an admin log.

---

### Phase 3 — Value Intelligence & Polish (Weeks 11–14)

**Goal:** Add decision-support tooling for power users, harden the product for scale, and prepare the architecture for mobile.

**Scope:**
- Use Case 5: Service Value Score screen with per-service breakdown and drill-down top 20.
- API versioning enforced (`/api/v1/`) and documented (OpenAPI spec generated).
- Platform-agnostic business logic layer extracted and unit-tested (groundwork for React Native).
- Performance hardening: caching layer for availability data, CDN for static assets.
- Staleness warnings and graceful degradation when third-party APIs are unavailable.
- Accessibility audit and WCAG 2.1 AA remediation.
- Analytics instrumentation (privacy-respecting, e.g., Plausible or PostHog self-hosted) on all 5 use case flows.

**Definition of Done:**
- The Service Value Score screen is accurate, loads within NFR thresholds, and is tested against at least 5 regions.
- The API is versioned, documented, and the business logic layer has >80% unit test coverage.
- A mobile engineer can onboard to the codebase and identify exactly where to plug in a React Native frontend.
- Lighthouse accessibility score is 90+ on all core screens.
- All five use cases are instrumented with event tracking.

---

*End of Document*
