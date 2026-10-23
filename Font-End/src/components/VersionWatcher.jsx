import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const CHECK_INTERVAL_MS = 60 * 1000

async function fetchDeployedVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data?.version ?? null
  } catch {
    // Offline, or version.json missing (SPA fallback returns index.html) — skip this round
    return null
  }
}

/**
 * Polls /version.json and moves the user onto a newer build once one is deployed.
 * The reload never happens under the user's hands: it waits for the next route
 * change or for the tab to be hidden, and meanwhile a banner lets the user reload
 * right away. Admin pages never reload while hidden, because they hold unsaved
 * forms and long-running syncs.
 */
export default function VersionWatcher() {
  const location = useLocation()
  const updateReady = useRef(false)
  const isFirstRender = useRef(true)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    const check = async () => {
      if (updateReady.current) return
      const deployed = await fetchDeployedVersion()
      if (deployed && deployed !== __APP_VERSION__) {
        updateReady.current = true
        setShowBanner(true)
        reloadIfHiddenAndSafe()
      }
    }

    const reloadIfHiddenAndSafe = () => {
      if (
        updateReady.current &&
        document.visibilityState === 'hidden' &&
        !window.location.pathname.startsWith('/administrator')
      ) {
        window.location.reload()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check()
      else reloadIfHiddenAndSafe()
    }

    check()
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // New build detected: load it on the next navigation instead of client-side routing
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (updateReady.current) window.location.reload()
  }, [location.pathname])

  if (!showBanner) return null

  // Sits above toasts (z-9500) so it stays reachable while they stack up
  return (
    <div className="fixed top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[9600] pointer-events-none">
      <div
        role="status"
        className="modal-panel-in pointer-events-auto flex flex-wrap items-center gap-3 p-3 pl-4 rounded-2xl bg-white border border-slate-200 sm:w-max"
        style={{ boxShadow: 'inset 4px 0 0 #0a1855, 0 12px 32px -10px rgba(10,24,85,0.35)' }}
      >
        <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-soft text-brand">
          <FontAwesomeIcon icon={['fas', 'rotate']} />
        </span>
        <span className="flex-1 text-base text-slate-700">A new version is available.</span>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => setShowBanner(false)}>
            Later
          </button>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    </div>
  )
}
