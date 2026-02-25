import { useState, useCallback } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMenu } from '../hooks/useMenu'
import Spinner from '../components/ui/Spinner'

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
  const [expanded, setExpanded] = useState(true)
  const hasL2 = item.level2?.length > 0
  const hasDirectItems = item.directItems?.length > 0

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-display font-semibold text-slate-200 hover:text-accent-400 transition-colors group"
      >
        <span className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-accent-500/70 group-hover:text-accent-500 transition-colors" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
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
        <div className="ml-1 border-l border-steel-700/50 pl-1 ml-4">
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
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100 transition-colors"
      >
        <svg className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">{item.name}</span>
        <span className="ml-auto text-xs text-slate-500 tabular-nums">{item.items?.length || 0}</span>
      </button>

      {expanded && item.items?.length > 0 && (
        <div className="ml-3 border-l border-steel-700/40 pl-1">
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

  return (
    <Link
      to={`/knowledge/${item.id}`}
      className={`nav-item ${isActive ? 'nav-item-active pl-4' : 'nav-item-hover pl-4'}`}
    >
      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-accent-500' : 'bg-steel-600'}`} />
      <span className="truncate text-sm leading-snug">{item.title}</span>
      {item.displayMode === 'PDF' && (
        <span className="ml-auto flex-shrink-0 text-[10px] font-mono text-orange-400/70">PDF</span>
      )}
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
    <div className="min-h-screen bg-navy-950 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-navy-950/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 w-72 flex flex-col bg-steel-900 border-r border-steel-700/50
          transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand */}
        <div className="flex-shrink-0 px-5 py-5 border-b border-steel-700/50">
          <Link to="/" className="group" onClick={() => setSidebarOpen(false)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-500/15 border border-accent-500/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <div className="font-display font-bold text-slate-100 text-sm leading-tight group-hover:text-accent-400 transition-colors">
                  Knowledge Base
                </div>
                <div className="text-xs text-slate-500 font-mono">Internal Portal</div>
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
        <div className="flex-shrink-0 border-t border-steel-700/50 px-4 py-3">
          <Link
            to="/administrator"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-steel-800 transition-colors font-mono"
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
        <div className="lg:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-steel-900 border-b border-steel-700/50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-steel-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display font-bold text-slate-100 text-sm">Knowledge Base</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
