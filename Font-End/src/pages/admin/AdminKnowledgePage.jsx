import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchMenu,
  adminDeleteKnowledge
} from '../../api/services'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import Spinner from '../../components/ui/Spinner'
// ─── Page ─────────────────────────────────────────────────────
export default function AdminKnowledgePage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [level1List, setLevel1List] = useState([])
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]     = useState(false)
  const [filterL1, setFilterL1]     = useState('')
  const [filterMode, setFilterMode] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const menu = await fetchMenu()
      const l1s = menu.map(l1 => ({ ...l1 }))
      setLevel1List(l1s)

      const flat = menu.flatMap(l1 => [
        ...(l1.directItems || []).map(ki => ({
          id: ki.id, title: ki.title, displayMode: ki.displayMode,
          level1Id: l1.id, level1Name: l1.name,
          level2Id: null, level2Name: null,
        })),
        ...(l1.level2 || []).flatMap(l2 =>
          (l2.items || []).map(ki => ({
            id: ki.id, title: ki.title, displayMode: ki.displayMode,
            level1Id: l1.id, level1Name: l1.name,
            level2Id: l2.id, level2Name: l2.name,
          }))
        ),
      ])
      setItems(flat)
    } catch {
      toast({ message: 'Failed to load knowledge items', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const openCreate = () => navigate('/administrator/knowledge/new', { state: { level1List } })

  const openEdit = (item) => navigate(`/administrator/knowledge/${item.id}/edit`, { state: { item } })

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await adminDeleteKnowledge(deleteTarget.id)
      toast({ message: 'Item deleted', type: 'success' })
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast({ message: e.response?.data?.error || 'Delete failed', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const filtered = items.filter(i => {
    if (filterL1 && String(i.level1Id) !== filterL1) return false
    if (filterMode && i.displayMode !== filterMode) return false
    return true
  })

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Knowledge Items</h1>
          <p className="text-slate-500 text-sm mt-1">Manage PDF and PAGE type knowledge documents</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Knowledge Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="input-field max-w-xs" value={filterL1} onChange={e => setFilterL1(e.target.value)}>
          <option value="">All Categories</option>
          {level1List.map(l1 => <option key={l1.id} value={l1.id}>{l1.name}</option>)}
        </select>
        <select className="input-field w-36" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
          <option value="">All Modes</option>
          <option value="PAGE">PAGE</option>
          <option value="PDF">PDF</option>
        </select>
        <span className="text-xs text-slate-500 font-mono">{filtered.length} items</span>
      </div>

      <div className="panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-sm">No knowledge items found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-steel-700/50">
                <th className="text-left px-5 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Mode</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-800/60">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-steel-800/30 transition-colors group">
                  <td className="px-5 py-3">
                    <a
                      href={`/knowledge/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-slate-200 hover:text-accent-300 transition-colors truncate block max-w-sm"
                    >
                      {item.title}
                    </a>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400">{item.level1Name}</span>
                      {item.level2Name && (
                        <span className="text-xs text-slate-600">{item.level2Name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={item.displayMode === 'PDF' ? 'badge-pdf' : 'badge-page'}>
                      {item.displayMode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button className="btn-ghost py-1 px-2 text-xs" onClick={() => openEdit(item)}>Edit</button>
                      <button className="btn-ghost py-1 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => setDeleteTarget(item)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit/Create Modal */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Knowledge Item"
        message={`Delete "${deleteTarget?.title}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  )
}
