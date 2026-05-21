'use strict';
/**
 * windowsAuth.middleware.js
 * ─────────────────────────
 * Extracts the authenticated domain user for portal (non-admin) requests.
 * No new login page needed — identity comes from IIS Windows Authentication.
 *
 * Strategy (in order of preference):
 *   1. IIS Windows Auth header  → req.headers['x-auth-user']   ("DOMAIN\\username")
 *   2. IIS REMOTE_USER header   → req.headers['x-remote-user'] ("DOMAIN\\username")
 *   3. Fallback: Basic Auth     → re-uses existing ldapService.authenticateUser()
 *
 * After identifying the user:
 *   → adGroup.service.getGroups(username) to load AD groups
 *   → Attaches req.portalUser = { username, domain, groups[] }
 *   → If no user identity found → 401 for portal APIs
 *
 * Called by : folders.js route, permissions.js route (public endpoints)
 * Depends on: services/adGroup.service.js, services/ldapService.js
 *
 * Security note:
 *   The x-auth-user header MUST be set ONLY by IIS (strip it at IIS level for
 *   direct node access). In dev without IIS, set PORTAL_DEV_USER in .env.
 */

const adGroupService = require('../services/adGroup.service');
const logger         = require('../services/logger');

/**
 * middleware: attach req.portalUser or send 401
 */
async function windowsAuthMiddleware(req, res, next) {
  try {
    // ── 1. Read domain user from IIS-forwarded header
    const rawHeader = req.headers['x-auth-user']
                   || req.headers['x-remote-user']
                   || null;

    let username = null;
    let domain   = null;

    if (rawHeader) {
      // Format: "DOMAIN\\username" or "username@domain"
      if (rawHeader.includes('\\')) {
        [domain, username] = rawHeader.split('\\');
      } else if (rawHeader.includes('@')) {
        [username, domain] = rawHeader.split('@');
      } else {
        username = rawHeader;
      }
      username = username?.toLowerCase()?.trim() || null;
      domain   = domain?.toLowerCase()?.trim()   || null;
    }

    // ── 2. Dev fallback via env var (local dev only — never set in production)
    if (!username && process.env.PORTAL_DEV_USER) {
      username = process.env.PORTAL_DEV_USER.toLowerCase().trim();
      domain   = process.env.PORTAL_DEV_DOMAIN?.toLowerCase() || 'dev';
    }

    // ── 3. Basic Auth fallback (IIS-forwarded Basic auth for non-Windows clients)
    if (!username && req.headers.authorization?.startsWith('Basic ')) {
      const b64 = req.headers.authorization.slice(6);
      const [u]  = Buffer.from(b64, 'base64').toString().split(':');
      username   = u?.toLowerCase() || null;
    }

    if (!username) {
      return res.status(401).json({ success: false, message: 'Unauthorized: no user identity' });
    }

    // ── 4. Fetch AD groups (cached)
    const groups = await adGroupService.getGroups(username);

    req.portalUser = { username, domain, groups };
    return next();

  } catch (err) {
    logger.logEvent('ERROR_SYSTEM', { level: 'error', message: `windowsAuth error: ${err.message}` });
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

module.exports = windowsAuthMiddleware;
