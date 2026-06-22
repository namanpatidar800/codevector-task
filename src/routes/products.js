const express = require('express');
const pool = require('../db');
const { encodeCursor, decodeCursor } = require('../cursor');

const router = express.Router();

const VALID_LIMITS = [10, 20, 50];
const DEFAULT_LIMIT = 20;

/**
 * GET /api/products
 *
 * Query params:
 *   cursor   - opaque pagination token (omit for first page)
 *   category - filter by category name (optional)
 *   limit    - items per page: 10 | 20 | 50 (default 20)
 *
 * How cursor pagination keeps data stable:
 *   Instead of OFFSET (which shifts when rows are inserted), we remember
 *   exactly WHERE we were by storing the (created_at, id) of the last row
 *   seen. The next query asks for rows STRICTLY BEFORE that point.
 *   New inserts at the top of the list never affect pages the user has
 *   already passed, and rows are never duplicated or skipped.
 */

router.get('/categories', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT DISTINCT category FROM products ORDER BY category ASC'
    );
    res.json({ categories: rows.map(r => r.category) });
  } catch (err) {
    console.error('GET /products/categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const limit = VALID_LIMITS.includes(Number(req.query.limit))
      ? Number(req.query.limit)
      : DEFAULT_LIMIT;

    const category = req.query.category?.trim() || null;
    const rawCursor = req.query.cursor?.trim() || null;
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;

    // Build query dynamically based on which filters are active.
    // We always fetch limit+1 rows so we can tell the client whether
    // a next page exists without a separate COUNT query.
    const params = [];
    const conditions = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (cursor) {
      // Row tuple comparison: (created_at, id) < (cursor.createdAt, cursor.id)
      // PostgreSQL evaluates this correctly as a lexicographic comparison,
      // which matches our DESC sort order perfectly.
      params.push(cursor.createdAt, cursor.id);
      conditions.push(
        `(created_at, id) < ($${params.length - 1}, $${params.length})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit + 1); // fetch one extra to detect next page
    const limitPlaceholder = `$${params.length}`;

    const sql = `
      SELECT id, name, category, price, created_at, updated_at
      FROM   products
      ${where}
      ORDER  BY created_at DESC, id DESC
      LIMIT  ${limitPlaceholder}
    `;

    const { rows } = await pool.query(sql, params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem
      ? encodeCursor(lastItem.created_at, lastItem.id)
      : null;

    res.json({
      data: items,
      pagination: {
        limit,
        hasMore,
        nextCursor,  // pass this as `cursor` on the next request; null = last page
      },
    });
  } catch (err) {
    console.error('GET /products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/products/categories
 * Returns all distinct category names — useful for populating a filter dropdown.
 */

module.exports = router;