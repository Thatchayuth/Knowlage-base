import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchMenu, adminDeleteLevel2, adminToggleLevel2
} from '../../api/services'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import Spinner from '../../components/ui/Spinner'

export default function AdminLevel2Page() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [level1List, setLevel1List]   = useState([])
  const [items, setItems]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [toggling, setToggling]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [filterL1, setFilterL1] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const menu = await fetchMenu()
      const normalized = menu.map(l1 => ({
        ...l1,
        level2: (l1.level2 || []).map(l2 => ({
          ...l2,
          isEnabled: l2.isEnabled ?? l2.IsEnabled ?? true,
        })),
      }))

      setLevel1List(normalized.map(l1 => ({ id: l1.id, name: l1.name })))
      const flat = normalized.flatMap(l1 =>
        (l1.level2 || []).map(l2 => ({
          id:        l2.id,
          name:      l2.name,
          icon:      l2.icon,
          level1Id:  l1.id,
          level1Name: l1.name,
          isEnabled: l2.isEnabled,
          sortOrder: l2.sortOrder,
          docCount:  l2.items?.length || 0,
        }))
      )
      setItems(flat)
    } catch {
      toast({ message: 'Failed to load', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleToggle = async (item) => {
    setToggling(item.id)
    try {
      const updated = await adminToggleLevel2(item.id)
      const nextEnabled = typeof updated?.IsEnabled === 'boolean'
        ? updated.IsEnabled
        : !item.isEnabled
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isEnabled: nextEnabled } : i))
      toast({ message: `"${item.name}" ${nextEnabled ? 'enabled' : 'disabled'}`, type: 'success' })
    } catch (e) {
      toast({ message: e.response?.data?.error || 'Toggle failed', type: 'error' })
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await adminDeleteLevel2(deleteTarget.id)
      toast({ message: 'Sub-category deleted', type: 'success' })
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast({ message: e.response?.data?.error || 'Delete failed', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const filtered = filterL1 ? items.filter(i => String(i.level1Id) === filterL1) : items

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Level 2 Sub-categories</h1>
          <p className="text-slate-500 text-sm mt-1">Enable or disable sub-categories to control navigation</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/administrator/level2/new')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Sub-category
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          className="input-field max-w-xs"
          value={filterL1}
          onChange={e => setFilterL1(e.target.value)}
        >
          <option value="">All Level 1 Categories</option>
          {level1List.map(l1 => (
            <option key={l1.id} value={l1.id}>{l1.name}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500 font-mono">{filtered.length} items</span>
      </div>

      <div className="panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-sm">No sub-categories found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-steel-700/50">
                <th className="text-left px-5 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Parent</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Sort</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Docs</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-800/60">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-steel-800/30 transition-colors group">
                  <td className="px-5 py-3">
                    <span className={`font-medium ${item.isEnabled ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                      {item.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{item.level1Name}</td>
                  <td className="px-4 py-3 text-center text-xs font-mono text-slate-500">{item.sortOrder}</td>
                  <td className="px-4 py-3 text-center text-xs tabular-nums text-slate-400">{item.docCount}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(item)}
                      disabled={toggling === item.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold transition-all ${
                        item.isEnabled
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                      }`}
                    >
                      {toggling === item.id ? <Spinner size="sm" className="w-3 h-3" /> : (
                        <span className={`w-1.5 h-1.5 rounded-full ${item.isEnabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      )}
                      {item.isEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        className="btn-ghost py-1 px-2 text-xs"
                        onClick={() => navigate(`/administrator/level2/${item.id}/edit`, { state: { item } })}
                      >
                        Edit
                      </button>
                      <button className="btn-ghost py-1 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => setDeleteTarget(item)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Sub-category"
        message={`Delete "${deleteTarget?.name}"? All knowledge items under it will become orphaned.`}
        loading={deleting}
      />
    </div>
  )
}
