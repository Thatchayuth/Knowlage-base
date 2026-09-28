/**
 * PortalSidebarSection.jsx
 * ────────────────────────
 * Collapsible "File Portal" section in the sidebar.
 * Appears below IFAQ categories; mirrors the same expand/collapse UX.
 *
 * - Loads root folder tree (permission-filtered for current user)
 * - Each folder expands inline → lazy-loads children + files
 * - Shows ONLY PDF, video and Excel files (other types hidden)
 * - Clicking a file navigates to /portal/file/:fileId
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useFolderTree } from '../../hooks/useFolderTree'
import { getFolderChildren, getFolderFiles } from '../../services/portal.service'
import { fetchSettings } from '../../services/services'
import { parsePortalIcon } from '../../pages/admin/AdminSettingsPage'
import Collapse from '../ui/Collapse'

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
const stripExt = (name = '') => name.replace(/\.[^.\\/]+$/, '')

// Folder icon tint per depth, so nesting reads at a glance.
const DEPTH_TINT = ['text-sky-300', 'text-teal-300', 'text-amber-300', 'text-violet-300']
const tintFor = (depth) => DEPTH_TINT[Math.min(depth, DEPTH_TINT.length - 1)]

// ── PortalFileItem ────────────────────────────────────────────────
function PortalFileItem({ file }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isActive = location.pathname === `/portal/file/${file.Id}`
  const kind = isPdf(file)
    ? { icon: 'file-pdf', color: 'text-red-300' }
    : isExcel(file)
      ? { icon: 'file-excel', color: 'text-emerald-300' }
      : { icon: 'file-video', color: 'text-purple-300' }

  return (
    <button
      onClick={() => navigate(`/portal/file/${file.Id}`, { state: { file } })}
      title={file.FileName}
      className={`sb-row w-full text-left flex items-center gap-2.5 min-h-[36px] py-1.5 pl-2.5 pr-3 rounded-lg text-sm ${
        isActive ? 'sb-row-active text-white' : 'text-slate-300'
      }`}
    >
      <FontAwesomeIcon icon={['fas', kind.icon]} className={`sb-row-icon w-3.5 flex-shrink-0 ${kind.color}`} />
      <span className="flex-1 min-w-0 leading-snug line-clamp-2 break-words">{stripExt(file.FileName)}</span>
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
    <div>
      <button
        onClick={handleToggle}
        className={`sb-row w-full flex items-center gap-2.5 min-h-[38px] py-1.5 pl-2.5 pr-2 rounded-lg text-[15px] ${
          expanded ? 'text-white' : 'text-slate-300'
        }`}
      >
        <FontAwesomeIcon
          icon={['fas', expanded ? 'folder-open' : 'folder']}
          className={`sb-row-icon w-4 flex-shrink-0 ${tintFor(depth)}`}
        />
        <span className={`flex-1 text-left truncate ${expanded ? 'font-semibold' : 'font-medium'}`}>{folder.FolderName}</span>
        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-slate-500">
          {loading
            ? <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="w-3" />
            : <FontAwesomeIcon icon={['fas', 'chevron-right']} className={`w-2.5 transition-transform duration-300 ${expanded ? 'rotate-90 text-slate-300' : ''}`} />}
        </span>
      </button>

      <Collapse open={expanded && !loading}>
        {/* Guide line shows which folder the children belong to */}
        <div className="sb-stagger ml-[17px] pl-2 border-l border-white/10 py-0.5 space-y-0.5">
          {children?.map(child => (
            <PortalFolderItem key={child.Id} folder={child} depth={depth + 1} />
          ))}
          {files?.map(file => (
            <PortalFileItem key={file.Id} file={file} />
          ))}
          {children?.length === 0 && files?.length === 0 && (
            <p className="px-2.5 py-1.5 text-xs text-slate-500 italic">ไม่มีไฟล์</p>
          )}
        </div>
      </Collapse>
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
    const load = () => fetchSettings()
      .then(data => {
        if (data?.portal_title) setPortalTitle(data.portal_title)
          setPortalIcon(data.portal_icon || 'fa-solid fa-folder')
      })
      .catch(() => {}) // ถ้า fetch ไม่ได้ก็ใช้ค่า default
    load()
    // AdminSettingsPage fires this after a save, so the new title/icon show without a reload.
    window.addEventListener('settings:updated', load)
    return () => window.removeEventListener('settings:updated', load)
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
    <div className="px-3">
      {/* Section header */}
      <button
        onClick={handleToggle}
        className={`group w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-colors ${
          expanded ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]'
        }`}
      >
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-sky-400/25 to-teal-400/20 ring-1 ring-white/10 text-sky-200 transition-transform group-hover:scale-105">
          <FontAwesomeIcon icon={parsePortalIcon(portalIcon)} className="w-4" />
        </span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block font-display font-semibold text-[15px] text-white truncate">{portalTitle}</span>
          {!loading && !error && (
            <span className="block text-[11px] text-slate-400">{tree.length} โฟลเดอร์</span>
          )}
        </span>
        <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
          {loading
            ? <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="w-3" />
            : <FontAwesomeIcon icon={['fas', 'chevron-down']} className={`w-3 transition-transform duration-300 ${expanded ? '' : '-rotate-90'}`} />}
        </span>
      </button>

      {/* Folder tree */}
      <Collapse open={expanded && !loading}>
        <div className="sb-stagger mt-1 space-y-0.5">
          {error ? (
            <p className="px-3 py-1.5 text-sm text-red-300">{error}</p>
          ) : (
            tree.map(folder => (
              <PortalFolderItem key={folder.Id} folder={folder} />
            ))
          )}
        </div>
      </Collapse>
    </div>
  )
}
