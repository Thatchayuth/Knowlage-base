'use strict';

const sql = require('mssql');
const logger = require('../services/logger');

const dbConfig = {
    server:   process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT, 10) || 1433,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt:              process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
        instanceName: process.env.DB_INSTANCE,
        enableArithAbort:     true,
        connectTimeout:       30000,
        requestTimeout:       30000,
    },
    pool: {
        max:             20,
        min:             2,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
    },
};

let _pool = null;

async function getPool() {
    if (_pool && _pool.connected) return _pool;
    if (_pool && _pool.connecting) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return getPool();
    }
    try {
        _pool = await new sql.ConnectionPool(dbConfig).connect();
        _pool.on('error', (err) => {
            logger.error({ actionType: 'ERROR_SYSTEM', message: 'MSSQL Pool error', error: err.message });
            _pool = null;
        });
        logger.info({ actionType: 'ERROR_SYSTEM', message: 'MSSQL pool connected successfully' });
        return _pool;
    } catch (err) {
        _pool = null;
        throw err;
    }
}

async function closePool() {
    if (_pool) {
        await _pool.close();
        _pool = null;
    }
}

module.exports = { sql, getPool, closePool };
