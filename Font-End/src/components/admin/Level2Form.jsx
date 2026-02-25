import { useState, useEffect } from 'react'
import Spinner from '../ui/Spinner'

export default function Level2Form({ initialData, level1Options, onSubmit, onCancel, loading, lockLevel1 = false }) {
  const [level1Id, setLevel1Id] = useState(initialData?.level1Id || level1Options[0]?.id || '')
  const [name, setName] = useState(initialData?.name || '')
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0)

  useEffect(() => {
    setLevel1Id(initialData?.level1Id || level1Options[0]?.id || '')
    setName(initialData?.name || '')
    setSortOrder(initialData?.sortOrder ?? 0)
  }, [initialData, level1Options])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !level1Id) return
    onSubmit({
      level1Id: parseInt(level1Id, 10),
      name: name.trim(),
      sortOrder: parseInt(sortOrder, 10) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Level 1 Category *</label>
        <select
          className="input-field"
          value={level1Id}
          onChange={e => setLevel1Id(e.target.value)}
          disabled={lockLevel1}
          required
        >
          <option value="">Select…</option>
          {level1Options.map(l1 => (
            <option key={l1.id} value={l1.id}>{l1.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Sub-category Name *</label>
        <input
          type="text"
          className="input-field"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. PC, Printer"
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
        <button type="submit" className="btn-primary" disabled={loading || !name.trim() || !level1Id}>
          {loading ? <Spinner size="sm" /> : null}
          Save
        </button>
      </div>
    </form>
  )
}
