'use strict';

const ldap = require('ldapjs');
const ldapConfig = require('../config/ldap');
const logger = require('./logger');

// ============================================================
// Authenticate User
// ============================================================

async function authenticateUser(username, password) {
    if (!username || !password) {
        throw new Error('Username and password are required');
    }

    const client = _createClient();

    try {
        // 1️⃣ Bind ด้วย service account
        await _bind(client, ldapConfig.bindDn, ldapConfig.bindPassword);

        // 2️⃣ Search หา DN จริงของ user
        const userEntry = await _findUser(client, username);

        if (!userEntry) {
            throw new Error('User not found in directory');
        }

        const userDn = userEntry.dn.toString();
        const attrs = _parseAttributes(userEntry);

        // 3️⃣ Bind ด้วย user DN เพื่อตรวจสอบ password
        await _bind(client, userDn, password);

        const groups = _extractGroups(attrs.memberOf);

        return {
            dn: userDn,
            username: attrs.sAMAccountName || username,
            displayName: attrs.displayName || username,
            email: attrs.mail || null,
            groups
        };

    } catch (err) {
        if (err.code === 49) {
            throw new Error('Invalid credentials');
        }

        logger.logEvent('ERROR_SYSTEM', {
            message: `LDAP auth error: ${err.message}`,
            stack: err.stack
        });

        throw err;
    } finally {
        client.destroy();
    }
}

// ============================================================
// Get user groups only
// ============================================================

async function getUserGroups(username) {
    const client = _createClient();

    try {
        await _bind(client, ldapConfig.bindDn, ldapConfig.bindPassword);

        const userEntry = await _findUser(client, username);
        if (!userEntry) return [];

        const attrs = _parseAttributes(userEntry);
        return _extractGroups(attrs.memberOf);

    } finally {
        client.destroy();
    }
}

// ============================================================
// Check Admin Group
// ============================================================

function isInGroup(groups, groupName) {
    if (!groups || !groupName) return false;

    return groups.some(
        g => g.toLowerCase() === groupName.toLowerCase()
    );
}

// ============================================================
// PRIVATE HELPERS
// ============================================================

function _createClient() {
    return ldap.createClient({
        url: ldapConfig.url,
        timeout: ldapConfig.timeout,
        connectTimeout: ldapConfig.connectTimeout,
        idleTimeout: ldapConfig.idleTimeout,
        tlsOptions: ldapConfig.tlsOptions,
        reconnect: false
    });
}

function _bind(client, dn, password) {
    return new Promise((resolve, reject) => {
        client.bind(dn, password, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function _findUser(client, username) {
    const searchOpts = {
        filter: `(&(objectClass=user)(sAMAccountName=${_escapeLdap(username)}))`,
        scope: 'sub',
        attributes: ['dn', 'sAMAccountName', 'displayName', 'mail', 'memberOf'],
        sizeLimit: 1,
        timeLimit: 10
    };

    return new Promise((resolve, reject) => {
        client.search(ldapConfig.baseDn, searchOpts, (err, res) => {
            if (err) return reject(err);

            let userEntry = null;

            res.on('searchEntry', (entry) => {
                userEntry = entry;
            });

            res.on('error', reject);
            res.on('end', () => resolve(userEntry));
        });
    });
}

function _escapeLdap(str) {
    return str.replace(/[\\*\(\)\x00]/g, c =>
        `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`
    );
}

function _parseAttributes(entry) {
    const result = {};

    if (!entry?.attributes) return result;

    for (const attr of entry.attributes) {
        const vals = attr.vals || attr.values || [];
        result[attr.type] = vals.length === 1 ? vals[0] : vals;
    }

    return result;
}

function _extractGroups(memberOf) {
    if (!memberOf) return [];

    const arr = Array.isArray(memberOf) ? memberOf : [memberOf];

    return arr.map(dn => {
        const first = dn.split(',')[0];
        return first.startsWith('CN=') ? first.substring(3) : first;
    });
}

module.exports = {
    authenticateUser,
    getUserGroups,
    isInGroup
};
