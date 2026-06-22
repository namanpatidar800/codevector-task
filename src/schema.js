const pool = require('./db');

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          BIGSERIAL PRIMARY KEY,
      name        TEXT        NOT NULL,
      category    TEXT        NOT NULL,
      price       NUMERIC(10,2) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Composite index that makes cursor pagination fast.
    -- Covers both the ORDER BY and the WHERE (cursor) clause in one scan.
    CREATE INDEX IF NOT EXISTS idx_products_created_id
      ON products (created_at DESC, id DESC);

    -- Separate index for category filter + cursor.
    -- PostgreSQL will use this when a category filter is present.
    CREATE INDEX IF NOT EXISTS idx_products_category_created_id
      ON products (category, created_at DESC, id DESC);
  `);

  console.log('Schema ready.');
}

module.exports = { initSchema };
