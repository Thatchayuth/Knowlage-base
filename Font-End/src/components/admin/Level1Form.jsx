import { useState, useEffect } from 'react'
import Spinner from '../ui/Spinner'

export default function Level1Form({ initialData, onSubmit, onCancel, loading }) {
  const [name, setName] = useState(initialData?.name || '')
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0)

  useEffect(() => {
    setName(initialData?.name || '')
    setSortOrder(initialData?.sortOrder ?? 0)
  }, [initialData])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), sortOrder: parseInt(sortOrder, 10) || 0 })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Category Name *</label>
        <input
          type="text"
          className="input-field"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. IT Support"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Sort Order</label>
        <input
          type="number"
          className="input-field"
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
          min={0}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
          {loading ? <Spinner size="sm" /> : null}
          Save
        </button>
      </div>
    </form>
  )
}
