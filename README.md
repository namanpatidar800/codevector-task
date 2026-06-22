# CodeVector Product Browser

A backend that lets you browse ~200,000 products (newest first), filter by category, and paginate — without ever skipping or duplicating a product even as data changes.

## Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL (Neon recommended — free, no credit card)
- **Pagination:** Cursor-based (explained below)

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env
cp .env.example .env
# → paste your Neon (or local Postgres) DATABASE_URL

# 3. Start the server (creates tables + indexes on first boot)
npm run dev

# 4. Seed 200,000 products
npm run seed
```

Server: http://localhost:3000  
UI: http://localhost:3000 (served from /public)

---

## API

### `GET /api/products`

| Param      | Type   | Default | Notes                              |
|------------|--------|---------|------------------------------------|
| `cursor`   | string | —       | Omit for page 1                    |
| `category` | string | —       | Filter by category name            |
| `limit`    | number | 20      | Items per page: 10 \| 20 \| 50    |

**Response**
```json
{
  "data": [ { "id": 1, "name": "...", "category": "...", "price": "9.99", "created_at": "...", "updated_at": "..." } ],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "<opaque base64url token>"
  }
}
```

Pass `nextCursor` as the `cursor` param on the next request. When `hasMore` is `false`, you're on the last page.

### `GET /api/products/categories`

Returns all distinct category names.

### `GET /health`

Health check — returns `{ "status": "ok" }`.

---

## Why cursor pagination?

### The problem with `OFFSET`

```sql
SELECT * FROM products ORDER BY created_at DESC LIMIT 20 OFFSET 200;
```

If 10 new products are inserted while someone is on page 3, every subsequent page shifts by 10 rows. Page 4 now shows rows that were on page 3 before — **duplicates**. Or products fall into the gap between pages — **missed items**.

### The cursor approach

We remember the **exact position** of the last item seen using a `(created_at, id)` pair:

```sql
SELECT * FROM products
WHERE (created_at, id) < ($cursor_ts, $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 21;  -- fetch one extra to know if there's a next page
```

New inserts land at the **top** of the timeline. They don't shift anything the user has already passed. The cursor is a fixed anchor, not a row count.

`id` is included alongside `created_at` because timestamps are not unique — two products can share the same second. The `(created_at, id)` pair is always unique and strictly ordered.

### The index

```sql
CREATE INDEX idx_products_category_created_id
  ON products (category, created_at DESC, id DESC);
```

PostgreSQL can satisfy the entire query (filter + order + cursor) from this index alone — no table heap access needed (index-only scan). This keeps page loads fast even at 200k rows.

---

## Deployment (Render + Neon)

1. **Database:** Create a free project on [neon.tech](https://neon.tech). Copy the connection string.
2. **Backend:** Push this repo to GitHub, then create a new **Web Service** on [render.com](https://render.com):
   - Build command: `npm install`
   - Start command: `npm start`
   - Add env var: `DATABASE_URL` = your Neon connection string
3. After deploy, run the seed script once from your local machine pointing at Neon:
   ```bash
   DATABASE_URL=<neon-url> npm run seed
   ```

---

## What I'd improve with more time

- **Prev page support via cursor stack** — the API is stateless; the UI implements a client-side cursor stack for back-navigation. A richer approach would encode the full history in a session token.
- **Search** — full-text search on `name` using a `tsvector` column + GIN index.
- **Real-time updates** — WebSocket / SSE to notify the UI when new products arrive, with a "10 new products — click to refresh" banner (like Twitter).
- **Rate limiting** — add express-rate-limit to protect the API.
- **Tests** — integration tests covering the cursor edge cases (empty page, single-row page, category boundary).

---

## How I used AI

Used Claude to scaffold the boilerplate (Express setup, package.json, HTML UI) and to sanity-check the SQL tuple comparison syntax for the cursor `WHERE` clause. The core pagination design — choosing cursor over offset, the two-field cursor, the composite index, the +1 fetch trick — was reasoned through manually. AI got the `VALUES` batching in the seed script right on the first try.
