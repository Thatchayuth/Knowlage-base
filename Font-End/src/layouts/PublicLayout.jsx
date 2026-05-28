import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMenu } from '../hooks/useMenu'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'
import IconRenderer from '../components/ui/IconRenderer'
import LogoNCR from '../img/NCR-logo-web.png'
import PortalSidebarSection from '../components/portal/PortalSidebarSection'
import TermsModal from '../components/TermsModal'

function MenuSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1,2,3].map(i => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-5 w-4/5 rounded" />
          {[1,2].map(j => (
            <div key={j} className="ml-4 skeleton h-4 w-3/5 rounded" />
          ))}
        </div>
      ))}
    </div>
  )
}

function MenuLevel1({ item, activeId }) {
  const hasActive = useMemo(() => {
    if (!activeId) return false
    if (item.directItems?.some(di => String(di.id) === String(activeId))) return true
    return item.level2?.some(l2 => l2.items?.some(ki => String(ki.id) === String(activeId))) || false
  }, [item, activeId])

  const [expanded, setExpanded] = useState(() => hasActive)

  useEffect(() => {
    if (hasActive) setExpanded(true)
  }, [hasActive])
  const hasL2 = item.level2?.length > 0
  const hasDirectItems = item.directItems?.length > 0

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2 text-base font-display font-semibold text-slate-200 hover:text-accent-400 transition-colors group"
      >
        <span className="flex items-center gap-2">
          <IconRenderer icon={item.icon} className="w-4 h-4 text-accent-500/80 group-hover:text-accent-400 transition-colors" />
          {item.name}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="ml-1 border-l border-white/30 pl-1 ml-4">
          {hasL2 && item.level2.map(l2 => (
            <MenuLevel2 key={l2.id} item={l2} activeId={activeId} />
          ))}
          {/* Direct items (from disabled Level2) */}
          {hasDirectItems && item.directItems.map(ki => (
            <MenuKnowledgeItem key={ki.id} item={ki} activeId={activeId} indent={0} />
          ))}
        </div>
      )}
    </div>
  )
}

function MenuLevel2({ item, activeId }) {
  const hasActive = useMemo(() => {
    if (!activeId) return false
    return item.items?.some(ki => String(ki.id) === String(activeId)) || false
  }, [item, activeId])

  const [expanded, setExpanded] = useState(() => hasActive)

  useEffect(() => {
    if (hasActive) setExpanded(true)
  }, [hasActive])

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-base text-slate-300 hover:text-slate-100 transition-colors"
      >
        <IconRenderer icon={item.icon} className="w-3.5 h-3.5 text-slate-500" />
        <span className="font-medium">{item.name}</span>
        <span className="ml-auto text-xs text-slate-500 tabular-nums">{item.items?.length || 0}</span>
        <svg className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && item.items?.length > 0 && (
        <div className="ml-3 border-l border-white/30 pl-1">
          {item.items.map(ki => (
            <MenuKnowledgeItem key={ki.id} item={ki} activeId={activeId} />
          ))}
        </div>
      )}
    </div>
  )
}

