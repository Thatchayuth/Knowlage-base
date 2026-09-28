import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const ToastContext = createContext(null)

const TOAST_STYLE = {
  success: { icon: 'circle-check',         chip: 'bg-emerald-50 text-emerald-600', bar: '#10b981' },
  error:   { icon: 'circle-exclamation',   chip: 'bg-red-50 text-red-600',         bar: '#dc2626' },
  warning: { icon: 'triangle-exclamation', chip: 'bg-amber-50 text-amber-600',     bar: '#f59e0b' },
  info:    { icon: 'circle-info',          chip: 'bg-brand-soft text-brand',       bar: '#0a1855' },
}

function normalizeToastInput(input, legacyType = 'info', legacyDuration = 3000) {
  if (typeof input === 'string') {
    return {
      message: input,
      type: legacyType || 'info',
      duration: typeof legacyDuration === 'number' ? legacyDuration : 3000,
    }
  }

  return {
    message: input?.message,
    type: input?.type || 'info',
    duration: typeof input?.duration === 'number' ? input.duration : 3000,
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timeoutMap = useRef(new Map())

  useEffect(() => () => {
    timeoutMap.current.forEach(clearTimeout)
    timeoutMap.current.clear()
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timeoutId = timeoutMap.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutMap.current.delete(id)
    }
  }, [])

  const toast = useCallback((input, legacyType, legacyDuration) => {
    const { message, type, duration } = normalizeToastInput(input, legacyType, legacyDuration)
    if (!message) return null

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts(prev => [...prev, { id, message, type }])

    if (duration !== 0 && duration !== null) {
      const timeoutId = setTimeout(() => removeToast(id), duration)
      timeoutMap.current.set(id, timeoutId)
    }

    return id
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
      {/* Above modals (z-9000) so errors raised inside a dialog stay visible */}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[9500] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map(item => {
          const s = TOAST_STYLE[item.type] || TOAST_STYLE.info
          return (
            <div
              key={item.id}
              role={item.type === 'error' ? 'alert' : 'status'}
              className="modal-panel-in pointer-events-auto w-full sm:w-[380px] flex items-start gap-3 p-4 rounded-2xl bg-white border border-slate-200"
              style={{ boxShadow: `inset 4px 0 0 ${s.bar}, 0 12px 32px -10px rgba(10,24,85,0.35)` }}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${s.chip}`}>
                <FontAwesomeIcon icon={['fas', s.icon]} />
              </span>
              <span className="flex-1 text-base text-slate-700 leading-snug pt-1">{item.message}</span>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="ปิด"
              >
                <FontAwesomeIcon icon={['fas', 'xmark']} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
