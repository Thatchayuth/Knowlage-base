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
const portalFolderRoutes                  = require('./routes/folders');
const portalPermissionRoutes              = require('./routes/permissions');
const homeRoutes                          = require('./routes/home');
const { getPool, closePool }              = require('./config/database');

const app  = express();
const PORT = process.env.PORT || 5203;

const cors = require('cors');
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://10.10.0.105:5173,http://192.168.8.120:4200,http://192.168.8.120:8000';

// CORS: allow front-end dev server and production origin (from env)
const corsOptionsDelegate = (req, callback) => {
    const origin = req.header('Origin');
    let isAllowed = false;
    
    if (!origin) {
        isAllowed = true;
    } else {
        const allowed = String(CORS_ORIGIN).split(',').map(s => s.trim());
        if (allowed.includes('*') || allowed.includes(origin)) {
            isAllowed = true;
        } else {
            // Dynamic check: Allow if origin hostname matches the server's request hostname (same server, different ports)
            try {
                const originUrl = new URL(origin);
                const hostHeader = req.header('host') || '';
                const serverHostname = hostHeader.split(':')[0];
                if (originUrl.hostname === serverHostname || originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
                    isAllowed = true;
                }
            } catch (e) {
                // ignore
            }
        }
    }
    
    callback(null, {
        origin: isAllowed,
        credentials: true,
        methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
        allowedHeaders: ['Content-Type','Authorization','X-Requested-With','X-Auth-User','X-Remote-User','Range'],
        exposedHeaders: ['Content-Length', 'Content-Disposition']
    });
};

app.use(cors(corsOptionsDelegate));

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
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
}));

// ============================================================
// Rate Limiting
// ============================================================
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max:      parseInt(process.env.RATE_LIMIT_MAX, 10)        || 500,
    standardHeaders: true,
    legacyHeaders:   false,
    // Key per authenticated username when Basic Auth is present,
    // otherwise fall back to IP (for unauthenticated / health-check requests).
    // This prevents one user's quota from blocking other users on the same corporate IP/NAT.
    keyGenerator: (req) => {
        const authHeader = req.get('Authorization') || '';
        if (authHeader.startsWith('Basic ')) {
            try {
                const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
                const sep = decoded.indexOf(':');
                if (sep > 0) return `user:${decoded.substring(0, sep).toLowerCase().trim()}`;
            } catch { /* fall through to IP */ }
        }
        return req.ip || 'unknown';
    },
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
app.use('/api/portal',     portalFolderRoutes);
app.use('/api/portal',     portalPermissionRoutes);
app.use('/api/home',       homeRoutes.publicRouter);
app.use('/api/admin/home', adminLimiter, homeRoutes.adminRouter);

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

        const isPipe = isNaN(PORT);
        const listenArgs = isPipe ? [PORT] : [parseInt(PORT, 10) || 3000, '0.0.0.0'];

        const server = app.listen(...listenArgs, () => {
            logger.info({
                actionType: 'ERROR_SYSTEM',
                message:    `Knowledge Management System started on ${isPipe ? 'pipe ' + PORT : 'port ' + PORT} [${process.env.NODE_ENV || 'production'}]`,
            });
        });

        server.timeout         = 360000;  // 6 min — allows large UNC sync to complete
        server.keepAliveTimeout = 65000;
        server.headersTimeout   = 70000;

        // ── Auto-sync scheduled job ──────────────────────────────
        // Drive root อ่านจาก DB (dbo.SiteSettings key='portal_drive_root') ทุกครั้งที่ sync
        // ไม่ใช้ PORTAL_DRIVE_ROOT จาก .env อีกต่อไป
        const syncInterval = parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 0;

        if (syncInterval > 0) {
            const folderSyncService = require('./services/folderSync.service');
            const { getPool: _getPool } = require('./config/database');
            const intervalMs = syncInterval * 60 * 1000;

            const runAutoSync = async () => {
                // Another sync (admin / syncuser / previous tick) still running → skip this tick
                if (folderSyncService.isSyncRunning()) {
                    logger.logEvent('ERROR_SYSTEM', { level: 'warn', message: '[AUTO-SYNC] sync อื่นกำลังทำงานอยู่ — ข้ามรอบนี้' });
                    return;
                }
                try {
                    // อ่าน path จาก DB ทุกครั้ง — ถ้า admin อัพเดตใน Settings จะมีผลทันทีรอบหน้า
                    const pool = await _getPool();
                    const sr = await pool.request().query(
                        "SELECT SettingValue FROM dbo.SiteSettings WHERE SettingKey = 'portal_drive_root'"
                    );
                    const syncRoot = sr.recordset[0]?.SettingValue;
                    if (!syncRoot) {
                        logger.logEvent('ERROR_SYSTEM', { level: 'warn', message: '[AUTO-SYNC] portal_drive_root ยังไม่ได้ตั้งค่าใน DB — ข้ามรอบนี้' });
                        return;
                    }
                    const r = await folderSyncService.syncDrive(syncRoot, 'auto-sync', '127.0.0.1');
                    logger.info({
                        actionType: 'ERROR_SYSTEM',
                        message: `[AUTO-SYNC] done — inserted:${r.inserted} updated:${r.updated} deleted:${r.deleted} files:${r.filesScanned}`,
                    });
                } catch (e) {
                    if (e.code === folderSyncService.SYNC_IN_PROGRESS) {
                        // Lost the race to a manual sync started while reading settings — skip
                        logger.logEvent('ERROR_SYSTEM', { level: 'warn', message: '[AUTO-SYNC] sync อื่นกำลังทำงานอยู่ — ข้ามรอบนี้' });
                        return;
                    }
                    logger.logEvent('ERROR_SYSTEM', { level: 'warn', message: `[AUTO-SYNC] failed: ${e.message}` });
                }
            };

            setTimeout(runAutoSync, 15000); // 15 sec after startup
            setInterval(runAutoSync, intervalMs);

            logger.info({
                actionType: 'ERROR_SYSTEM',
                message: `[AUTO-SYNC] scheduled every ${syncInterval} min (drive root from DB)`,
            });
        }

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

// Touched to reload iisnode and apply controller changes