function MenuKnowledgeItem({ item, activeId }) {
  const isActive = String(activeId) === String(item.id)

  // LINK mode → เปิด external URL ใน tab ใหม่
  if (item.displayMode === 'LINK' && item.externalUrl) {
    return (
      <a
        href={item.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="nav-item nav-item-hover pl-4"
      >
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-sky-500" />
        <span className="truncate text-base leading-snug flex-1">{item.title}</span>
        <svg className="w-3 h-3 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    )
  }

  return (
    <Link
      to={`/knowledge/${item.id}`}
      className={`nav-item ${isActive ? 'nav-item-active pl-4' : 'nav-item-hover pl-4'}`}
    >
      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-accent-500' : 'bg-steel-600'}`} />
      <span className="truncate text-base leading-snug flex-1">{item.title}</span>
    </Link>
  )
}

// --- Greeting/clock helpers for 24/7 operation (moved from HomePage) ---
function getGreeting(h) {
  if (h >= 5  && h < 11) return { th: 'สวัสดีตอนเช้า',  sub: 'Good morning',   shift: 'กะเช้า',  icon: '🌅' }
  if (h >= 11 && h < 13) return { th: 'สวัสดีตอนเที่ยง', sub: 'Good noon',      shift: 'กะเช้า',  icon: '☀️' }
  if (h >= 13 && h < 17) return { th: 'สวัสดีตอนบ่าย',   sub: 'Good afternoon', shift: 'กะบ่าย',  icon: '🌤️' }
  if (h >= 17 && h < 20) return { th: 'สวัสดีตอนเย็น',   sub: 'Good evening',   shift: 'กะบ่าย',  icon: '🌆' }
  if (h >= 20 && h < 24) return { th: 'สวัสดีตอนค่ำ',    sub: 'Good night',     shift: 'กะดึก',   icon: '🌙' }
  return                       { th: 'สวัสดีตอนดึก',    sub: 'Late night shift', shift: 'กะดึก', icon: '🌃' }
}

const THAI_DAYS   = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

function formatThaiDate(d) {
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}
function pad2(n) { return String(n).padStart(2, '0') }

// --- Greeting/clock state (for Navbar) ---
function useGreetingClock() {
  const { user } = useAuth();
  const greetingName = user?.displayName || user?.username || '';
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const g = getGreeting(now.getHours());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return { greetingName, g, hh, mm, ss };
}

export default function PublicLayout({ children }) {
  const { menu, loading, error } = useMenu()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const [searchQ, setSearchQ] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSearch = useCallback((e) => {
    e.preventDefault()
    if (searchQ.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`)
      setSidebarOpen(false)
    }
  }, [searchQ, navigate])

  return (
    <div className="min-h-screen app-shell flex">
      {/* Terms of Use Modal — แสดงครั้งแรกหลัง login ต่อ session */}
      <TermsModal user={user} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 app-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 w-72 flex flex-col bg-brand text-white border border-brand/40
          transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand */}
        <div className="flex-shrink-0 px-5 py-5 border-b border-white/10 bg-white/2">
          <Link to="/" className="group" onClick={() => setSidebarOpen(false)}>
            <div className="flex flex-col items-center gap-3 text-center">
          <img
            src={LogoNCR}
            alt="NCR Knowledge Base"
            className="mx-auto h-16 w-auto"
          />         
              <div className="leading-tight">
                <div className="font-display font-bold text-slate-100 text-base tracking-wide group-hover:text-accent-300 transition-colors">
                  Cell-E Onsite Desktop
                </div>
                <div className="text-[11px] uppercase tracking-[0.38em] text-slate-500 font-mono">----</div>
              </div>
            </div>
          </Link>

          {/* Search */}
          {/* <form onSubmit={handleSearch} className="mt-4">
            <div className="relative">
              <input
                type="search"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search knowledge…"
                className="input-field pr-9 text-base py-2"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-accent-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form> */}
        </div>

        {/* Menu tree */}
        <div className="flex-1 overflow-y-auto py-3">
          {/* Cell-E-File Portal section — above IFAQ */}
          <div className="mb-2 border-b border-white/10 pb-2">
            <PortalSidebarSection />
          </div>

          {/* IFAQ */}
          {loading && <MenuSkeleton />}
          {error && (
            <div className="p-4 text-base text-red-400 font-mono">{error}</div>
          )}
          {!loading && !error && menu.map(item => (
            <MenuLevel1 key={item.id} item={item} activeId={id} />
          ))}
          {!loading && !error && menu.length === 0 && (
            <p className="p-4 text-base text-slate-500">No categories found.</p>
          )}
        </div>

        {/* Footer links */}
        <div className="flex-shrink-0 border-t border-white/30 px-4 py-3 space-y-1">
          {/* แสดง Administrator link เฉพาะ admin */}
          {user?.role === 'admin' && (
            <Link
              to="/administrator"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors font-mono"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Administrator
            </Link>
          )}

          {/* แสดง Sync link เฉพาะ syncuser */}
          {user?.role === 'syncuser' && (
            <Link
              to="/sync"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors font-mono"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Drive
            </Link>
          )}

          {/* User info + logout */}
          {user && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-3.5 h-3.5 text-steel-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs text-white/60 font-mono truncate">{user.username}</span>
              </div>
              <button
                onClick={() => { logout(); navigate('/admin-login') }}
                className="text-xs text-white/40 hover:text-red-400 transition-colors font-mono flex-shrink-0 ml-2"
                title="Sign out"
              >
                ออก
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72">
        {/* Top navbar (touch-friendly, sticky) */}
        <header className="sticky top-0 z-20 flex-shrink-0 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex-shrink-0 w-12 h-12 flex items-center justify-center text-brand hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors"
              aria-label="เปิดเมนู"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Mobile brand */}
            <Link to="/" className="lg:hidden flex items-center gap-2 min-w-0 flex-shrink-0">
              <img src={LogoNCR} alt="NCR" className="h-8 w-auto flex-shrink-0" />
              <span className="font-display font-semibold text-brand text-base truncate hidden sm:inline">I-FAQ</span>
            </Link>

            {/* Search (full-width, touch-friendly) */}
            <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 max-w-3xl mx-auto lg:mx-0">
              <div className="relative flex-1">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="ค้นหาเอกสาร ขั้นตอน หรือกลุ่ม…"
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-100 border border-slate-200 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 text-base text-brand-ink placeholder:text-slate-400 outline-none transition-all"
                />
                {searchQ && (
                  <button
                    type="button"
                    onClick={() => setSearchQ('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg"
                    aria-label="ล้าง"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="flex-shrink-0 h-12 px-5 sm:px-8 rounded-xl bg-brand text-white font-display font-semibold text-base hover:bg-brand/90 active:scale-95 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">ค้นหา</span>
              </button>
            </form>

            {/* Home shortcut */}
            <Link
              to="/"
              className="hidden lg:flex flex-shrink-0 w-12 h-12 items-center justify-center text-slate-500 hover:text-brand hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors"
              title="หน้าแรก"
              aria-label="หน้าแรก"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
          </div>
        </header>


        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}


