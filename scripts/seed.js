/**
 * Seed script — generates 200,000 products in bulk.
 *
 * Run with:  node scripts/seed.js
 *
 * Strategy: we build large multi-row INSERT statements (1,000 rows per
 * batch) instead of looping one INSERT at a time.  A single-row loop
 * would take minutes; batched INSERTs finish in a few seconds because:
 *   1. Fewer round-trips to the database.
 *   2. PostgreSQL can plan and execute one statement instead of 200,000.
 *   3. WAL writes are amortised across many rows.
 *
 * We also randomise created_at across the past year so the data looks
 * realistic for "newest first" browsing.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

const TOTAL     = 200_000;
const BATCH     = 1_000;   // rows per INSERT statement

const CATEGORIES = [
  'Electronics', 'Clothing', 'Books', 'Home & Garden',
  'Sports', 'Toys', 'Beauty', 'Automotive', 'Food', 'Music',
];

const ADJECTIVES = [
  'Premium', 'Classic', 'Deluxe', 'Essential', 'Ultra',
  'Smart', 'Portable', 'Compact', 'Advanced', 'Vintage',
];

const NOUNS = [
  'Widget', 'Gadget', 'Gizmo', 'Device', 'Accessory',
  'Tool', 'Kit', 'Set', 'Pack', 'Bundle',
];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randPrice() {
  return (Math.random() * 999 + 1).toFixed(2);
}

/** Random timestamp within the past 365 days */
function randDate() {
  const msAgo = Math.random() * 365 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - msAgo).toISOString();
}

async function seed() {
  console.log(`Seeding ${TOTAL.toLocaleString()} products in batches of ${BATCH}…`);
  const start = Date.now();

  for (let offset = 0; offset < TOTAL; offset += BATCH) {
    const batchSize = Math.min(BATCH, TOTAL - offset);

    // Build a single VALUES list for the entire batch.
    // Using unnest() with arrays is an alternative, but explicit VALUES
    // is easier to read and just as fast at this scale.
    const values  = [];
    const params  = [];
    let   pIndex  = 1;

    for (let i = 0; i < batchSize; i++) {
      const name     = `${rand(ADJECTIVES)} ${rand(NOUNS)} ${offset + i + 1}`;
      const category = rand(CATEGORIES);
      const price    = randPrice();
      const date     = randDate();

      values.push(`($${pIndex}, $${pIndex+1}, $${pIndex+2}, $${pIndex+3}, $${pIndex+3})`);
      params.push(name, category, price, date);
      pIndex += 4;
    }

    await pool.query(
      `INSERT INTO products (name, category, price, created_at, updated_at)
       VALUES ${values.join(',')}`,
      params
    );

    const pct = (((offset + batchSize) / TOTAL) * 100).toFixed(1);
    process.stdout.write(`\r  ${pct}% (${(offset + batchSize).toLocaleString()} rows)`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone! ${TOTAL.toLocaleString()} products inserted in ${elapsed}s.`);
  await pool.end();
}

seed().catch(err => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
