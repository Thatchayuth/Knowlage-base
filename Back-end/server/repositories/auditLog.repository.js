'use strict';
/**
 * auditLog.repository.js
 * ──────────────────────
 * Data-access layer for PortalAuditLogs.
 * All portal user actions are recorded here (view, download, sync, perm changes).
 *
 * Called by : folder.service.js, permission.service.js, sync.controller.js
 * Depends on: config/database.js
 *
 * Design: log() is fire-and-forget — errors are swallowed so they never
 *         break the main request flow.
 */

const { sql, getPool } = require('../config/database');
const logger = require('../services/logger');

/**
 * Insert one audit record.
 *
 * @param {{
 *   username?:    string,
 *   action:       'VIEW_FOLDER'|'VIEW_FILE'|'DOWNLOAD'|'SYNC'|'PERM_CHANGE'|'FOLDER_EDIT',
 *   resourceType: 'FOLDER'|'FILE',
 *   resourceId?:  number,
 *   resourcePath?: string,
 *   details?:     object,
 *   ipAddress?:   string,
 *   userAgent?:   string,
 * }} entry
 */
async function log(entry) {
  try {
    const pool = await getPool();
    await pool.request()
      .input('username',     sql.NVarChar(100),      entry.username     || null)
      .input('action',       sql.NVarChar(50),       entry.action)
      .input('resourceType', sql.NVarChar(50),       entry.resourceType)
      .input('resourceId',   sql.Int,                entry.resourceId   || null)
      .input('resourcePath', sql.NVarChar(1000),     entry.resourcePath || null)
      .input('details',      sql.NVarChar(sql.MAX),
        entry.details ? JSON.stringify(entry.details) : null)
      .input('ip',           sql.NVarChar(50),       entry.ipAddress    || null)
      .input('ua',           sql.NVarChar(500),      entry.userAgent    || null)
      .query(`
        INSERT INTO dbo.PortalAuditLogs
          (Username, Action, ResourceType, ResourceId, ResourcePath, Details, IpAddress, UserAgent)
        VALUES
          (@username,@action,@resourceType,@resourceId,@resourcePath,@details,@ip,@ua)
      `);
  } catch (err) {
    logger.warn({ actionType: 'AUDIT_LOG_FAIL', message: err.message });
  }
}

async function getRecent(limit = 100) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('top', sql.Int, limit)
    .query(`
      SELECT TOP (@top) Id,Username,Action,ResourceType,ResourceId,
             ResourcePath,Details,IpAddress,CreatedAt
      FROM   dbo.PortalAuditLogs
      ORDER  BY CreatedAt DESC
    `);
  return result.recordset;
}

async function getByUsername(username, limit = 200) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('user', sql.NVarChar(100), username)
    .input('top',  sql.Int,           limit)
    .query(`SELECT TOP (@top) * FROM dbo.PortalAuditLogs WHERE Username=@user ORDER BY CreatedAt DESC`);
  return result.recordset;
}

async function getByResource(resourceType, resourceId) {
  const pool   = await getPool();
  const result = await pool.request()
    .input('type', sql.NVarChar(50), resourceType)
    .input('rid',  sql.Int,          resourceId)
    .query(`SELECT * FROM dbo.PortalAuditLogs WHERE ResourceType=@type AND ResourceId=@rid ORDER BY CreatedAt DESC`);
  return result.recordset;
}

module.exports = { log, getRecent, getByUsername, getByResource };
