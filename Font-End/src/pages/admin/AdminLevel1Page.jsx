import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMenu, adminDeleteLevel1 } from '../../api/services'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import Spinner from '../../components/ui/Spinner'

export default function AdminLevel1Page() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const menu = await fetchMenu()
      setItems(menu.map(l1 => ({
        id:        l1.id,
        name:      l1.name,
        sortOrder: l1.sortOrder,
        l2Count:   l1.level2?.length || 0,
        docCount:  (l1.directItems?.length || 0) + (l1.level2?.reduce((a,l) => a+(l.items?.length||0),0)||0),
      })))
    } catch (e) {
      toast({ message: 'Failed to load categories', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const openCreate = () => navigate('/administrator/level1/new')
  const openEdit   = (item) => navigate(`/administrator/level1/${item.id}/edit`, { state: { item } })

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await adminDeleteLevel1(deleteTarget.id)
      toast({ message: 'Category deleted', type: 'success' })
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast({ message: e.response?.data?.error || 'Delete failed', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-slate-100">Level 1 Categories</h1>
          <p className="text-slate-500 text-sm mt-1">Top-level knowledge categories</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Category
        </button>
      </div>

      <div className="panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-sm">No categories yet.</p>
            <button className="btn-primary mt-4" onClick={openCreate}>Create first category</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-steel-700/50">
                <th className="text-left px-5 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Sort</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Sub-cats</th>
                <th className="text-center px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wider">Docs</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-steel-800/60">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-steel-800/30 transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-accent-500/70" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                        </svg>
                      </div>
                      <span className="font-medium text-slate-200">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-mono text-slate-500">{item.sortOrder}</td>
                  <td className="px-4 py-3 text-center text-xs tabular-nums text-slate-400">{item.l2Count}</td>
                  <td className="px-4 py-3 text-center text-xs tabular-nums text-slate-400">{item.docCount}</td>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Delete "${deleteTarget?.name}"? This action cannot be undone.`}
        loading={deleting}
      />
    </div>
  )
}
