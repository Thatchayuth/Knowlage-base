'use strict';
/**
 * cache.service.js
 * ────────────────
 * Lightweight in-memory TTL cache.
 * Avoids redundant LDAP queries and folder-tree DB queries.
 *
 * Cache namespaces (key prefixes):
 *   'adgroups:<username>'   → user's AD groups array         TTL: 5 min
 *   'foldertree'            → full folder tree snapshot       TTL: 2 min
 *   'permmap'               → Map<folderId, adGroups[]>       TTL: 2 min
 *   'files:<folderId>'      → files array for a folder        TTL: 2 min
 *
 * Called by : adGroup.service.js, folder.service.js, permission.service.js
 * Depends on: nothing (pure in-memory)
 *
 * NOTE: For multi-instance / PM2 cluster deployments replace with a
 *       Redis-backed adapter using the same interface.
 *
 * Exported functions:
 *   get(key)
 *   set(key, value, ttlMs)
 *   del(key)
 *   clearPrefix(prefix)
 *   flush()
 *   stats()
 */

/** @type {Map<string, {value:*, expiresAt:number}>} */
const _store = new Map();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieve a cached value.
 * Returns undefined if the key is missing or has expired (and evicts it).
 *
 * @param {string} key
 * @returns {*|undefined}
 */
function get(key) {
  const entry = _store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Store a value with a TTL.
 *
 * @param {string} key
 * @param {*}      value
 * @param {number} [ttlMs=300000]  time-to-live in ms (default 5 min)
 */
function set(key, value, ttlMs = DEFAULT_TTL_MS) {
  _store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Delete a specific cache entry.
 * @param {string} key
 */
function del(key) {
  _store.delete(key);
}

/**
 * Invalidate all keys that start with a given prefix.
 * Useful for: clearPrefix('files:') after a sync to reset all file caches.
 *
 * @param {string} prefix
 */
function clearPrefix(prefix) {
  for (const key of _store.keys()) {
    if (key.startsWith(prefix)) _store.delete(key);
  }
}

/**
 * Flush the entire cache (called after folder sync to force fresh data).
 */
function flush() {
  _store.clear();
}

/**
 * Return diagnostic stats for health-check / monitoring endpoints.
 * @returns {{ size: number, keys: string[] }}
 */
function stats() {
  // Evict expired before reporting
  const now = Date.now();
  for (const [key, entry] of _store.entries()) {
    if (now > entry.expiresAt) _store.delete(key);
  }
  return { size: _store.size, keys: [..._store.keys()] };
}

module.exports = { get, set, del, clearPrefix, flush, stats };
