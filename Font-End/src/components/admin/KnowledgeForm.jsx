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
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadFileError, setUploadFileError] = useState('')
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0)
  const [highlight, setHighlight] = useState(initialData?.highlight || false)

  useEffect(() => {
    setLevel1Id(initialData?.level1Id || '')
    setLevel2Id(initialData?.level2Id || '')
    setTitle(initialData?.title || '')
    setDisplayMode(initialData?.displayMode || 'PAGE')
    setContentHtml(initialData?.contentHtml || '')
    setPdfUrl(initialData?.pdfUrl || '')
    setVideoUrl(initialData?.videoUrl || '')
    setUploadFile(null)
    setUploadFileError('')
    setSortOrder(initialData?.sortOrder ?? 0)
    setHighlight(Boolean(initialData?.highlight))
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
    if (uploadFileError) return

    onSubmit({
      level1Id: parseInt(level1Id, 10),
      level2Id: level2Id ? parseInt(level2Id, 10) : null,
      title: title.trim(),
      displayMode,
      contentHtml: displayMode === 'PAGE' ? contentHtml : null,
      pdfUrl: pdfUrl.trim() || null,
      videoUrl: videoUrl.trim() || null,
      uploadFile,
      highlight,
      sortOrder: parseInt(sortOrder, 10) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">Level 1 *</label>
          <select className="input-field" value={level1Id} onChange={e => setLevel1Id(e.target.value)} required>
            <option value="">Select…</option>
            {level1List.map(l1 => <option key={l1.id} value={l1.id}>{l1.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">Level 2</label>
          <select className="input-field" value={level2Id} onChange={e => setLevel2Id(e.target.value)} disabled={!level2Options.length}>
            <option value="">(none / direct)</option>
            {level2Options.map(l2 => <option key={l2.id} value={l2.id}>{l2.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-mono text-steel-400">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={highlight}
            onChange={e => setHighlight(e.target.checked)}
          />
          Highlight this item (show on homepage)
        </label>
      </div>

      <div>
        <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">Title *</label>
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
        <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">Display Mode *</label>
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
                  : 'bg-steel-800 border-white/15 text-steel-500 hover:text-steel-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">Upload Files</label>
        <input
          type="file"
          name="uploadFile"
          className="input-field"
          onChange={e => {
            const file = e.target.files?.[0] || null
            setUploadFile(file)
            if (file) {
              const ext = file.name.split('.').pop().toLowerCase()
              if (ext !== 'pdf' && ext !== 'mp4') {
                setUploadFileError(`ไฟล์ "${file.name}" ไม่รองรับ — รองรับเฉพาะ .pdf และ .mp4 เท่านั้น`)
              } else {
                setUploadFileError('')
              }
            } else {
              setUploadFileError('')
            }
          }}
        />
        {uploadFileError && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {uploadFileError}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">
          PDF URL {displayMode === 'PDF' && !uploadFile ? '*' : '(optional)'}
        </label>
        <input
          type="url"
          className="input-field font-mono text-sm"
          value={pdfUrl}
          onChange={e => setPdfUrl(e.target.value)}
          placeholder="http://fileserver.internal/docs/file.pdf"
          required={displayMode === 'PDF' && !uploadFile}
        />
        <p className="text-xs text-steel-600 mt-1">Must be on an approved internal domain.</p>
      </div>

      <div>
        <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">Video URL (optional)</label>
        <input
          type="url"
          className="input-field font-mono text-sm"
          value={videoUrl}
          onChange={e => setVideoUrl(e.target.value)}
          placeholder="https://youtube.com/embed/... or https://media.local/video.mp4"
        />
        <p className="text-xs text-steel-600 mt-1">Supports direct MP4 links or embeddable URLs (YouTube, etc.).</p>
      </div>

      {displayMode === 'PAGE' && (
        <div>
          <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">HTML Content *</label>
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
              <summary className="text-xs text-steel-500 cursor-pointer hover:text-steel-300 transition-colors font-mono">
                Preview rendered HTML
              </summary>
              <div
                className="mt-2 p-4 rounded-lg bg-white/5 border border-white/10 km-content text-sm max-h-48 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            </details>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">Sort Order</label>
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
            (displayMode === 'PAGE' && !contentHtml.trim()) ||
            !!uploadFileError
          }
        >
          {loading ? <Spinner size="sm" /> : null}
          Save
        </button>
      </div>
    </form>
  )
}

