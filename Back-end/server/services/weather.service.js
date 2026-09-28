'use strict';
/**
 * weather.service.js
 * ──────────────────
 * Current weather for the home page hero, from Open-Meteo (free, no API key).
 *
 * The server makes the upstream call and caches it, so onsite screens never
 * need internet access themselves and the whole site shares one request.
 *
 * Location: WEATHER_LAT / WEATHER_LON env vars
 * (default: NCR plant, Nikhom Phatthana, Rayong).
 */

const TTL_MS     = 15 * 60 * 1000; // refresh every 15 minutes
const TIMEOUT_MS = 5000;

const LAT = parseFloat(process.env.WEATHER_LAT) || 12.846;
const LON = parseFloat(process.env.WEATHER_LON) || 101.176;

let cached   = null;
let cachedAt = 0;
let inflight = null;

/** WMO weather code → condition key the frontend styles on + Thai label. */
function _describe(code, isDay) {
    if (code === 0)             return { condition: 'clear',    label: isDay ? 'แดดออก' : 'ท้องฟ้าโปร่ง' };
    if (code === 1 || code === 2) return { condition: 'partly', label: 'มีเมฆบางส่วน' };
    if (code === 3)             return { condition: 'cloudy',   label: 'เมฆมาก' };
    if (code === 45 || code === 48) return { condition: 'fog',  label: 'หมอก' };
    if (code >= 95)             return { condition: 'storm',    label: 'พายุฝนฟ้าคะนอง' };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        return { condition: 'rain', label: code <= 57 ? 'ฝนปรอย' : 'ฝนตก' };
    }
    return { condition: 'cloudy', label: 'เมฆมาก' }; // snow etc. — not expected here
}

async function _fetchUpstream() {
    const url = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${LAT}&longitude=${LON}`
        + '&current=temperature_2m,weather_code,is_day'
        + '&timezone=Asia%2FBangkok';
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
    const json = await r.json();
    const cur = json.current || {};
    const isDay = cur.is_day === 1;
    return {
        ..._describe(cur.weather_code, isDay),
        weatherCode: cur.weather_code,
        temperature: typeof cur.temperature_2m === 'number' ? Math.round(cur.temperature_2m) : null,
        isDay,
        observedAt:  cur.time || null,
    };
}

/**
 * @returns {Promise<{condition, label, weatherCode, temperature, isDay, observedAt}>}
 * Serves a stale copy when the upstream call fails; throws only if there is none.
 */
async function getCurrentWeather() {
    if (cached && Date.now() - cachedAt < TTL_MS) return cached;
    if (!inflight) {
        inflight = _fetchUpstream()
            .then(data => { cached = data; cachedAt = Date.now(); return data; })
            .finally(() => { inflight = null; });
    }
    try {
        return await inflight;
    } catch (err) {
        if (cached) return cached;
        throw err;
    }
}

module.exports = { getCurrentWeather };
