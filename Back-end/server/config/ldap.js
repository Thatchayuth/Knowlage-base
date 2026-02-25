'use strict';

const fs = require('fs');
const path = require('path');

// const ldapConfig = {
//     url:         process.env.LDAP_URL || 'ldaps://dc.internal:636',
//     baseDn:      process.env.LDAP_BASE_DN,
//     bindDn:      process.env.LDAP_BIND_DN,
//     bindPassword: process.env.LDAP_BIND_PASSWORD,
//     adminGroup:  process.env.LDAP_ADMIN_GROUP || 'admin-dt',
//     tlsOptions: {
//         rejectUnauthorized: true,
//         ca: process.env.LDAP_TLS_CA_CERT
//             ? [fs.readFileSync(process.env.LDAP_TLS_CA_CERT)]
//             : undefined,
//     },
//     timeout:         10000,
//     connectTimeout:  10000,
//     idleTimeout:     60000,
//     reconnect:       true,
// };
'use strict';

require('dotenv').config();

const useLdaps = process.env.LDAP_URL?.startsWith('ldaps://');

let tlsOptions = undefined;

if (useLdaps) {
    tlsOptions = {
        rejectUnauthorized: false
    };

    if (process.env.LDAP_TLS_CA_CERT) {
        tlsOptions = {
            rejectUnauthorized: true,
            ca: [fs.readFileSync(process.env.LDAP_TLS_CA_CERT)]
        };
    }
}

const ldapConfig  = {
    url: process.env.LDAP_URL,
    baseDn: process.env.LDAP_BASE_DN,
    bindDn: process.env.LDAP_BIND_DN,
    bindPassword: process.env.LDAP_BIND_PASSWORD,
    adminGroup: process.env.LDAP_ADMIN_GROUP || 'admin-dt',
    timeout: parseInt(process.env.LDAP_TIMEOUT || '5000', 10),
    connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || '5000', 10),
    idleTimeout: parseInt(process.env.LDAP_IDLE_TIMEOUT || '60000', 10),
    tlsOptions
};
module.exports = ldapConfig;
