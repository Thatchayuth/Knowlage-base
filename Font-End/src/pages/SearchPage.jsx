import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout'
import { searchKnowledge } from '../api/services'
import { searchPortalFiles } from '../services/portal.service'
import Spinner from '../components/ui/Spinner'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const q              = searchParams.get('q') || ''
  const [inputQ, setInputQ] = useState(q)

  const [faqResults,  setFaqResults]  = useState(null)
  const [fileResults, setFileResults] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  const abortRef = useRef(null)

  const doSearch = useCallback(async (query) => {
    if (!query.trim()) return
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)
    try {
      // Run FAQ search and portal file search in parallel
      const [faqRes, fileRes] = await Promise.allSettled([
        searchKnowledge(query),
        searchPortalFiles(query),
      ])
      if (ctrl.signal.aborted) return
      setFaqResults(faqRes.status === 'fulfilled' ? faqRes.value : null)
      // File search 401 = user not logged in → silently show nothing
      setFileResults(fileRes.status === 'fulfilled' ? fileRes.value : [])
      if (faqRes.status === 'rejected') setError(faqRes.reason?.response?.data?.error || 'Search failed')
    } finally {
      if (!ctrl.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    setInputQ(q)
    if (q) doSearch(q)
    else { setFaqResults(null); setFileResults(null) }
  }, [q, doSearch])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputQ.trim()) navigate(`/search?q=${encodeURIComponent(inputQ.trim())}`)
  }

  const maxRank = faqResults?.results?.reduce((m, r) => Math.max(m, r.rank || 0), 1) || 1
  const hasAnyResults = (faqResults?.results?.length > 0) || (fileResults?.length > 0)

  // Format bytes
  const fmtSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-steel-500 hover:text-brand transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to home
        </Link>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              type="search"
              value={inputQ}
              onChange={e => setInputQ(e.target.value)}
              placeholder="Search knowledge base…"
              className="input-field pl-12 py-3 text-base pr-28"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary py-1.5 text-sm"
            >
              Search
            </button>
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="panel p-6 border-red-500/20 mb-4">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}

        {/* No results */}
        {q && !loading && !hasAnyResults && !error && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="font-display font-semibold text-steel-400/90 mb-2">No results found</h3>
            <p className="text-steel-500 text-sm">Try different keywords or browse the menu on the left.</p>
          </div>
        )}

        {/* ── FAQ RESULTS ── */}
        {!loading && faqResults?.results?.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100/70">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-steel-500">I-FAQ</span>
                <span className="text-sm text-brand-ink font-semibold">{faqResults.totalResults} รายการ</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-steel-500">
                {faqResults.usedFullText ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">FTS</span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">LIKE</span>
                )}
              </div>
            </div>
            <div className="space-y-3 animate-fade-in">
              {faqResults.results.map((item, i) => (
                <Link
                  key={item.id}
                  to={`/knowledge/${item.id}`}
                  className="block panel p-5 hover:border-brand/30 hover:bg-brand-soft/70 transition-all duration-200 group hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-mono text-steel-500 tabular-nums">#{i + 1}</span>
                        <span className={item.displayMode === 'PDF' ? 'badge-pdf' : 'badge-page'}>
                          {item.displayMode}
                        </span>
                      </div>
                      <h3 className="font-display font-semibold transition-colors mb-2 leading-snug text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-navy-300">
                        {item.title}
                      </h3>
                      {item.snippet && (
                        <p className="text-sm text-steel-500/90 line-clamp-2 leading-relaxed">
                          {item.snippet}
                        </p>
                      )}
                    </div>
                    {item.rank > 0 && (
                      <div className="flex-shrink-0 flex flex-col items-end gap-1 min-w-[60px]">
                        <span className="text-xs font-mono text-steel-500">rank</span>
                        <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-500 rounded-full transition-all"
                            style={{ width: `${Math.round((item.rank / maxRank) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-accent-500/80 tabular-nums">{item.rank}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                    <svg className="w-3.5 h-3.5 text-steel-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-steel-500 font-mono">
                      {new Date(item.updatedAt).toLocaleDateString('th-TH')}
                    </span>
                    <span className="ml-auto text-xs text-accent-500/60 group-hover:text-accent-400 transition-colors font-mono">
                      View →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── PORTAL FILE RESULTS ── */}
        {!loading && fileResults?.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100/70">
              <span className="text-xs font-semibold uppercase tracking-wider text-steel-500">ไฟล์ในระบบ Portal</span>
              <span className="text-sm text-brand-ink font-semibold">{fileResults.length} ไฟล์</span>
            </div>
            <div className="space-y-2 animate-fade-in">
              {fileResults.map(file => (
                <Link
                  key={file.Id}
                  to={`/portal/file/${file.Id}`}
                  state={{ file }}
                  className="flex items-center gap-3 panel px-4 py-3 hover:border-brand/30 hover:bg-brand-soft/70 transition-all duration-200 group"
                >
                  {/* File icon */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100/60 flex items-center justify-center text-steel-400">
                    {file.FileExtension === '.pdf' ? (
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-ink group-hover:text-brand transition-colors truncate">
                      {file.FileName}
                    </p>
                    <p className="text-xs text-steel-500 truncate mt-0.5">
                      📁 {file.FolderName}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1 text-right">
                    {file.FileSize > 0 && (
                      <span className="text-xs font-mono text-steel-500">{fmtSize(file.FileSize)}</span>
                    )}
                    {file.LastModified && (
                      <span className="text-xs font-mono text-steel-500/60">
                        {new Date(file.LastModified).toLocaleDateString('th-TH')}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Initial empty state */}
        {!q && !loading && (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-steel-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-steel-500">Enter a search term to get started</p>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}

