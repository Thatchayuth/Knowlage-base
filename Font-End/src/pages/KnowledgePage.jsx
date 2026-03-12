import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout'
import { fetchKnowledge } from '../api/services'
import Spinner from '../components/ui/Spinner'

function resolveVideoEmbed(url) {
  if (!url) return null
  const trimmed = url.trim()
  const youtubeMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (youtubeMatch) {
    return { type: 'iframe', src: `https://www.youtube.com/embed/${youtubeMatch[1]}` }
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(trimmed)) {
    return { type: 'video', src: trimmed }
  }
  return { type: 'iframe', src: trimmed }
}

export default function KnowledgePage() {
  const { id } = useParams()
  const [item, setItem]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const fetchedIdRef = useRef(null)

  useEffect(() => {
    if (fetchedIdRef.current === id) return
    fetchedIdRef.current = id
    setLoading(true)
    setError(null)
    fetchKnowledge(id)
      .then(setItem)
      .catch(e => setError(e.response?.data?.error || 'Failed to load document'))
      .finally(() => setLoading(false))
  }, [id])

  const videoEmbed = item?.VideoUrl ? resolveVideoEmbed(item.VideoUrl) : null

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Back link */}
        {console.log('Rendering KnowledgePage with item:', item, 'loading:', loading, 'error:', error)}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-steel-500 hover:text-brand transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to home
        </Link>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" />
          </div>
        )}

        {error && (
          <div className="panel p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-400 font-mono text-sm mb-4">{error}</p>
            <Link to="/" className="btn-secondary">Go home</Link>
          </div>
        )}

        {item && !loading && (
          <article className="animate-fade-in">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-mono text-steel-500 mb-6 flex-wrap">
              <Link to="/" className="text-steel-500 hover:text-brand transition-colors">{item.Level1Name}</Link>
              {item.level2Name && (
                <>
                  <span>/</span>
                  <span className="text-steel-400">{item.Level2Name}</span>
                </>
              )}
              <span>/</span>
              <span className="text-brand-ink">{item.Title}</span>
            </div>

            {/* Header */}
            <div className="mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-brand-ink leading-tight flex-1">
          {item.Title}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {(() => {
            const labels = []
            const add = label => { if (!labels.includes(label)) labels.push(label) }
            if (item.DisplayMode) add(item.DisplayMode)
            if (item.PdfUrl) add('PDF')
            if (item.VideoUrl) add('VIDEO')
            const getClass = label => {
              if (label === 'PDF') return 'badge-pdf text-purple-500/20'
              if (label === 'VIDEO') return 'badge-page bg-purple-500/20 text-white border border-purple-400/40'
              return 'badge-page'
            }
            return labels.map(label => (
              <span key={label} className={getClass(label)}>
                {label}
              </span>
            ))
          })()}
        </div>
      </div>
              <div className="flex items-center gap-4 text-xs text-steel-500 font-mono flex-wrap">
                <span>Views: <span className="text-brand">{item.ViewCount?.toLocaleString()}</span></span>
                <span>Updated: <span className="text-brand">{new Date(item.UpdatedAt).toLocaleDateString('th-TH')}</span></span>
              </div>
            </div>

            {/* PDF display mode: embed/link the PDF */}
            {item.DisplayMode === 'PDF' && item.PdfUrl && (
              <div className="panel overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/70">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="font-mono text-sm text-brand">PDF Document</span>
                  </div>
                  <a
                    href={item.PdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs py-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                </div>
                <iframe
                  src={item.PdfUrl}
                  Title={item.Title}
                  className="w-full bg-slate-50"
                  style={{ height: '75vh' }}
                />
              </div>
            )}

            {/* PAGE display mode: render HTML + optional PDF button */}
            {item.DisplayMode === 'PAGE' && (
              <>
                <div className="panel p-6 lg:p-8">
                  <div
                    className="km-content"
                    dangerouslySetInnerHTML={{ __html: item.ContentHtml || '' }}
                  />
                </div>

                {item.PdfUrl && (
                  <div className="mt-6 panel p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-brand-ink">PDF Version Available</div>
                        <div className="text-xs text-steel-500">Download or view the official PDF</div>
                      </div>
                    </div>
                    <a
                      href={item.PdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View PDF
                    </a>
                  </div>
                )}
              </>
            )}

            {/* Video block */}
            {videoEmbed && (
              <div className="panel p-5 mt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-mono text-steel-500 uppercase tracking-[0.25em]">Video</p>
                    <h3 className="text-sm font-semibold text-brand-ink">Related clip</h3>
                  </div>
                   <a
                    href={item.VideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs py-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                  {/* <a href={item.VideoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-300 hover:text-accent-200">Open original</a> */}
                </div>
                {videoEmbed.type === 'iframe' ? (
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={videoEmbed.src}
                      title="Knowledge video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full rounded-xl border border-gray-100"
                    />
                  </div>
                ) : (
                  <video
                    controls
                    src={videoEmbed.src}
                    className="w-full rounded-xl border border-gray-100"
                  />
                )}
              </div>
            )}

            {/* PDF-only mode but no URL */}
            {item.DisplayMode === 'PDF' && !item.PdfUrl && (
              <div className="panel p-8 text-center mt-6">
                <p className="text-steel-500 font-mono text-sm">PDF file not available.</p>
              </div>
            )}
          </article>
        )}
      </div>
    </PublicLayout>
  )
}

