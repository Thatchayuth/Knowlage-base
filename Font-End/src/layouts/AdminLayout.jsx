import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import LogoNCR from '../img/NCR-logo-web.png'

// `hidden: true` = out of current scope. The pages and routes still exist
// (reachable by URL); only the menu entry is hidden. Flip to show again.
// `match` = extra path prefixes that should highlight the entry (sub-pages).
const NAV_SECTIONS = [
  {
    title: 'หน้าเว็บ',
    items: [
      { label: 'Dashboard',             href: '/administrator',           icon: 'gauge-high', hidden: true, exact: true },
      { label: 'Level 1 Categories',    href: '/administrator/level1',    icon: 'layer-group', hidden: true },
      { label: 'Level 2 Categories',    href: '/administrator/level2',    icon: 'table-cells-large', hidden: true },
      { label: 'Knowledge Items',       href: '/administrator/knowledge', icon: 'book-open', hidden: true },
      { label: 'คอลัมน์หน้าแรก',          href: '/administrator/home',      icon: 'table-columns' },
      { label: 'ตั้งค่าเว็บไซต์',           href: '/administrator/settings',  icon: 'sliders' },
      { label: 'เรียนรู้การใช้งานระบบ',     href: '/administrator/terms',     icon: 'chalkboard-user' },
    ],
  },
  {
    title: 'File Portal',
    items: [
      { label: 'จัดการโฟลเดอร์', href: '/administrator/portal/folders', icon: 'folder-tree', match: ['/administrator/portal/permissions'] },
      { label: 'Sync Drive',     href: '/administrator/portal/sync',       icon: 'rotate' },
      { label: 'ผู้ใช้ Sync',     href: '/administrator/portal/sync-users', icon: 'user-gear' },
    ],
  },
]

function isActive(item, pathname) {
  if (item.exact) return pathname === item.href
  return [item.href, ...(item.match || [])].some(p => pathname === p || pathname.startsWith(p + '/'))
}

function NavItem({ item, active, onClick }) {
  return (
    <Link
      to={item.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 min-h-[44px] px-2.5 py-1.5 rounded-xl text-[15px] transition-all duration-200 ${
        active
          ? 'bg-white text-brand font-semibold shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)]'
          : 'text-slate-300 hover:text-white hover:bg-white/[0.08] hover:translate-x-0.5'
      }`}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
        active ? 'bg-brand text-white' : 'bg-white/[0.06] text-sky-300 group-hover:bg-white/10'
      }`}>
        <FontAwesomeIcon icon={['fas', item.icon]} className="w-4" />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    toast({ message: 'ออกจากระบบแล้ว', type: 'success' })
    navigate('/admin-login')
  }

  const close = () => setSidebarOpen(false)
  const username = user?.username || ''

  return (
    <div className="min-h-screen app-shell flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 app-overlay lg:hidden" onClick={close} />
      )}

      {/* Sidebar — same look as the public sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-30 w-72 flex flex-col
        bg-gradient-to-b from-[#0d1f6b] via-brand to-[#060d33] text-white border-r border-white/5
        transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="flex-shrink-0 px-4 pt-5 pb-4">
          <Link to="/administrator/home" onClick={close} className="group block">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:-translate-y-0.5">
              <img src={LogoNCR} alt="NCR" className="mx-auto h-11 w-auto" />
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <FontAwesomeIcon icon={['fas', 'shield-halved']} className="text-sky-300 text-sm" />
              <span className="font-display font-bold text-white text-base tracking-wide">ผู้ดูแลระบบ</span>
            </div>
            <div className="mt-0.5 text-center text-[11px] uppercase tracking-[0.25em] text-sky-300/70">
              Cell-E Onsite Desktop
            </div>
          </Link>
          <div
            aria-hidden="true"
            className="mt-4 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.5), rgba(34,197,94,0.5), rgba(20,184,166,0.5), transparent)' }}
          />
        </div>

        {/* Nav */}
        <nav className="sb-scroll flex-1 px-3 pb-3 overflow-y-auto">
          {NAV_SECTIONS.map(section => {
            const items = section.items.filter(i => !i.hidden)
            if (!items.length) return null
            return (
              <div key={section.title} className="mb-4">
                <p className="px-2.5 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {items.map(item => (
                    <NavItem key={item.href} item={item} active={isActive(item, location.pathname)} onClick={close} />
                  ))}
                </div>
              </div>
            )
          })}

          <div className="pt-3 border-t border-white/10">
            <Link
              to="/"
              onClick={close}
              className="group flex items-center gap-3 min-h-[44px] px-2.5 py-1.5 rounded-xl text-[15px] text-slate-300 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.06] text-slate-300 group-hover:bg-white/10">
                <FontAwesomeIcon icon={['fas', 'arrow-left']} className="w-4" />
              </span>
              กลับหน้าเว็บ
            </Link>
          </div>
        </nav>

        {/* User card + logout */}
        <div className="flex-shrink-0 border-t border-white/10 px-3 py-3 bg-black/10">
          <div className="flex items-center gap-3 px-2.5 py-2 rounded-xl bg-white/[0.06] ring-1 ring-white/10">
            <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-sky-400 to-teal-500 text-white font-display font-bold text-sm uppercase">
              {username.replace(/^.*\\/, '').charAt(0) || 'A'}
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-sm font-semibold text-white truncate">{username}</div>
              <div className="text-[11px] text-sky-300">ผู้ดูแลระบบ</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white/50 hover:text-red-300 hover:bg-red-500/15 transition-colors"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
            >
              <FontAwesomeIcon icon={['fas', 'right-from-bracket']} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-10 flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white/70 backdrop-blur-xl border-b border-slate-200/70">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="btn-icon text-brand"
            aria-label="เปิดเมนู"
          >
            <FontAwesomeIcon icon={['fas', 'bars']} className="text-lg" />
          </button>
          <span className="font-display font-bold text-brand text-base">ผู้ดูแลระบบ</span>
        </div>

        <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <div className="max-w-[1400px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
