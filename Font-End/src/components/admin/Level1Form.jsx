import { useState, useEffect } from 'react'
import Spinner from '../ui/Spinner'

export default function Level1Form({ initialData, onSubmit, onCancel, loading }) {
  const [name, setName] = useState(initialData?.name || '')
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0)
  const [icon, setIcon] = useState(initialData?.icon || 'fa-regular fa-folder-open')

  useEffect(() => {
    setName(initialData?.name || '')
    setSortOrder(initialData?.sortOrder ?? 0)
    setIcon(initialData?.icon || 'fa-regular fa-folder-open')
  }, [initialData])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      icon: icon.trim() || 'fa-regular fa-folder-open',
      sortOrder: parseInt(sortOrder, 10) || 0,
    })
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
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Font Awesome Icon *</label>
        <input
          type="text"
          className="input-field font-mono text-xs"
          value={icon}
          onChange={e => setIcon(e.target.value)}
          placeholder="fa-brands fa-adn"
          required
        />
        <p className="text-xs text-slate-500 mt-1">Use official Font Awesome class names (e.g. fa-solid fa-book). Leave blank for default folder icon.</p>
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
        <button type="submit" className="btn-primary" disabled={loading || !name.trim() || !icon.trim()}>
          {loading ? <Spinner size="sm" /> : null}
          Save
        </button>
      </div>
    </form>
  )
}
