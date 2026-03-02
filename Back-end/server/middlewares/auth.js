'use strict';

const { authenticateUser, isInGroup } = require('../services/ldapService');
const logger = require('../services/logger');
const ldapConfig = require('../config/ldap');

// ============================================================
// authenticateAD()
// Reads Basic Auth header, validates against AD, attaches user to req
// ============================================================
async function authenticateAD(req, res, next) {
   
    const startTime = Date.now();
    const ip = _getIp(req);
    const ua = req.get('user-agent') || '';

    const authHeader = req.get('Authorization') || '';
    if (!authHeader.startsWith('Basic ')) {
        return res.status(401).json({ error: 'Authentication required', code: 'NO_AUTH' });
    }

    let username, password;
    try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const sep = decoded.indexOf(':');
        if (sep === -1) throw new Error('Invalid format');
        username = decoded.substring(0, sep).trim().toLowerCase();
        password = decoded.substring(sep + 1);
      
    } catch {
        return res.status(401).json({ error: 'Invalid Authorization header', code: 'INVALID_AUTH' });
    }

    if (!username || !password) {
        return res.status(401).json({ error: 'Username and password required', code: 'EMPTY_CREDS' });
    }

    try {
        const user = await authenticateUser(username, password);
        const executionTimeMs = Date.now() - startTime;

        // Determine role
        console.log(`User groups: ${user.groups.join(', ')}`);
        const isAdmin = isInGroup(user.groups, ldapConfig.adminGroup);
        user.role = isAdmin ? 'admin' : 'readonly';

        req.user = user;

        logger.logEvent('LOGIN_SUCCESS', {
            username:       user.username,
            ip,
            userAgent:      ua,
            executionTimeMs,
            message:        `User ${user.username} authenticated as ${user.role}`,
            meta:           { groups: user.groups, role: user.role },
        });

        next();
    } catch (err) {
        const executionTimeMs = Date.now() - startTime;
        logger.logEvent('LOGIN_FAIL', {
            username,
            ip,
            userAgent:      ua,
            executionTimeMs,
            level:          'warn',
            message:        `Login failed for ${username}: ${err.message}`,
        });

        if (err.message === 'Invalid credentials' || err.message === 'User not found in directory') {
            return res.status(401).json({ error: 'Invalid username or password', code: 'INVALID_CREDS' });
        }
        return res.status(503).json({ error: 'Authentication service unavailable', code: 'AUTH_UNAVAILABLE' });
    }
}

// ============================================================
// authorizeGroup(groupName)
// Requires authenticateAD to run first
// ============================================================
function authorizeGroup(groupName) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated', code: 'NO_AUTH' });
        }

        if (!isInGroup(req.user.groups, groupName) && req.user.role !== 'admin') {
            logger.logEvent('ERROR_SYSTEM', {
                username:  req.user.username,
                ip:        _getIp(req),
                userAgent: req.get('user-agent'),
                level:     'warn',
                message:   `Access denied for ${req.user.username} to ${req.path} (requires ${groupName})`,
            });
            return res.status(403).json({ error: 'Access denied. Insufficient privileges.', code: 'FORBIDDEN' });
        }

        next();
    };
}

// ============================================================
// requireAuth - lightweight alias used on public routes that still need a user
// ============================================================
const requireAuth = authenticateAD;

function _getIp(req) {
    return req.ip ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.connection?.remoteAddress ||
        'unknown';
}
async function authenticateADother(req, res) {

    const startTime = Date.now();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.get('user-agent') || '';

    const authHeader = req.get('Authorization') || '';
    if (!authHeader.startsWith('Basic ')) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'NO_AUTH'
        });
    }

    let username, password;

    try {
        const decoded = Buffer
            .from(authHeader.slice(6), 'base64')
            .toString('utf8');

        const sep = decoded.indexOf(':');
        if (sep === -1) throw new Error('Invalid format');

        username = decoded.substring(0, sep).trim().toLowerCase();
        password = decoded.substring(sep + 1);

    } catch {
        return res.status(401).json({
            error: 'Invalid Authorization header',
            code: 'INVALID_AUTH'
        });
    }

    if (!username || !password) {
        return res.status(401).json({
            error: 'Username and password required',
            code: 'EMPTY_CREDS'
        });
    }

    try {
        const user = await authenticateUser(username, password);

        // ===== Extract group names only =====
        const groupNames = [...new Set(
            (user.groups || [])
                .map(dn => {
                    if (!dn) return null;
                    const firstPart = dn.split(',')[0];
                    return firstPart.replace(/^CN=/i, '').trim();
                })
                .filter(Boolean)
        )];

        return res.json({
            success: true,
            username: user.username,
            groups: groupNames,
            executionTimeMs: Date.now() - startTime
        });

    } catch (err) {

        if (
            err.message === 'Invalid credentials' ||
            err.message === 'User not found in directory'
        ) {
            return res.status(401).json({
                error: 'Invalid username or password',
                code: 'INVALID_CREDS'
            });
        }

        return res.status(503).json({
            error: 'Authentication service unavailable',
            code: 'AUTH_UNAVAILABLE'
        });
    }
}

module.exports = { authenticateAD, authorizeGroup, requireAuth , authenticateADother};
