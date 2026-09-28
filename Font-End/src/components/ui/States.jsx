import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/** Skeleton rows while a list loads. */
export function LoadingState({ rows = 4, className = '' }) {
  return (
    <div className={`admin-card p-5 space-y-3 ${className}`} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 rounded" style={{ width: `${60 - (i % 3) * 12}%` }} />
            <div className="skeleton h-3 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Nothing to show yet — optional call to action. */
export function EmptyState({ icon = 'box-open', title, message, action, className = '' }) {
  return (
    <div className={`admin-card px-6 py-14 text-center ${className}`}>
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl">
        <FontAwesomeIcon icon={['fas', icon]} />
      </div>
      <h3 className="font-display font-bold text-lg text-slate-700">{title}</h3>
      {message && <p className="mt-1 text-base text-slate-500 max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/** Load failure with a retry button. */
export function ErrorState({ message, onRetry, className = '' }) {
  return (
    <div className={`admin-card px-6 py-12 text-center ${className}`} role="alert">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center text-2xl">
        <FontAwesomeIcon icon={['fas', 'triangle-exclamation']} />
      </div>
      <h3 className="font-display font-bold text-lg text-slate-700">โหลดข้อมูลไม่สำเร็จ</h3>
      {message && <p className="mt-1 text-base text-red-600 max-w-md mx-auto">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-primary mt-5">
          <FontAwesomeIcon icon={['fas', 'rotate-right']} /> ลองอีกครั้ง
        </button>
      )}
    </div>
  )
}

/** Pull a readable message out of an axios error (backend sends `error`, some routes `message`). */
export function apiError(err, fallback = 'เกิดข้อผิดพลาด') {
  const d = err?.response?.data
  return d?.error || d?.message || d?.errors?.[0]?.msg || err?.message || fallback
}
