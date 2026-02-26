import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout'
import { useMenu } from '../hooks/useMenu'
import IconRenderer from '../components/ui/IconRenderer'

export default function HomePage() {
  const { menu, loading } = useMenu()
  const [searchQ, setSearchQ] = useState('')
  const navigate = useNavigate()

  const totalItems = menu.reduce((acc, l1) => {
    const fromL2 = l1.level2?.reduce((a, l2) => a + (l2.items?.length || 0), 0) || 0
    return acc + fromL2 + (l1.directItems?.length || 0)
  }, 0)

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 py-12 animate-fade-in">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/25 text-accent-400 text-xs font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-slow" />
            Internal Knowledge Portal
          </div>
          <h1 className="font-display font-bold text-4xl lg:text-5xl text-slate-100 mb-4 leading-tight">
            Find What You<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-navy-300">
              Need, Instantly
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Centralized internal documentation. Browse categories or search for anything.
          </p>

          {/* Hero search */}
          <form
            className="mt-8 flex gap-3 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault()
              if (searchQ.trim()) navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`)
            }}
          >
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search documentation…"
                className="input-field pl-10 py-3 text-base"
              />
            </div>
            <button type="submit" className="btn-primary px-6 py-3 text-base">
              Search
            </button>
          </form>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="flex items-center gap-6 mb-10 pb-8 border-b border-steel-700/40">
            <Stat label="Categories" value={menu.length} />
            <div className="w-px h-8 bg-steel-700" />
            <Stat label="Sub-categories" value={menu.reduce((a, l1) => a + (l1.level2?.length || 0), 0)} />
            <div className="w-px h-8 bg-steel-700" />
            <Stat label="Documents" value={totalItems} />
          </div>
        )}

        {/* Category cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="panel p-5 space-y-3">
                <div className="skeleton h-5 w-2/5 rounded" />
                <div className="skeleton h-4 w-4/5 rounded" />
                <div className="skeleton h-4 w-3/5 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menu.map(l1 => (
              <CategoryCard key={l1.id} item={l1} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-2xl font-display font-bold text-accent-400 tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 font-mono mt-0.5">{label}</div>
    </div>
  )
}

function CategoryCard({ item }) {
  const allItems = [
    ...(item.directItems || []),
    ...(item.level2?.flatMap(l2 => l2.items || []) || []),
  ]

  return (
    <div className="panel p-5 hover:border-steel-600/80 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-accent-500/10 border border-accent-500/25 flex items-center justify-center flex-shrink-0">
          <IconRenderer icon={item.icon} className="w-4 h-4 text-accent-500" />
        </div>
        <span className="text-xs font-mono text-slate-500 tabular-nums">
          {allItems.length} docs
        </span>
      </div>
      <h3 className="font-display font-semibold text-slate-100 mb-2 group-hover:text-accent-300 transition-colors">
        {item.name}
      </h3>

      {/* Sub-cats preview */}
      <div className="space-y-1">
        {item.level2?.slice(0, 3).map(l2 => (
          <div key={l2.id} className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-1 h-1 rounded-full bg-steel-600 flex-shrink-0" />
            <span className="truncate">{l2.name}</span>
            <span className="ml-auto text-slate-600 tabular-nums">{l2.items?.length || 0}</span>
          </div>
        ))}
        {item.directItems?.slice(0, 2).map(ki => (
          <Link
            key={ki.id}
            to={`/knowledge/${ki.id}`}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-accent-400 transition-colors"
          >
            <span className="w-1 h-1 rounded-full bg-accent-500/40 flex-shrink-0" />
            <span className="truncate">{ki.title}</span>
          </Link>
        ))}
        {item.level2?.length > 3 && (
          <p className="text-xs text-slate-600 pl-3">+{item.level2.length - 3} more categories</p>
        )}
      </div>
    </div>
  )
}
