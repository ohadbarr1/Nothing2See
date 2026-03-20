# Nothing2See

A streaming availability discovery platform. Search for any movie or TV show and find out where it's streaming in your region. Discover top-rated titles across your favourite streaming services.

## Features

- **Title Search** — search TMDB, get IMDb ratings, and see streaming availability per region
- **Top-30 Discover** — pick streaming services + region and get the top 30 titles ranked by IMDb score
- **10 Regions** — US, GB, CA, AU, DE, FR, IL, JP, BR, IN
- **8 Services** — Netflix, Prime Video, Disney+, Max, Apple TV+, Hulu, Paramount+, Peacock
- Region + service preferences persisted in `localStorage` via Zustand

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, React Router v6 |
| Backend | Fastify, Node.js, TypeScript, Zod |
| Database | Drizzle ORM + PostgreSQL (Supabase) |
| Cache | Upstash Redis (falls back to in-memory if not configured) |
| External APIs | TMDB, OMDb, Streaming Availability (RapidAPI) |

## Project Structure

```
nothing2see/
├── apps/
│   ├── web/          React + Vite frontend
│   └── api/          Fastify API server
├── packages/
│   ├── types/        Shared Zod schemas + TypeScript types
│   └── core/         Shared API client + TanStack Query hooks
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+

Install pnpm if you don't have it:

```bash
npm install -g pnpm@9
```

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd nothing2see
pnpm install
```

### 2. Configure environment variables

**API** (`apps/api/.env`):

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

| Variable | Description | Required |
|---|---|---|
| `PORT` | API server port (default: `3001`) | No |
| `DATABASE_URL` | PostgreSQL connection string (Supabase) | No (mock data used if absent) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | No (in-memory fallback) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | No (in-memory fallback) |
| `TMDB_API_KEY` | TMDB API key — get it at [themoviedb.org](https://www.themoviedb.org/settings/api) | **Yes** |
| `OMDB_API_KEY` | OMDb API key — get it at [omdbapi.com](https://www.omdbapi.com/apikey.aspx) | **Yes** |
| `RAPIDAPI_KEY` | RapidAPI key for Streaming Availability API | **Yes** |

**Web** (`apps/web/.env`):

```bash
cp apps/web/.env.example apps/web/.env
```

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | API base URL (default: `http://localhost:3001`) |

### 3. Obtain API keys

- **TMDB**: Register at [themoviedb.org](https://www.themoviedb.org/signup) → Settings → API
- **OMDb**: Register at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) (free tier available)
- **Streaming Availability (RapidAPI)**: Subscribe at [rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability](https://rapidapi.com/movie-of-the-night-movie-of-the-night-default/api/streaming-availability)

### 4. (Optional) Set up database

If you want persistent caching via PostgreSQL (Supabase):

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy the connection string to `DATABASE_URL`
3. Run the seed script:

```bash
pnpm --filter @nothing2see/api db:seed
```

### 5. (Optional) Set up Upstash Redis

1. Create a database at [upstash.com](https://upstash.com)
2. Copy the REST URL and token to your `.env`

If not configured, the API automatically falls back to an in-memory cache.

## Running Locally

### Development (both apps in parallel)

```bash
pnpm dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3001](http://localhost:3001)

### Run individually

```bash
# API only
pnpm --filter @nothing2see/api dev

# Web only
pnpm --filter @nothing2see/web dev
```

## Building for Production

```bash
pnpm build
```

Build outputs:
- API: `apps/api/dist/`
- Web: `apps/web/dist/`

Start the API in production:

```bash
pnpm --filter @nothing2see/api start
```

## API Reference

Base URL: `http://localhost:3001`

### Health

```
GET /api/v1/health
```

### Search Titles

```
GET /api/v1/titles/search?q=inception&region=US&type=movie&page=1&limit=20
```

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string | — | Search query (required) |
| `region` | string | `US` | 2-letter country code |
| `type` | `movie\|series` | — | Filter by type |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 50) |

### Get Title by TMDB ID

```
GET /api/v1/titles/550?region=US
```

### Discover Top 30

```
GET /api/v1/discover/top?region=US&services=netflix,hulu&type=movie&genre=Action&min_rating=7
```

| Param | Type | Default | Description |
|---|---|---|---|
| `region` | string | `US` | 2-letter country code |
| `services` | string | — | Comma-separated service IDs |
| `type` | `movie\|series` | — | Filter by type |
| `genre` | string | — | Filter by genre name |
| `min_rating` | number | — | Minimum IMDb rating (0–10) |

### Get Services

```
GET /api/v1/services
```

### Response Envelope

All responses follow this structure:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 100, "total_pages": 5 }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": { ... }
  }
}
```

## Other Commands

```bash
# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Clean all build outputs
pnpm clean
```
