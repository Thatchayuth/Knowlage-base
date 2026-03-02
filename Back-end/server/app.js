'use strict';
require('dotenv').config({
  path: require('path').join(__dirname, '../.env')
});
// require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');

const logger                              = require('./services/logger');
const { requestLogger, errorLogger,
        notFoundHandler }                 = require('./middlewares/logger');
const apiRoutes                           = require('./routes/api');
const adminRoutes                         = require('./routes/admin');
const administratorRoute                  = require('./routes/administrator');
const { getPool, closePool }              = require('./config/database');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

const cors = require('cors');
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://10.10.0.69:5173,http://192.168.8.120:4200,http://192.168.8.120:8000';
// || 'http://localhost:5173' 
// CORS: allow front-end dev server and production origin (from env)
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = String(CORS_ORIGIN).split(',').map(s => s.trim());
        if (allowed.includes('*') || allowed.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
}));

// ============================================================
// Trust internal proxy headers
// ============================================================
app.set('trust proxy', 1);

// ============================================================
// Ensure logs directory exists
// ============================================================
const logDir = path.resolve(process.env.LOG_DIR || './server/logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// ============================================================
// Security headers (Helmet)
// ============================================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc:  ["'self'"],
            styleSrc:   ["'self'"],
            imgSrc:     ["'self'", 'data:'],
            connectSrc: ["'self'"],
            frameSrc:   ["'none'"],
            objectSrc:  ["'none'"],
        },
    },
    hsts: {
        maxAge:            31536000,
        includeSubDomains: true,
        preload:           true,
    },
    referrerPolicy:         { policy: 'no-referrer' },
    noSniff:                true,
    xssFilter:              true,
    frameguard:             { action: 'deny' },
}));

// ============================================================
// Rate Limiting
// ============================================================
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max:      parseInt(process.env.RATE_LIMIT_MAX, 10)        || 200,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
    handler: (req, res, next, options) => {
        logger.logEvent('ERROR_SYSTEM', {
            level:    'warn',
            ip:       req.ip,
            userAgent: req.get('user-agent'),
            message:  `Rate limit exceeded: ${req.method} ${req.originalUrl}`,
        });
        res.status(429).json(options.message);
    },
});

const adminLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max:      parseInt(process.env.RATE_LIMIT_ADMIN_MAX, 10) || 500,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { error: 'Too many requests', code: 'RATE_LIMITED' },
});

app.use(globalLimiter);

// ============================================================
// Body parsing
// ============================================================
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

// ============================================================
// Request logging
// ============================================================
app.use(requestLogger);

// ============================================================
// Health check (no auth, no rate limit)
// ============================================================
app.get('/health', async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request().query('SELECT 1 AS ok');
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ status: 'error', message: err.message });
    }
});

// ============================================================
// Routes
// ============================================================
app.use('/api',            apiRoutes);
app.use('/api/admin',      adminLimiter, adminRoutes);
app.use('/administrator',  adminLimiter, administratorRoute);

// ============================================================
// 404 and Error handlers (must be last)
// ============================================================
app.use(notFoundHandler);
app.use(errorLogger);

// ============================================================
// Start server
// ============================================================
async function start() {
    try {
        // Pre-warm DB pool
        await getPool();
        logger.info({ actionType: 'ERROR_SYSTEM', message: 'Database pool initialized' });

        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info({
                actionType: 'ERROR_SYSTEM',
                message:    `Knowledge Management System started on port ${PORT} [${process.env.NODE_ENV || 'production'}]`,
            });
        });

        server.timeout         = 30000;
        server.keepAliveTimeout = 65000;
        server.headersTimeout   = 70000;

        // Graceful shutdown
        const shutdown = async (signal) => {
            logger.info({ actionType: 'ERROR_SYSTEM', message: `${signal} received — shutting down` });
            server.close(async () => {
                await closePool();
                process.exit(0);
            });
            setTimeout(() => process.exit(1), 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT',  () => shutdown('SIGINT'));

        process.on('unhandledRejection', (reason) => {
            logger.logEvent('ERROR_SYSTEM', {
                level:   'error',
                message: `Unhandled Promise Rejection: ${reason}`,
                error:   reason instanceof Error ? reason.stack : String(reason),
            });
        });

        process.on('uncaughtException', (err) => {
            logger.logEvent('ERROR_SYSTEM', {
                level:   'error',
                message: `Uncaught Exception: ${err.message}`,
                error:   err.stack,
            });
            process.exit(1);
        });

    } catch (err) {
        logger.logEvent('ERROR_SYSTEM', {
            level:   'error',
            message: `Failed to start server: ${err.message}`,
            error:   err.stack,
        });
        process.exit(1);
    }
}

start();

module.exports = app;

