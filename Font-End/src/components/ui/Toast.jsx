import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const ToastContext = createContext(null)

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
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(item => (
          <div
            key={item.id}
            className={`p-4 rounded-lg text-white pointer-events-auto shadow-lg flex items-start gap-3 ${
              item.type === 'error' ? 'bg-red-500' :
              item.type === 'success' ? 'bg-green-500' :
              item.type === 'warning' ? 'bg-yellow-500 text-slate-900' :
              'bg-blue-500'
            }`}
          >
            <span className="flex-1 text-sm">{item.message}</span>
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="text-white/70 hover:text-white transition-colors"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
