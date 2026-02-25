'use strict';

const logger = require('../services/logger');

// ============================================================
// GET /api/auth/me
// Returns authenticated AD user profile for login
// ============================================================
function getCurrentUser(req, res) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated', code: 'NO_AUTH' });
    }

    const payload = {
        username:    req.user.username,
        displayName: req.user.displayName,
        email:       req.user.email,
        groups:      req.user.groups || [],
        role:        req.user.role || 'readonly',
    };

    logger.logEvent('AUTH_ME', {
        username: req.user.username,
        message:  `Fetched profile for ${req.user.username}`,
    });

    return res.json(payload);
}

module.exports = { getCurrentUser };
