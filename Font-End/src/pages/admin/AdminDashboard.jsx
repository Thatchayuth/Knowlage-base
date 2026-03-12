import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchMenu } from '../../api/services'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/ui/Spinner'

function StatCard({ label, value, icon, color, href }) {
  const Wrapper = href ? Link : 'div'
  return (
    <Wrapper
      to={href}
      className={`panel p-5 flex items-center gap-4 ${href ? 'hover:border-brand/30 transition-colors group' : ''}`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <div className="text-2xl font-display font-bold text-brand-ink tabular-nums">{value}</div>
        <div className="text-xs text-steel-500 font-mono">{label}</div>
      </div>
      {href && (
        <svg className="w-4 h-4 text-steel-600 group-hover:text-steel-400 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </Wrapper>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [menu, setMenu]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMenu()
      .then(data => data.map(l1 => ({
        ...l1,
        level2: (l1.level2 || []).map(l2 => ({
          ...l2,
          isEnabled: l2.isEnabled ?? l2.IsEnabled ?? true,
        })),
      })))
      .then(setMenu)
      .catch(() => setMenu([]))
      .finally(() => setLoading(false))
  }, [])

  const totalL1 = menu.length
  const totalL2 = menu.reduce((a, l1) => a + (l1.level2?.length || 0), 0)
  const totalDocs = menu.reduce((a, l1) => {
    return a +
      (l1.directItems?.length || 0) +
      (l1.level2?.reduce((b, l2) => b + (l2.items?.length || 0), 0) || 0)
  }, 0)
  const disabledL2 = menu.reduce((a, l1) => a + (l1.level2?.filter(l2 => l2.isEnabled === false)?.length || 0), 0)

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-mono text-steel-500 mb-1">Welcome back</p>
        <h1 className="font-display font-bold text-3xl text-brand-ink">
          {user?.username} <span className="text-steel-500 font-normal text-xl">/ dashboard</span>
        </h1>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Level 1 Categories"
            value={totalL1}
            icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            color="bg-blue-500/10 border border-blue-500/25 text-blue-400"
            href="/administrator/level1"
          />
          <StatCard
            label="Level 2 Categories"
            value={totalL2}
            icon="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            color="bg-violet-500/10 border border-violet-500/25 text-violet-400"
            href="/administrator/level2"
          />
          <StatCard
            label="Knowledge Items"
            value={totalDocs}
            icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            color="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
            href="/administrator/knowledge"
          />
          <StatCard
            label="Disabled L2"
            value={disabledL2}
            icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            color="bg-yellow-500/10 border border-yellow-500/25 text-yellow-400"
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <QuickAction
          href="/administrator/level1"
          title="Manage Categories"
          desc="Add or edit Level 1 top-level categories"
          color="text-blue-400"
        />
        <QuickAction
          href="/administrator/level2"
          title="Manage Sub-categories"
          desc="Enable/disable Level 2 categories"
          color="text-violet-400"
        />
        <QuickAction
          href="/administrator/knowledge"
          title="Manage Knowledge"
          desc="Create PDF or PAGE type documents"
          color="text-emerald-400"
        />
      </div>

      {/* Structure preview */}
      {!loading && menu.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-display font-semibold text-brand-ink text-sm">Knowledge Structure</h2>
          </div>
          <div className="divide-y divide-steel-800/60 max-h-80 overflow-y-auto">
            {menu.map(l1 => (
              <div key={l1.id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-3.5 h-3.5 text-accent-500/70" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="font-display font-semibold text-sm text-brand-ink">{l1.name}</span>
                  <span className="ml-auto text-xs text-steel-600 tabular-nums font-mono">
                    {(l1.directItems?.length || 0) + (l1.level2?.reduce((a,l2) => a+(l2.items?.length||0),0)||0)} docs
                  </span>
                </div>
                {l1.level2?.map(l2 => (
                  <div key={l2.id} className="flex items-center gap-2 ml-4 py-0.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l2.isEnabled ? 'bg-emerald-500' : 'bg-red-500/70'}`} />
                    <span className={`text-xs ${l2.isEnabled ? 'text-steel-400' : 'text-steel-600 line-through'}`}>{l2.name}</span>
                    {!l2.isEnabled && <span className="text-xs font-mono text-yellow-600">disabled</span>}
                    <span className="ml-auto text-xs text-steel-600 tabular-nums">{l2.items?.length || 0}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function QuickAction({ href, title, desc, color }) {
  return (
    <Link
      to={href}
      className="panel p-5 hover:border-brand/30 transition-colors group"
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`font-display font-semibold text-sm ${color}`}>{title}</span>
        <svg className="w-4 h-4 text-steel-600 group-hover:text-steel-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-xs text-steel-500 leading-relaxed">{desc}</p>
    </Link>
  )
}

