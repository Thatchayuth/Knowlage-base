import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const EXIT_MS = 200

/**
 * White card dialog with enter/exit animation (modal-* classes in index.css).
 * Esc and a backdrop click close it unless `busy` is true.
 */
export default function Modal({ isOpen, onClose, title, subtitle, icon, children, footer, size = 'md', busy = false }) {
  // Keep mounted while the exit animation plays.
  const [mounted, setMounted] = useState(isOpen)
  const [closing, setClosing] = useState(false)
  const closeRef = useRef(onClose)
  closeRef.current = busy ? null : onClose

  useEffect(() => {
    if (isOpen) { setMounted(true); setClosing(false); return }
    if (!mounted) return
    setClosing(true)
    const t = setTimeout(() => { setMounted(false); setClosing(false) }, EXIT_MS)
    return () => clearTimeout(t)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mounted])

  if (!mounted) return null

  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size] || 'max-w-lg'

  return createPortal(
    <div
      className={`fixed inset-0 z-[9000] flex items-center justify-center p-4 ${closing ? 'modal-backdrop-out' : 'modal-backdrop-in'}`}
      style={{ backgroundColor: 'rgba(3, 11, 43, 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={() => closeRef.current?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${width} max-h-[90vh] flex flex-col bg-white rounded-[24px] shadow-2xl overflow-hidden ${closing ? 'modal-panel-out' : 'modal-panel-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 py-5 border-b border-slate-100">
          {icon}
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl font-bold text-slate-800 leading-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => closeRef.current?.()}
            disabled={busy}
            className="btn-icon -mr-2 -mt-1"
            aria-label="ปิด"
          >
            <FontAwesomeIcon icon={['fas', 'xmark']} className="text-lg" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto text-slate-700">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-wrap gap-3 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
