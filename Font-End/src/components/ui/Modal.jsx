import { useEffect } from 'react'

export default function Modal({ isOpen, onClose, title, children, footer }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass-panel animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/12">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.25em] text-slate-500">CONFIRMATION</p>
              <h2 className="font-display text-lg font-semibold text-slate-100">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-steel-800/60 text-slate-400 hover:text-white hover:bg-steel-700 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="px-6 py-5 text-slate-300">
            {children}
          </div>

          {footer && (
            <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex gap-3 justify-end backdrop-blur-lg">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

