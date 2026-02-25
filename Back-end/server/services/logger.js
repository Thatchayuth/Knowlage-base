'use strict';

require('dotenv').config();
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const Transport = require('winston-transport');

const LOG_DIR = process.env.LOG_DIR || './server/logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const IS_DEV = process.env.NODE_ENV !== 'production';

// ============================================================
// MSSQL Transport (writes to SystemLogs table)
// ============================================================
class MSSQLTransport extends Transport {
    constructor(opts) {
        super(opts);
        this.name = 'mssql';
        this._queue = [];
        this._flushing = false;
        this._ready = false;
        // Lazy-load to avoid circular dependency
        setTimeout(() => { this._ready = true; }, 2000);
    }

    log(info, callback) {
        setImmediate(() => this.emit('logged', info));

        if (!this._ready) {
            callback();
            return;
        }

        const entry = {
            LogLevel:       info.level?.toUpperCase() || 'INFO',
            ActionType:     info.actionType || 'GENERAL',
            Username:       info.username || null,
            IpAddress:      info.ip || null,
            UserAgent:      info.userAgent ? String(info.userAgent).substring(0, 499) : null,
            Entity:         info.entity || null,
            EntityId:       info.entityId != null ? String(info.entityId) : null,
            Message:        typeof info.message === 'string' ? info.message : JSON.stringify(info.message),
            ExecutionTimeMs: info.executionTimeMs || null,
            ErrorStack:     info.error || null,
            Metadata:       info.meta ? JSON.stringify(info.meta) : null,
        };

        this._queue.push(entry);
        this._flush();
        callback();
    }

    async _flush() {
        if (this._flushing || this._queue.length === 0) return;
        this._flushing = true;

        const batch = this._queue.splice(0, 50);
        try {
            const { sql, getPool } = require('../config/database');
            const pool = await getPool();
            const table = new sql.Table('SystemLogs');
            table.create = false;
            table.columns.add('LogLevel',       sql.NVarChar(20),   { nullable: false });
            table.columns.add('ActionType',     sql.NVarChar(50),   { nullable: false });
            table.columns.add('Username',       sql.NVarChar(100),  { nullable: true });
            table.columns.add('IpAddress',      sql.NVarChar(50),   { nullable: true });
            table.columns.add('UserAgent',      sql.NVarChar(500),  { nullable: true });
            table.columns.add('Entity',         sql.NVarChar(100),  { nullable: true });
            table.columns.add('EntityId',       sql.NVarChar(50),   { nullable: true });
            table.columns.add('Message',        sql.NVarChar(sql.MAX), { nullable: false });
            table.columns.add('ExecutionTimeMs', sql.Int,           { nullable: true });
            table.columns.add('ErrorStack',     sql.NVarChar(sql.MAX), { nullable: true });
            table.columns.add('Metadata',       sql.NVarChar(sql.MAX), { nullable: true });

            for (const e of batch) {
                table.rows.add(
                    e.LogLevel, e.ActionType, e.Username, e.IpAddress,
                    e.UserAgent, e.Entity, e.EntityId, e.Message,
                    e.ExecutionTimeMs, e.ErrorStack, e.Metadata
                );
            }

            const request = pool.request();
            await request.bulk(table);
        } catch (err) {
            // Silently drop — we cannot log a log failure
        } finally {
            this._flushing = false;
            if (this._queue.length > 0) {
                setTimeout(() => this._flush(), 500);
            }
        }
    }
}

// ============================================================
// Logger instance
// ============================================================
const logFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.json()
);

const loggerTransports = [
    new DailyRotateFile({
        dirname:        LOG_DIR,
        filename:       'km-%DATE%.log',
        datePattern:    'YYYY-MM-DD',
        maxSize:        process.env.LOG_MAX_SIZE || '20m',
        maxFiles:       process.env.LOG_MAX_FILES || '30d',
        zippedArchive:  true,
        format:         logFormat,
    }),
    new DailyRotateFile({
        dirname:        LOG_DIR,
        filename:       'km-error-%DATE%.log',
        datePattern:    'YYYY-MM-DD',
        level:          'error',
        maxSize:        process.env.LOG_MAX_SIZE || '20m',
        maxFiles:       '90d',
        zippedArchive:  true,
        format:         logFormat,
    }),
    new MSSQLTransport({ level: LOG_LEVEL }),
];

if (IS_DEV) {
    loggerTransports.push(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.timestamp({ format: 'HH:mm:ss.SSS' }),
            format.printf(({ timestamp, level, message, actionType, username, executionTimeMs }) => {
                let line = `${timestamp} [${level}]`;
                if (actionType) line += ` [${actionType}]`;
                if (username)   line += ` [${username}]`;
                line += ` ${typeof message === 'object' ? JSON.stringify(message) : message}`;
                if (executionTimeMs != null) line += ` (${executionTimeMs}ms)`;
                return line;
            })
        )
    }));
}

const logger = createLogger({
    level:       LOG_LEVEL,
    format:      logFormat,
    transports:  loggerTransports,
    exitOnError: false,
});

// ============================================================
// Helper: structured log events
// ============================================================
logger.logEvent = function (actionType, opts = {}) {
    const level = opts.level || 'info';
    this[level]({
        actionType,
        username:       opts.username || null,
        ip:             opts.ip || null,
        userAgent:      opts.userAgent || null,
        entity:         opts.entity || null,
        entityId:       opts.entityId || null,
        executionTimeMs: opts.executionTimeMs || null,
        error:          opts.error || null,
        meta:           opts.meta || null,
        message:        opts.message || actionType,
    });
};

module.exports = logger;
