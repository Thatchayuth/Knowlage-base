import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout'

export default function HomePage() {
  const [searchQ, setSearchQ] = useState('')
  const navigate = useNavigate()

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
      </div>
    </PublicLayout>
  )
}

