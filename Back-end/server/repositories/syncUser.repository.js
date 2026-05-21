'use strict';
/**
 * syncUser.repository.js
 * ──────────────────────
 * Data-access layer สำหรับตาราง dbo.SyncUsers
 *
 * SyncUser คือ user รายบุคคล (username) ที่ admin อนุญาตให้ trigger sync ได้
 * โดยไม่ต้องเป็นสมาชิกกลุ่ม LDAP_ADMIN_GROUP
 */

const { sql, getPool } = require('../config/database');

/** คืนรายชื่อ SyncUser ทั้งหมดที่ IsActive = 1 */
async function getAll() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, Username, CreatedAt, CreatedBy, IsActive
    FROM   dbo.SyncUsers
    WHERE  IsActive = 1
    ORDER  BY CreatedAt DESC
  `);
  return result.recordset;
}

/**
 * ตรวจว่า username มีอยู่ใน SyncUsers (IsActive=1) หรือไม่
 * @returns {Object|null} record หรือ null
 */
async function getByUsername(username) {
  const pool = await getPool();
  const result = await pool.request()
    .input('username', sql.NVarChar(100), username.toLowerCase().trim())
    .query(`
      SELECT Id, Username, CreatedAt, CreatedBy
      FROM   dbo.SyncUsers
      WHERE  Username = @username AND IsActive = 1
    `);
  return result.recordset[0] || null;
}

/**
 * เพิ่ม SyncUser ใหม่
 * @throws หาก username ซ้ำ (UQ_SyncUsers_Username)
 */
async function create(username, createdBy) {
  const pool = await getPool();
  const result = await pool.request()
    .input('username',  sql.NVarChar(100), username.toLowerCase().trim())
    .input('createdBy', sql.NVarChar(100), createdBy)
    .query(`
      INSERT INTO dbo.SyncUsers (Username, CreatedBy)
      OUTPUT INSERTED.Id, INSERTED.Username, INSERTED.CreatedAt, INSERTED.CreatedBy
      VALUES (@username, @createdBy)
    `);
  return result.recordset[0];
}

/**
 * ลบ SyncUser (soft-delete: IsActive=0)
 * @returns {boolean} true ถ้าพบและลบ
 */
async function remove(id) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      UPDATE dbo.SyncUsers SET IsActive = 0 WHERE Id = @id AND IsActive = 1
    `);
  return result.rowsAffected[0] > 0;
}

module.exports = { getAll, getByUsername, create, remove };
