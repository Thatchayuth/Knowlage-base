import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMenu } from '../hooks/useMenu'
import Spinner from '../components/ui/Spinner'
import IconRenderer from '../components/ui/IconRenderer'
import LogoNCR from '../img/NCR-logo-web.png'

function MenuSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1,2,3].map(i => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-5 w-4/5 rounded" />
          {[1,2].map(j => (
            <div key={j} className="ml-4 skeleton h-4 w-3/5 rounded" />
          ))}
        </div>
      ))}
    </div>
  )
}

function MenuLevel1({ item, activeId }) {
  const hasActive = useMemo(() => {
    if (!activeId) return false
    if (item.directItems?.some(di => String(di.id) === String(activeId))) return true
    return item.level2?.some(l2 => l2.items?.some(ki => String(ki.id) === String(activeId))) || false
  }, [item, activeId])

  const [expanded, setExpanded] = useState(() => hasActive)

  useEffect(() => {
    if (hasActive) setExpanded(true)
  }, [hasActive])
  const hasL2 = item.level2?.length > 0
  const hasDirectItems = item.directItems?.length > 0

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-display font-semibold text-slate-200 hover:text-accent-400 transition-colors group"
      >
        <span className="flex items-center gap-2">
          <IconRenderer icon={item.icon} className="w-4 h-4 text-accent-500/80 group-hover:text-accent-400 transition-colors" />
          {item.name}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="ml-1 border-l border-white/10 pl-1 ml-4">
          {hasL2 && item.level2.map(l2 => (
            <MenuLevel2 key={l2.id} item={l2} activeId={activeId} />
          ))}
          {/* Direct items (from disabled Level2) */}
          {hasDirectItems && item.directItems.map(ki => (
            <MenuKnowledgeItem key={ki.id} item={ki} activeId={activeId} indent={0} />
          ))}
        </div>
      )}
    </div>
  )
}

function MenuLevel2({ item, activeId }) {
  const hasActive = useMemo(() => {
    if (!activeId) return false
    return item.items?.some(ki => String(ki.id) === String(activeId)) || false
  }, [item, activeId])

  const [expanded, setExpanded] = useState(() => hasActive)

  useEffect(() => {
    if (hasActive) setExpanded(true)
  }, [hasActive])

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100 transition-colors"
      >
        <IconRenderer icon={item.icon} className="w-3.5 h-3.5 text-slate-500" />
        <span className="font-medium">{item.name}</span>
        <span className="ml-auto text-xs text-slate-500 tabular-nums">{item.items?.length || 0}</span>
        <svg className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && item.items?.length > 0 && (
        <div className="ml-3 border-l border-white/10 pl-1">
          {item.items.map(ki => (
            <MenuKnowledgeItem key={ki.id} item={ki} activeId={activeId} />
          ))}
        </div>
      )}
    </div>
  )
}

function MenuKnowledgeItem({ item, activeId }) {
  const isActive = String(activeId) === String(item.id)
  const badges = []
  if (item.displayMode) badges.push(item.displayMode === 'PDF' ? 'Files' : 'Page')
  if (item.PdfUrl || item.pdfUrl) badges.push('PDF')
  if (item.VideoUrl || item.videoUrl) badges.push('VIDEO')
  const uniqueBadges = [...new Set(badges)]

  return (
    <Link
      to={`/knowledge/${item.id}`}
      className={`nav-item ${isActive ? 'nav-item-active pl-4' : 'nav-item-hover pl-4'}`}
    >
      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-accent-500' : 'bg-steel-600'}`} />
      <span className="truncate text-sm leading-snug flex-1">{item.title}</span>
      <span className="flex items-center gap-1 text-[10px] font-mono">
        {uniqueBadges.map(badge => (
          <span
            key={badge}
            className={badge === 'Files' ? 'text-orange-400/80' : badge === 'Page' ? 'text-purple-300' : 'text-slate-500'}
          >
            {badge}
          </span>
        ))}
      </span>
    </Link>
  )
}

export default function PublicLayout({ children }) {
  const { menu, loading, error } = useMenu()
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const [searchQ, setSearchQ] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSearch = useCallback((e) => {
    e.preventDefault()
    if (searchQ.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`)
      setSidebarOpen(false)
    }
  }, [searchQ, navigate])

  return (
    <div className="min-h-screen app-shell flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 app-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 w-72 flex flex-col glass-panel border border-white/10
          transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand */}
        <div className="flex-shrink-0 px-5 py-5 border-b border-white/10">
          <Link to="/" className="group" onClick={() => setSidebarOpen(false)}>
            <div className="flex flex-col items-center gap-3 text-center">
              <img
                src={LogoNCR}
                alt="NCR Knowledge Base"
                className="mx-auto h-12 w-auto brightness-0 invert"
              />
              
              <div className="leading-tight">
                <div className="font-display font-bold text-slate-100 text-base tracking-wide group-hover:text-accent-300 transition-colors">
                  I-FAQ Knowledge Base
                </div>
                <div className="text-[11px] uppercase tracking-[0.38em] text-slate-500 font-mono">Internal Portal</div>
              </div>
            </div>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-4">
            <div className="relative">
              <input
                type="search"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search knowledge…"
                className="input-field pr-9 text-sm py-2"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-accent-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* Menu tree */}
        <div className="flex-1 overflow-y-auto py-3">
          {loading && <MenuSkeleton />}
          {error && (
            <div className="p-4 text-sm text-red-400 font-mono">{error}</div>
          )}
          {!loading && !error && menu.map(item => (
            <MenuLevel1 key={item.id} item={item} activeId={id} />
          ))}
          {!loading && !error && menu.length === 0 && (
            <p className="p-4 text-sm text-slate-500">No categories found.</p>
          )}
        </div>

        {/* Footer links */}
        <div className="flex-shrink-0 border-t border-white/10 px-4 py-3">
          <Link
            to="/administrator"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors font-mono"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Administrator
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72">
        {/* Mobile top bar */}
        <div className="lg:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 backdrop-blur-lg">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-100 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <img src={LogoNCR} alt="NCR Knowledge Base" className="h-7 w-auto brightness-0 invert" />
            <div className="leading-tight">
              <p className="font-display font-semibold text-slate-100 text-sm">I-FAQ Knowledge Base</p>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Internal Portal</p>
            </div>
          </div>
        </div>


        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}


