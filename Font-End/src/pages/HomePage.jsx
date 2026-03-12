import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout'
import { fetchFeaturedKnowledge } from '../services/services'

export default function HomePage() {
  const [featured, setFeatured] = useState([])
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [featuredError, setFeaturedError] = useState(null)
  const [searchQ, setSearchQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    setFeaturedLoading(true)
    fetchFeaturedKnowledge()
      .then(data => { setFeatured(data || []) ; setFeaturedError(null) })
      .catch(() => setFeaturedError('Failed to load featured items'))
      .finally(() => setFeaturedLoading(false))
  }, [])

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 py-12 animate-fade-in">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/25 text-accent-400 text-xs font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse-slow" />
            Internal Knowledge Portal
          </div>
          <h1 className="font-display font-bold text-4xl lg:text-5xl text-brand-ink mb-4 leading-tight">
            Find What You<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-navy-300">
              Need, Instantly
            </span>
          </h1>
          <p className="text-steel-500 text-lg max-w-xl">
            Centralized internal documentation. Browse categories or search for anything.
          </p>

          {/* Hero search */}
          <form
            className="mt-8 flex gap-3 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault()
              if (searchQ.trim()) navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`)
            }}
          >
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search documentation…"
                className="input-field pl-10 py-3 text-base"
              />
            </div>
            <button type="submit" className="btn-primary px-6 py-3 text-base">
              Search
            </button>
          </form>
        </div>

        {/* Featured list */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-brand-ink">Featured knowledge</h2>
            <p className="text-xs text-steel-500 font-mono">Top Highlighted & Most Viewed</p>
          </div>
          {featuredLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(12).keys()].map(i => (
                <div key={i} className="panel p-4 skeleton h-32" />
              ))}
          </div>
          ) : featuredError ? (
            <p className="text-sm text-red-400 font-mono">{featuredError}</p>
          ) : featured.length === 0 ? (
            <p className="text-sm text-steel-500">No featured documents yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featured.slice(0, 12).map(item => (
                <FeaturedCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PublicLayout>
  )
}

function FeaturedCard({ item }) {
  console.log('Testttt', item)
  return (
    <Link
      to={`/knowledge/${item.id}`}
      className="panel p-5 flex flex-col gap-3 transition-all duration-200 group hover:-translate-y-1 hover:border-brand/30 hover:bg-brand-soft/50"
    >
      <div className="flex items-center justify-between">
        <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.4em] text-green-400 font-bold">
        {item.highlight && (
              <span className="inline-flex items-center gap-1 text-orange-400  font-bold">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.785.57-1.84-.197-1.54-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Highlight 
              </span>
            )}
            {item.level2Name ? (
            <p className="text-[11px] uppercase tracking-[0.35em] text-steel-500/90 mt-0">{item.level1Name} / {item.level2Name}</p>
          ) : (
            <p className="text-[11px] uppercase tracking-[0.35em] text-steel-500/90 mt-0">{item.level1Name}</p>
          )}
      </div>
          
          <h3 className="font-display font-semibold text-brand-ink text-lg group-hover:text-brand text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-navy-300">
            {/* <h3 className="font-display font-semibold text-brand-ink text-lg group-hover:text-brand transition-colors"></h3> */}
            {item.title}
          </h3>
        </div>
        <div className="text-right text-xs text-steel-500 font-mono">
          <div>{item.viewCount?.toLocaleString()} views</div>
          <div>{new Date(item.updatedAt).toLocaleDateString('th-TH')}</div>
        </div>
      </div>
    
    </Link>
  )
}

