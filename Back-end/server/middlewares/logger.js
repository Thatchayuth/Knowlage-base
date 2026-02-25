'use strict';

const logger = require('../services/logger');

function _getIp(req) {
    return req.ip ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.connection?.remoteAddress ||
        'unknown';
}

// ============================================================
// requestLogger middleware
// Attaches startTime, logs completion
// ============================================================
function requestLogger(req, res, next) {
    req._startTime = Date.now();

    const ip = _getIp(req);
    const ua = req.get('user-agent') || '';

    res.on('finish', () => {
        const executionTimeMs = Date.now() - req._startTime;
        const username = req.user?.username || 'anonymous';
        const level = res.statusCode >= 500 ? 'error'
                    : res.statusCode >= 400 ? 'warn'
                    : 'info';

        logger[level]({
            actionType:     'HTTP_REQUEST',
            username,
            ip,
            userAgent:      ua,
            executionTimeMs,
            message:        `${req.method} ${req.originalUrl} ${res.statusCode}`,
            meta: {
                method:     req.method,
                url:        req.originalUrl,
                statusCode: res.statusCode,
                contentLength: res.get('content-length') || null,
            },
        });
    });

    next();
}

// ============================================================
// errorLogger middleware (last in chain after routes)
// ============================================================
function errorLogger(err, req, res, next) {
    const executionTimeMs = Date.now() - (req._startTime || Date.now());
    const ip = _getIp(req);

    logger.logEvent('ERROR_SYSTEM', {
        level:          'error',
        username:       req.user?.username || 'anonymous',
        ip,
        userAgent:      req.get('user-agent'),
        executionTimeMs,
        entity:         req.originalUrl,
        error:          err.stack || err.message,
        message:        err.message || 'Unhandled error',
    });

    const statusCode = err.statusCode || err.status || 500;
    const isProd = process.env.NODE_ENV === 'production';

    res.status(statusCode).json({
        error:   isProd && statusCode === 500 ? 'Internal server error' : err.message,
        code:    err.code || 'INTERNAL_ERROR',
        ...(isProd ? {} : { stack: err.stack }),
    });
}

// ============================================================
// notFoundHandler - must be before errorLogger
// ============================================================
function notFoundHandler(req, res, next) {
    const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    next(err);
}

module.exports = { requestLogger, errorLogger, notFoundHandler };
