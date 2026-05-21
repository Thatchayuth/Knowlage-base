'use strict';

const { getPool, sql } = require('../config/database');
const { validationResult } = require('express-validator');

/**
 * GET /api/settings — public, returns all settings as a flat object
 */
async function getSettings(req, res, next) {
    try {
        const pool = await getPool();
        const result = await pool.request().query(
            'SELECT SettingKey, SettingValue FROM dbo.SiteSettings'
        );
        const settings = {};
        result.recordset.forEach(row => { settings[row.SettingKey] = row.SettingValue; });
        return res.json({ data: settings });
    } catch (err) { next(err); }
}

/**
 * PUT /api/admin/settings — admin only, upsert settings
 */
async function updateSettings(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { portal_title, portal_icon, portal_drive_root } = req.body;
    const updatedBy = req.user?.username || 'admin';

    const settingsToUpdate = [
        { key: 'portal_title',      value: portal_title?.trim() },
        { key: 'portal_icon',       value: (portal_icon || 'folder').trim() },
        { key: 'portal_drive_root', value: portal_drive_root?.trim() },
    ].filter(s => s.value != null && s.value !== '');

    try {
        const pool = await getPool();
        for (const s of settingsToUpdate) {
            await pool.request()
                .input('Key',       sql.NVarChar(100), s.key)
                .input('Value',     sql.NVarChar(500),  s.value)
                .input('UpdatedBy', sql.NVarChar(100),  updatedBy)
                .query(`
                    MERGE dbo.SiteSettings AS target
                    USING (SELECT @Key AS SettingKey, @Value AS SettingValue) AS source
                      ON target.SettingKey = source.SettingKey
                    WHEN MATCHED THEN
                        UPDATE SET SettingValue = source.SettingValue,
                                   UpdatedAt   = SYSDATETIME(),
                                   UpdatedBy   = @UpdatedBy
                    WHEN NOT MATCHED THEN
                        INSERT (SettingKey, SettingValue, UpdatedBy)
                        VALUES (source.SettingKey, source.SettingValue, @UpdatedBy);
                `);
        }
        return res.json({ data: { portal_title: portal_title?.trim(), portal_icon: (portal_icon || 'folder').trim(), portal_drive_root: portal_drive_root?.trim() } });
    } catch (err) { next(err); }
}

module.exports = { getSettings, updateSettings };
