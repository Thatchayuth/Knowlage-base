import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/**
 * Admin page header: optional back link, icon chip, title, subtitle and
 * right-aligned actions. Every admin page uses this so they line up.
 */
export default function PageHeader({ icon, title, subtitle, actions, back }) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-2 h-10 px-4 mb-4 rounded-full bg-white/80 border border-slate-200 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white hover:text-brand transition-colors"
        >
          <FontAwesomeIcon icon={['fas', 'arrow-left']} className="w-3.5" />
          {back.label || 'ย้อนกลับ'}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {icon && (
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl text-white bg-gradient-to-br from-brand to-navy-600 shadow-[0_8px_20px_-8px_rgba(10,24,85,0.6)]">
              <FontAwesomeIcon icon={['fas', icon]} />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl lg:text-[28px] text-slate-800 leading-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-base text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </div>
    </div>
  )
}
