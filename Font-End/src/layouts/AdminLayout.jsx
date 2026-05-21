import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'

const NAV = [
  { label: 'Dashboard',    href: '/administrator',                icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Level 1 Categories', href: '/administrator/level1', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { label: 'Level 2 Categories', href: '/administrator/level2', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { label: 'Knowledge Items',    href: '/administrator/knowledge', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { label: 'Site Settings',      href: '/administrator/settings',  icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'เงื่อนไขการใช้งาน', href: '/administrator/terms',     icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
]

// Portal management nav (separate section)
const PORTAL_NAV = [
  { label: 'จัดการโฟลเดอร์', href: '/administrator/portal/folders',      icon: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' },
  { label: 'Sync Drive',      href: '/administrator/portal/sync',         icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { label: 'Sync Users',      href: '/administrator/portal/sync-users',   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    toast({ message: 'Logged out successfully', type: 'success' })
    navigate('/admin-login')
  }

  return (
    <div className="min-h-screen app-shell flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 app-overlay lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-30 w-64 flex flex-col bg-brand text-white
        border border-brand/40
        transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="flex-shrink-0 px-5 py-5 border-b border-white/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-500/15 border border-accent-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="font-display font-bold text-white text-sm leading-tight">Admin Panel</div>
              <div className="text-xs text-white/60 font-mono">KMS Control</div>
            </div>
          </div>
        </div>

        {/* User badge */}
        <div className="flex-shrink-0 px-4 py-3 mx-3 my-3 rounded-xl bg-accent-500/8 border border-accent-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent-500/20 border border-accent-500/40 flex items-center justify-center flex-shrink-0">
              <span className="text-accent-400 font-mono font-bold text-xs">
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.username}</div>
              <div className="text-xs text-accent-400 font-mono">admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`nav-item ${active ? 'nav-item-active' : 'nav-item-hover'}`}
              >
                <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-accent-400' : 'text-white/60'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}

          {/* File Portal section */}
          <div className="pt-3 border-t border-white/20 mt-3">
            <p className="px-3 pb-1.5 text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono">
              File Portal
            </p>
            {PORTAL_NAV.map(item => {
              const active = location.pathname === item.href || location.pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`nav-item ${active ? 'nav-item-active' : 'nav-item-hover'}`}
                >
                  <svg className={`w-4 h-4 flex-shrink-0 ${active ? 'text-accent-400' : 'text-white/60'}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>

          <div className="pt-3 border-t border-white/30 mt-3">
            <Link
              to="/"
              className="nav-item nav-item-hover"
              onClick={() => setSidebarOpen(false)}
            >
              <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Site</span>
            </Link>
          </div>
        </nav>

        {/* Logout */}
        <div className="flex-shrink-0 p-3 border-t border-white/30">
          <button
            onClick={handleLogout}
            className="w-full nav-item nav-item-hover text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Mobile topbar */}
        <div className="lg:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-brand text-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display font-bold text-white text-sm">Admin Panel</span>
        </div>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
