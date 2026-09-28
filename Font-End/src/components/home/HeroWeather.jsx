import { useEffect, useMemo, useState } from 'react'
import api from '../../services/axios'

// ────────── Data ──────────
// The server caches Open-Meteo for 15 minutes, so polling at the same rate is enough.
// On error the last good value stays; with none, the hero falls back to time of day.
const POLL_MS = 15 * 60 * 1000

export function useWeather() {
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    let alive = true
    const load = () => api.get('/api/home/weather')
      .then(r => { if (alive && r.data?.condition) setWeather(r.data) })
      .catch(() => { /* keep last value */ })
    load()
    const id = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])
  return weather
}

// ────────── Scenes ──────────
// Class strings stay literal so Tailwind keeps them in the build.
const SCENES = {
  default: {
    bg: 'from-brand via-brand to-navy-700',
    glows: ['-top-24 left-1/3 w-80 h-56 bg-blue-500/25', '-top-16 -right-10 w-72 h-56 bg-emerald-400/20', '-bottom-24 right-1/4 w-80 h-48 bg-teal-400/20'],
    fx: null,
  },
  clear: {
    bg: 'from-brand via-blue-900 to-sky-800',
    glows: ['-top-20 right-1/4 w-96 h-64 bg-amber-300/30', '-top-10 -right-10 w-72 h-56 bg-yellow-200/20', '-bottom-24 left-1/3 w-80 h-48 bg-sky-400/20'],
    fx: null,
  },
  partly: {
    bg: 'from-brand via-blue-900 to-slate-600',
    glows: ['-top-20 right-1/4 w-80 h-56 bg-amber-200/20', '-top-16 left-1/3 w-96 h-56 bg-slate-300/20', '-bottom-24 right-1/3 w-80 h-48 bg-sky-300/15'],
    fx: null,
  },
  cloudy: {
    bg: 'from-slate-800 via-slate-700 to-slate-600',
    glows: ['-top-24 left-1/4 w-96 h-56 bg-slate-300/20', '-top-16 right-1/4 w-96 h-56 bg-white/10', '-bottom-24 right-10 w-80 h-48 bg-slate-400/20'],
    fx: null,
  },
  fog: {
    bg: 'from-slate-700 via-slate-600 to-slate-500',
    glows: ['top-0 left-0 w-full h-32 bg-white/15', '-bottom-20 left-1/4 w-full h-40 bg-white/10', '-top-16 right-10 w-80 h-48 bg-slate-200/20'],
    fx: null,
  },
  rain: {
    bg: 'from-slate-900 via-slate-800 to-blue-900',
    glows: ['-top-24 left-1/3 w-96 h-56 bg-slate-400/20', '-bottom-24 right-1/4 w-80 h-48 bg-sky-500/20'],
    fx: 'rain',
  },
  storm: {
    bg: 'from-gray-950 via-slate-900 to-indigo-950',
    glows: ['-top-24 left-1/3 w-96 h-56 bg-indigo-400/20', '-bottom-24 right-1/4 w-80 h-48 bg-violet-500/15'],
    fx: 'storm',
  },
  night: {
    bg: 'from-[#050b2e] via-[#0a1440] to-indigo-950',
    glows: ['-top-24 right-1/4 w-80 h-56 bg-indigo-400/20', '-bottom-24 left-1/3 w-80 h-48 bg-sky-500/10'],
    fx: 'stars',
  },
}

/** Pick the hero scene: rain and storms win, then night, then the sky condition. */
export function getScene(weather, hour) {
  const night = weather ? !weather.isDay : (hour < 6 || hour >= 18)
  const c = weather?.condition
  if (c === 'storm' || c === 'rain') return SCENES[c]
  if (night) return SCENES.night
  return SCENES[c] || SCENES.default
}

/** [faIconName, colorClass] for the current weather, or null without data. */
export function weatherIcon(weather) {
  if (!weather) return null
  const day = weather.isDay
  switch (weather.condition) {
    case 'clear':  return day ? ['sun', 'text-amber-300'] : ['moon', 'text-sky-200']
    case 'partly': return day ? ['cloud-sun', 'text-amber-200'] : ['cloud-moon', 'text-sky-200']
    case 'cloudy': return ['cloud', 'text-slate-200']
    case 'fog':    return ['smog', 'text-slate-200']
    case 'rain':   return ['cloud-rain', 'text-sky-300']
    case 'storm':  return ['cloud-bolt', 'text-yellow-300']
    default:       return null
  }
}

// ────────── Effects layer ──────────
export function WeatherFx({ fx }) {
  // Random positions are generated once per mount so drops/stars don't jump on each clock tick.
  const drops = useMemo(() => Array.from({ length: 60 }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 0.5 + Math.random() * 0.5,
    opacity: 0.3 + Math.random() * 0.5,
  })), [])
  const stars = useMemo(() => Array.from({ length: 35 }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 4,
    duration: 2.5 + Math.random() * 3,
  })), [])

  if (fx === 'rain' || fx === 'storm') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {drops.map((d, i) => (
          <span
            key={i}
            className="wx-drop"
            style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s`, opacity: d.opacity }}
          />
        ))}
        {fx === 'storm' && <div className="wx-flash" />}
      </div>
    )
  }
  if (fx === 'stars') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {stars.map((s, i) => (
          <span
            key={i}
            className="wx-star"
            style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }}
          />
        ))}
      </div>
    )
  }
  return null
}
