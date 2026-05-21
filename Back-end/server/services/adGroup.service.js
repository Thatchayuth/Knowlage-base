'use strict';
/**
 * adGroup.service.js
 * ──────────────────
 * Retrieves and caches the AD groups for a given username.
 * Wraps the existing ldapService.js (getUserGroups) with a TTL cache layer.
 *
 * Called by : windowsAuth.middleware.js, permission.service.js
 * Depends on: services/ldapService.js, services/cache.service.js
 *
 * Flow:
 *   windowsAuth.middleware or API call
 *   → adGroup.service.getGroups(username)
 *   → check cache ('adgroups:<username>')
 *   → cache HIT → return groups[]
 *   → cache MISS → ldapService.getUserGroups(username)
 *               → normalize group CN names to lowercase
 *               → cache.set('adgroups:<username>', groups, 5min)
 *               → return groups[]
 *
 * Exported:
 *   getGroups(username)      → string[]  (lowercase CN group names)
 *   clearGroupCache(username)
 */

const { getUserGroups } = require('./ldapService');
const cache = require('./cache.service');
const logger = require('./logger');

const TTL_MS   = 5 * 60 * 1000;  // 5 minutes per user
const KEY_PFX  = 'adgroups:';

/**
 * Get AD groups for a user, using a 5-minute in-memory cache.
 *
 * @param {string} username  - sAMAccountName (no domain prefix)
 * @returns {Promise<string[]>} lowercase group CN names
 *
 * Example return: ['hr-staff', 'it-admin', 'domain users']
 */
async function getGroups(username) {
  if (!username) return [];

  const cacheKey = KEY_PFX + username.toLowerCase();
  const cached   = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const raw    = await getUserGroups(username);
    const groups = raw.map(g => g.toLowerCase());
    cache.set(cacheKey, groups, TTL_MS);
    logger.logEvent('LOGIN_SUCCESS', {
      username,
      message: `AD groups fetched: [${groups.join(', ')}]`,
    });
    return groups;
  } catch (err) {
    logger.logEvent('ERROR_SYSTEM', {
      level: 'warn',
      username,
      message: `Failed to fetch AD groups: ${err.message}`,
    });
    return [];  // fail-open: return empty so permission check → deny
  }
}

/**
 * Invalidate a user's AD group cache (e.g., after admin changes group membership).
 * @param {string} username
 */
function clearGroupCache(username) {
  cache.del(KEY_PFX + username.toLowerCase());
}

module.exports = { getGroups, clearGroupCache };
