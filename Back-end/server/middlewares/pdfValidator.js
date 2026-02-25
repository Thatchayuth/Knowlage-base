'use strict';

const allowedDomains = (process.env.PDF_ALLOWED_DOMAINS || 'fileserver.internal')
    .split(',').map(d => d.trim().toLowerCase());

function validatePdfDomain(url) {
    if (!url) return { valid: false, reason: 'No URL provided' };
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return { valid: false, reason: 'Malformed URL' };
    }

    const host = parsed.hostname.toLowerCase();
    const allowed = allowedDomains.some(domain => host === domain || host.endsWith(`.${domain}`));
    if (!allowed) {
        return { valid: false, reason: `Domain ${host} is not in allowed list` };
    }

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'Invalid protocol' };
    }

    return { valid: true, url: parsed.toString() };
}

module.exports = { validatePdfDomain, allowedDomains };
