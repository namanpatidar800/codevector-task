# ProductFlow API

A backend that lets you browse ~200,000 products (newest first), filter by category, and paginate — without ever skipping or duplicating a product even as data changes.

## Stack

- **Runtime:** Node.js + Express
- **Database:** PostgreSQL (Neon — free, no credit card required)
- **Pagination:** Cursor-based (explained below)

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env
cp .env.example .env
# → paste your Neon DATABASE_URL inside .env

# 3. Start the server (creates tables + indexes automatically on first boot)
npm run dev

# 4. Seed 200,000 products
npm run seed
```

Server: http://localhost:3000
UI: http://localhost:3000 (served from /public)

---

## API

### `GET /api/products`

| Param      | Type   | Default | Notes                           |
|------------|--------|---------|---------------------------------|
| `cursor`   | string | —       | Omit for page 1                 |
| `category` | string | —       | Filter by category name         |
| `limit`    | number | 20      | Items per page: 10 \| 20 \| 50 |

**Response**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Premium Widget 1",
      "category": "Electronics",
      "price": "9.99",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
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

### The problem with OFFSET

```sql
SELECT * FROM products ORDER BY created_at DESC LIMIT 20 OFFSET 200;
```

If 10 new products are inserted while someone is on page 3, every subsequent page shifts by 10 rows. Page 4 now shows rows that were already on page 3 — **duplicates**. Or products fall into the gap between pages — **missed items**.

### The cursor approach

We remember the **exact position** of the last item seen using a `(created_at, id)` pair:

```sql
SELECT * FROM products
WHERE (created_at, id) < ($cursor_ts, $cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 21;  -- fetch one extra to detect if a next page exists
```

New inserts land at the **top** of the timeline. They don't shift anything the user has already passed. The cursor is a fixed anchor, not a row count.

`id` is included alongside `created_at` because timestamps are not unique — two products can share the same timestamp. The `(created_at, id)` pair is always unique and strictly ordered.

### The index

```sql
CREATE INDEX idx_products_category_created_id
  ON products (category, created_at DESC, id DESC);
```

PostgreSQL can satisfy the entire query (filter + order + cursor) from this index alone — no table heap scan needed. This keeps every page load fast even at 200k rows.

---

## Deployment (Render + Neon)

1. **Database:** Create a free project on [neon.tech](https://neon.tech). Copy the connection string.
2. **Backend:** Push this repo to GitHub, then create a new **Web Service** on [render.com](https://render.com):
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variable: `DATABASE_URL` = your Neon connection string
3. The seed was already run locally against Neon, so the 200k products are already in the database.

---

## What I'd improve with more time

- **Search** — full-text search on product names using a `tsvector` column + GIN index.
- **Real-time updates** — WebSocket / SSE to show a "X new products available" banner when inserts happen, without forcing a full reload.
- **Rate limiting** — add `express-rate-limit` to protect the API from abuse.
- **Tests** — integration tests covering cursor edge cases: empty result, single-row page, category boundary, concurrent inserts during pagination.
- **Prev page via server-side cursor history** — currently the UI holds a client-side cursor stack for back-navigation. A cleaner approach would be a session token encoding the full history.

---

## How I used AI

Used Claude (claude.ai) to design and scaffold the entire project — the cursor pagination approach, Express setup, DB schema, seed script, and UI. Claude explained why cursor-based pagination is better than OFFSET for stable pagination under live data changes, and I followed along to understand each decision before moving to the next step.

Key things I learned through this process:
- Why `(created_at, id)` together makes a stable, unique cursor
- How a composite index makes pagination fast at scale without COUNT queries
- Why fetching `limit + 1` rows is the right way to detect the next page
- How batched INSERT statements make seeding 200k rows take seconds instead of minutes

I made sure to understand every part of the code so I can explain and modify it in the live interview.
