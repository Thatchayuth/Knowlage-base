import { useState, useEffect, useMemo } from 'react'
import Spinner from '../ui/Spinner'

export default function KnowledgeForm({ initialData, level1List, onSubmit, onCancel, loading }) {
  const [level1Id, setLevel1Id] = useState(initialData?.level1Id || '')
  const [level2Id, setLevel2Id] = useState(initialData?.level2Id || '')
  const [title, setTitle] = useState(initialData?.title || '')
  const [displayMode, setDisplayMode] = useState(initialData?.displayMode || 'PAGE')
  const [contentHtml, setContentHtml] = useState(initialData?.contentHtml || '')
  const [pdfUrl, setPdfUrl] = useState(initialData?.pdfUrl || '')
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl || '')
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0)

  useEffect(() => {
    setLevel1Id(initialData?.level1Id || '')
    setLevel2Id(initialData?.level2Id || '')
    setTitle(initialData?.title || '')
    setDisplayMode(initialData?.displayMode || 'PAGE')
    setContentHtml(initialData?.contentHtml || '')
    setPdfUrl(initialData?.pdfUrl || '')
    setVideoUrl(initialData?.videoUrl || '')
    setSortOrder(initialData?.sortOrder ?? 0)
  }, [initialData])

  const level2Options = useMemo(() => {
    const l1 = level1List.find(l => String(l.id) === String(level1Id))
    return l1?.level2 || []
  }, [level1Id, level1List])

  useEffect(() => {
    if (!level2Options.find(l => String(l.id) === String(level2Id))) {
      setLevel2Id('')
    }
  }, [level2Options, level2Id])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim() || !level1Id) return
    if (displayMode === 'PAGE' && !contentHtml.trim()) return

    onSubmit({
      level1Id: parseInt(level1Id, 10),
      level2Id: level2Id ? parseInt(level2Id, 10) : null,
      title: title.trim(),
      displayMode,
      contentHtml: displayMode === 'PAGE' ? contentHtml : null,
      pdfUrl: pdfUrl.trim() || null,
      videoUrl: videoUrl.trim() || null,
      sortOrder: parseInt(sortOrder, 10) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Level 1 *</label>
          <select className="input-field" value={level1Id} onChange={e => setLevel1Id(e.target.value)} required>
            <option value="">Select…</option>
            {level1List.map(l1 => <option key={l1.id} value={l1.id}>{l1.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Level 2</label>
          <select className="input-field" value={level2Id} onChange={e => setLevel2Id(e.target.value)} disabled={!level2Options.length}>
            <option value="">(none / direct)</option>
            {level2Options.map(l2 => <option key={l2.id} value={l2.id}>{l2.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Title *</label>
        <input
          type="text"
          className="input-field"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Knowledge item title"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Display Mode *</label>
        <div className="flex gap-3">
          {['PAGE', 'PDF'].map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setDisplayMode(mode)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-mono font-semibold border transition-all ${
                displayMode === mode
                  ? mode === 'PDF'
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-steel-800 border-steel-700 text-slate-500 hover:text-slate-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
          PDF URL {displayMode === 'PDF' ? '*' : '(optional)'}
        </label>
        <input
          type="url"
          className="input-field font-mono text-sm"
          value={pdfUrl}
          onChange={e => setPdfUrl(e.target.value)}
          placeholder="http://fileserver.internal/docs/file.pdf"
          required={displayMode === 'PDF'}
        />
        <p className="text-xs text-slate-600 mt-1">Must be on an approved internal domain.</p>
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Video URL (optional)</label>
        <input
          type="url"
          className="input-field font-mono text-sm"
          value={videoUrl}
          onChange={e => setVideoUrl(e.target.value)}
          placeholder="https://youtube.com/embed/... or https://media.local/video.mp4"
        />
        <p className="text-xs text-slate-600 mt-1">Supports direct MP4 links or embeddable URLs (YouTube, etc.).</p>
      </div>

      {displayMode === 'PAGE' && (
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase tracking-wider">HTML Content *</label>
          <textarea
            className="input-field font-mono text-xs leading-relaxed resize-none"
            rows={10}
            value={contentHtml}
            onChange={e => setContentHtml(e.target.value)}
            placeholder="<h2>Title</h2><p>Content…</p>"
            required
          />
          {contentHtml && (
            <details className="mt-2">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors font-mono">
                Preview rendered HTML
              </summary>
              <div
                className="mt-2 p-4 rounded-lg bg-navy-900 border border-steel-700/50 km-content text-sm max-h-48 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            </details>
          )}
        </div>
      )}

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
        <button
          type="submit"
          className="btn-primary"
          disabled={
            loading ||
            !title.trim() ||
            !level1Id ||
            (displayMode === 'PAGE' && !contentHtml.trim())
          }
        >
          {loading ? <Spinner size="sm" /> : null}
          Save
        </button>
      </div>
    </form>
  )
}
