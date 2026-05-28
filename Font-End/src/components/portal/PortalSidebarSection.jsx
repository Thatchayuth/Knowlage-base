/**
 * PortalSidebarSection.jsx
 * ────────────────────────
 * Collapsible "File Portal" section in the sidebar.
 * Appears below IFAQ categories; mirrors the same expand/collapse UX.
 *
 * - Loads root folder tree (permission-filtered for current user)
 * - Each folder expands inline → lazy-loads children + files
 * - Shows ONLY PDF and video files (other types hidden)
 * - Clicking a file navigates to /portal/file/:fileId
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useFolderTree } from '../../hooks/useFolderTree'
import { getFolderChildren, getFolderFiles } from '../../services/portal.service'
import { fetchSettings } from '../../services/services'
import { parsePortalIcon } from '../../pages/admin/AdminSettingsPage'

// sessionStorage helpers — survive PublicLayout remount on every navigation
function ssGet(key, fallback = false) {
  try { const v = sessionStorage.getItem(key); return v === null ? fallback : v === '1' } catch { return fallback }
}
function ssSet(key, val) {
  try { sessionStorage.setItem(key, val ? '1' : '0') } catch {}
}

// ── helpers ──────────────────────────────────────────────────────
function isPdf(file) {
  return /\.pdf$/i.test(file.FileName) || file.MimeType === 'application/pdf'
}
function isVideo(file) {
  return /\.(mp4|webm|ogg|mov|avi|mkv|m4v|wmv|flv|3gp|3g2|ts|mpg|mpeg)$/i.test(file.FileName) ||
    (file.MimeType || '').startsWith('video/')
}
function isExcel(file) {
  return /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(file.FileName) ||
    (file.MimeType || '').includes('spreadsheet') ||
    file.MimeType === 'application/vnd.ms-excel'
}

// ── PortalFileItem ────────────────────────────────────────────────
function PortalFileItem({ file }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isActive = location.pathname === `/portal/file/${file.Id}`
  const pdf = isPdf(file)
  const excel = isExcel(file)
  const dotColor = pdf ? 'bg-orange-400' : excel ? 'bg-green-400' : 'bg-purple-400'
  const label    = pdf ? 'PDF' : excel ? 'XLS' : 'VDO'
  const labelColor = pdf ? 'text-orange-400/70' : excel ? 'text-green-400/70' : 'text-purple-400/70'

  return (
    <button
      onClick={() => navigate(`/portal/file/${file.Id}`, { state: { file } })}
      className={`nav-item w-full text-left ${isActive ? 'nav-item-active pl-6' : 'nav-item-hover pl-6'}`}
    >
      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span className="truncate text-sm leading-snug flex-1">{file.FileName}</span>
      <span className={`text-[10px] font-mono flex-shrink-0 ${labelColor}`}>
        {label}
      </span>
    </button>
  )
}

// ── PortalFolderItem ──────────────────────────────────────────────
function PortalFolderItem({ folder, depth = 0 }) {
  const storageKey = `pf-open-${folder.Id}`

  // Restore expanded state from sessionStorage so it survives PublicLayout remounts
  const [expanded, setExpanded] = useState(() => ssGet(storageKey))
  const [children, setChildren] = useState(null)
  const [files,    setFiles]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ch, fi] = await Promise.all([
        getFolderChildren(folder.Id).catch(() => []),
        getFolderFiles(folder.Id).catch(() => []),
      ])
      setChildren(ch || [])
      setFiles((fi || []).filter(f => isPdf(f) || isVideo(f) || isExcel(f)))
    } finally {
      setLoading(false)
    }
  }, [folder.Id])

  // If restored as expanded from sessionStorage, load data automatically on mount
  useEffect(() => {
    if (expanded && children === null) loadData()
  }, []) // intentionally runs once on mount only

  const handleToggle = useCallback(async () => {
    const next = !expanded
    setExpanded(next)
    ssSet(storageKey, next)
    if (next && children === null) await loadData()
  }, [expanded, children, storageKey, loadData])

  return (
    <div className="mb-0.5">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 py-1.5 text-base text-slate-300 hover:text-slate-100 transition-colors pr-3"
        style={{ paddingLeft: `${12 + depth * 10}px` }}
      >
        {/* Folder icon */}
        <svg className="w-3.5 h-3.5 text-accent-500/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>

        <span className="font-medium flex-1 text-left truncate text-base">{folder.FolderName}</span>

        {/* Loading spinner / chevron */}
        {loading ? (
          <svg className="w-3 h-3 text-slate-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg
            className={`w-3 h-3 text-slate-500 transition-transform duration-150 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {expanded && (
        <div className="border-l border-white/20" style={{ marginLeft: `${16 + depth * 10}px` }}>
          {children?.map(child => (
            <PortalFolderItem key={child.Id} folder={child} depth={depth + 1} />
          ))}
          {files?.map(file => (
            <PortalFileItem key={file.Id} file={file} />
          ))}
          {!loading && children?.length === 0 && files?.length === 0 && (
            <p className="px-3 py-1 text-xs text-slate-600 italic">ไม่มีไฟล์</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── PortalSidebarSection (root) ───────────────────────────────────
export default function PortalSidebarSection() {
  const { tree, loading, error } = useFolderTree()
  const location = useLocation()
  const isPortalRoute = location.pathname.startsWith('/portal')
  const [portalTitle, setPortalTitle] = useState('Cell-E-File Portal')
  const [portalIcon,  setPortalIcon]  = useState('fa-solid fa-folder')

  useEffect(() => {
    fetchSettings()
      .then(data => {
        if (data?.portal_title) setPortalTitle(data.portal_title)
          setPortalIcon(data.portal_icon || 'fa-solid fa-folder')
      })
      .catch(() => {}) // ถ้า fetch ไม่ได้ก็ใช้ค่า default
  }, [])

  // Auto-expand when on any /portal/* route; otherwise restore from sessionStorage
  const [expanded, setExpanded] = useState(() => isPortalRoute || ssGet('portal-section-open'))

  useEffect(() => {
    if (isPortalRoute) setExpanded(true)
  }, [isPortalRoute])

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    ssSet('portal-section-open', next)
  }

  // Hide entirely if no accessible folders
  if (!loading && !error && tree.length === 0) return null

  return (
    <div className="mb-1">
      {/* Section header — same style as MenuLevel1 */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-base font-display font-semibold text-slate-200 hover:text-accent-400 transition-colors group"
      >
        <span className="flex items-center gap-2">
          <FontAwesomeIcon
            icon={parsePortalIcon(portalIcon)}
            className="w-4 h-4 text-accent-500/80 group-hover:text-accent-400 transition-colors flex-shrink-0"
          />
          {portalTitle}
        </span>

        {loading ? (
          <svg className="w-3.5 h-3.5 text-slate-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg
            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* Folder tree */}
      {expanded && !loading && (
        <div className="ml-1 border-l border-white/30 ml-4 pl-0">
          {error ? (
            <p className="px-3 py-1.5 text-base text-red-400 font-mono">{error}</p>
          ) : (
            tree.map(folder => (
              <PortalFolderItem key={folder.Id} folder={folder} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
