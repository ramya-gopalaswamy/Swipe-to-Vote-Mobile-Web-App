# GalaSwipe

Mobile-first Met Gala–themed swipe voting: swipe or tap Yes/No on runway looks, with votes stored in a real backend and crowd results on a **Results** tab.

---

## Install and run

**Prerequisites:** **Node.js 23+** (`node --version`). The server uses **`node:sqlite`** (SQLite in Node’s standard library), which requires Node 23 or newer.

From the repository root:

```bash
npm install
npm run dev:full
```

| Where        | URL                   |
| ------------ | --------------------- |
| Web app      | http://localhost:5173 |
| API (direct) | http://localhost:4000 |

- **`npm run dev:full`** starts **Vite** (UI) and **Express** (API) together and proxies `/api/*` to the server. Use this for demos and grading so voting and SQLite persistence work.
- **`npm run dev`** alone is frontend-only unless you also run **`npm run server`** and align **`PORT`** with the Vite proxy.
- First boot creates **`./data/galaswipe.db`**, applies the schema, and seeds the catalog (see seed logic in [`server/seedCatalog.js`](server/seedCatalog.js)).
- Optional: copy [`.env.example`](.env.example) → `.env.local` to set `PORT` (default `4000`) or `SQLITE_PATH`.

If the UI shows an **offline preview** banner, the backend is unreachable—votes are not persisted until the API is available.

---

## Architecture (brief)

- **Frontend:** React + Vite + Tailwind + Framer Motion under **`src/`**; API calls go through **`src/lib/galaApi.js`**.
- **Backend:** Express under **`server/`** with SQLite via **`server/db.js`**; votes and catalog live in **`data/galaswipe.db`** (WAL mode).
- **Development:** the browser talks to **`/api/...`** on the Vite origin; Vite proxies those requests to Express so cookies/origin stay simple.
- **Identity:** lightweight **username** sign-in—**`POST /api/sessions`** normalizes a username to a stable **`sessionId`** stored in **`users.id`**. **`localStorage`** only caches that id and display name; **votes live in SQLite**. No passwords or OAuth (demo-appropriate only).
- **Reads/writes:** parameterized SQL on the server; duplicate votes per session+item are rejected via **`UNIQUE(session_id, item_id)`**.

The outfit catalog metadata is stored in SQLite and seeded through server/seedCatalog.js. Each item includes a stable id, title, description, and image reference. For reliable local demos and grading, the application displays locally bundled outfit images served from public/looks/ through the Vite frontend, while the backend stores the catalog metadata and image URL references used by the API.

---

## Requirements completed

### Core

| Area | What ships |
| ---- | ---------- |
| Mobile-first voting | Swipe (Framer Motion) + Yes/No buttons; tilt and green/red feedback; transitions to next card. |
| Backend | **Node + Express** with real persistence (**SQLite**), not `localStorage` as source of truth for votes. |
| Catalog | **`GET /api/items`** — **≥ 100** seeded rows with stable `id`, label, and image URL. |
| Session | **`POST /api/sessions`** `{ username }` → stable **`sessionId`** (normalized slug in **`users`**). |
| Vote | **`POST /api/votes`** `{ itemId, choice, sessionId }` (+ optional `decisionTimeMs`). |
| My votes | **`GET /api/my_votes?sessionId=`** to resume progress. |
| Aggregates | **`GET /api/results`** — yes/no totals per item across **all** users. |
| Results UX | **Results** tab; **Most-loved** and **Most-divisive** sort options; yes/no counts and yes %. |
| Dedup / validation | **`UNIQUE(session_id, item_id)`**; bounded JSON/strings; unknown items and bad `choice` → **400**. |

### Stretch

| Stretch | Status |
| ------- | ------ |
| Undo last swipe (`POST /api/undo_vote`, legacy `POST /api/votes/undo`) | Done |
| **Matches** — your yes + global yes-rate **≥ 70%** (`GET /api/matches?sessionId=`) | Done |
| “Live” aggregates — **5 s polling** while **Results** or **Matches** is open | Done |
| **Basic analytics** — `GET /api/analytics`; strip on **Results** (swipes, distinct sessions, avg decision time) | Done |
| Admin-only guarded seed CLI (no auto-deploy) | **Not implemented** — empty DB auto-seeds only |

---

## Known issues and limitations

- **Node 23+ required** for `node:sqlite`; older Node needs a different SQLite driver and code changes to [`server/db.js`](server/db.js).
- **Grading path:** forgetting Express or a **`PORT`** mismatch leaves the UI without `/api`—you’ll see offline behavior and **no vote persistence**.
- **Offline / API down:** UI falls back to a small bundled sample deck; **no writes** until **`GET /api/items`** succeeds.
- **SQLite** suits local single-machine demos; not positioned for heavy concurrency, HA, or production multi-tenant operations.
- **Username-only identity:** anyone who uses the same normalized username shares history—**not** security. Legacy browsers may still hold an old random UUID in `localStorage` until sign-out; old **`votes`** rows can coexist.
- **CORS** is permissive for local dev—tighten before exposing to untrusted origins.
- **Catalog:** if **`items`** is already populated, auto-seed does not force exactly 100 new rows without clearing/migrating the DB.
- **Pull-to-Results** (or similar) can be inconsistent across browsers; use the **Results** tab for a reliable path.

---

By: Ramya Gopalaswamy

