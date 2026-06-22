/**
 * Cursor encodes the position of the LAST item the client already saw.
 * We use (created_at, id) as a stable, unique pair for the sort key.
 *
 * Why two fields?
 *   created_at alone is not unique — many products can share the same
 *   timestamp. Adding id (which IS unique) makes the pair a strict
 *   total order, so no row is ever skipped or repeated.
 *
 * Why base64?
 *   Keeps the URL clean and hides implementation details from callers.
 */

function encodeCursor(createdAt, id) {
  const payload = JSON.stringify({ createdAt, id });
  return Buffer.from(payload).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    const payload = Buffer.from(cursor, 'base64url').toString('utf8');
    const { createdAt, id } = JSON.parse(payload);
    if (!createdAt || !id) throw new Error('Invalid cursor fields');
    return { createdAt, id };
  } catch {
    return null; // treat malformed cursor as "start from beginning"
  }
}

module.exports = { encodeCursor, decodeCursor };
