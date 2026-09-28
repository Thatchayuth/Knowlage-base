import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import api from '../../services/axios'
import { getFolderChildren, getFolderFiles } from '../../services/portal.service'
import Collapse from '../ui/Collapse'

// ────────── FA helpers ──────────
function parseFa(cls) {
  if (!cls) return ['fas', 'circle']
  const parts = String(cls).trim().split(/\s+/)
  const styleMap = { 'fa-solid': 'fas', 'fa-regular': 'far', 'fa-brands': 'fab', fas: 'fas', far: 'far', fab: 'fab' }
  const styleEntry = parts.find(p => styleMap[p])
  const prefix = styleEntry ? styleMap[styleEntry] : 'fas'
  const namePart = parts.find(p => p.startsWith('fa-') && !styleMap[p])
  const name = namePart ? namePart.slice(3) : parts.find(p => !p.startsWith('fa-')) || 'circle'
  return [prefix, name]
}
function FaIcon({ icon, className = '', style }) {
  if (!icon) return null
  try {
    return <FontAwesomeIcon icon={parseFa(icon)} className={className} style={style} />
  } catch {
    return null
  }
}

// ────────── Color helpers ──────────
const LEGACY_COLORS = { blue: '#3B82F6', red: '#EF4444', green: '#10B981' }
const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
const resolveHex = (c) => (HEX_RE.test(c || '') ? c : (LEGACY_COLORS[c] || '#0a1855'))

function expandHex(hex) {
  const h = hex.replace('#', '')
  return h.length === 3 ? h.split('').map(c => c + c).join('') : h
}
function hexToRgb(hex) {
  const v = expandHex(hex)
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  }
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
function pickTextOn(hex) {
  const { r, g, b } = hexToRgb(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#1f2937' : '#ffffff'
}

// ────────── File-type helpers (mirror sidebar) ──────────
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
function fileKind(file) {
  if (isPdf(file))   return { type: 'pdf',   icon: 'file-pdf',   color: 'text-red-500' }
  if (isExcel(file)) return { type: 'excel', icon: 'file-excel', color: 'text-emerald-600' }
  return                    { type: 'video', icon: 'file-video', color: 'text-purple-500' }
}
// The icon already shows the type, so the extension is noise in the list.
const stripExt = (name = '') => name.replace(/\.[^.\\/]+$/, '')

// ────────── Expanded-state memory ──────────
// Remembers which folders are open for this tab, so going back from a file
// restores the tree. Keys: "item:<homeItemId>" and "folder:<folderId>".
const EXPANDED_KEY = 'home.expanded'

function readExpanded() {
  try { return new Set(JSON.parse(sessionStorage.getItem(EXPANDED_KEY) || '[]')) } catch { return new Set() }
}
function useRememberedExpand(key) {
  const [expanded, setState] = useState(() => readExpanded().has(key))
  const setExpanded = useCallback((next) => {
    setState(next)
    try {
      const set = readExpanded()
      if (next) set.add(key); else set.delete(key)
      sessionStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]))
    } catch { /* storage blocked */ }
  }, [key])
  return [expanded, setExpanded]
}

// ────────── Recursive folder node (mirrors PortalFolderItem) ──────────
function SubFolderNode({ folder, accent, depth = 0 }) {
  const [expanded, setExpanded] = useRememberedExpand(`folder:${folder.Id}`)
  const [children, setChildren] = useState(null)
  const [files, setFiles]       = useState(null)
  const [loading, setLoading]   = useState(false)

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

  // A folder remembered as open loads its contents on mount.
  useEffect(() => {
    if (expanded && children === null) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggle = useCallback(async () => {
    const next = !expanded
    setExpanded(next)
    if (next && children === null) await loadData()
  }, [expanded, children, loadData, setExpanded])

  return (
    <li>
      <div
        className="home-subrow flex items-center gap-2 min-h-[40px] py-1.5 pr-2 rounded-lg"
        style={{ paddingLeft: `${4 + depth * 8}px` }}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label={expanded ? 'ยุบ' : 'ขยาย'}
          title={expanded ? 'ยุบ' : 'ขยาย'}
        >
          {loading ? (
            <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="w-3" />
          ) : (
            <FontAwesomeIcon
              icon={['fas', 'chevron-right']}
              className={`w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          )}
        </button>
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-base text-left text-inherit"
          style={expanded ? { color: accent } : undefined}
        >
          <FontAwesomeIcon icon={['fas', expanded ? 'folder-open' : 'folder']} className="home-subrow-icon w-4 flex-shrink-0" style={{ color: accent }} />
          <span className="line-clamp-2 break-words font-semibold">{folder.FolderName}</span>
          {folder._hasDirectAccess === false && (
            <FontAwesomeIcon icon={['fas', 'lock']} className="w-2.5 text-slate-400 flex-shrink-0" title="navigation เท่านั้น" />
          )}
        </button>
      </div>

      <Collapse open={expanded && !loading}>
        <ul
          className="home-stagger ml-2.5 border-l pl-1.5 space-y-0.5"
          style={{ borderColor: rgba(accent, 0.2), marginLeft: `${10 + depth * 8}px` }}
        >
          {children?.map(child => (
            <SubFolderNode key={child.Id} folder={child} accent={accent} depth={depth + 1} />
          ))}
          {files?.map(f => <SubFileItem key={f.Id} file={f} />)}
          {children?.length === 0 && files?.length === 0 && (
            <li className="px-2 py-2 text-sm text-slate-400 italic">ไม่มีไฟล์</li>
          )}
        </ul>
      </Collapse>
    </li>
  )
}

// ────────── File leaf ──────────
function SubFileItem({ file }) {
  const navigate = useNavigate()
  const kind = fileKind(file)
  const rowCls = 'home-subrow w-full flex items-center gap-2.5 min-h-[40px] py-2 pl-2 pr-2 rounded-lg text-left text-base text-slate-600'
  const content = (
    <>
      <FontAwesomeIcon icon={['fas', kind.icon]} className={`home-subrow-icon w-4 flex-shrink-0 ${kind.color}`} />
      <span className="flex-1 min-w-0 line-clamp-2 break-words" title={file.FileName}>{stripExt(file.FileName)}</span>
    </>
  )
  if (kind.type === 'excel') {
    const url = `kmportal://open?type=${encodeURIComponent(file.MimeType || 'file')}&path=${encodeURIComponent(file.FullPath || '')}`
    return <li><a href={url} className={rowCls}>{content}</a></li>
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/portal/file/${file.Id}`, { state: { file } })}
        className={rowCls}
      >
        {content}
      </button>
    </li>
  )
}

// ────────── Sub-folder expansion (top-level inside HomeItem) ──────────
function FolderSubList({ folderId, accent }) {
  const [children, setChildren] = useState(null)
  const [files, setFiles]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    let abort = false
    setLoading(true)
    setError(null)
    Promise.all([
      getFolderChildren(folderId).catch(() => []),
      getFolderFiles(folderId).catch(() => []),
    ])
      .then(([ch, fi]) => {
        if (abort) return
        setChildren(ch || [])
        setFiles((fi || []).filter(f => isPdf(f) || isVideo(f) || isExcel(f)))
      })
      .catch(e => { if (!abort) setError(e.response?.data?.error || 'โหลดล้มเหลว') })
      .finally(() => { if (!abort) setLoading(false) })
    return () => { abort = true }
  }, [folderId])

  if (loading) {
    return (
      <div className="mt-1 ml-7 pl-3 py-1.5 text-base text-slate-400 flex items-center gap-2">
        <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="w-3" />
        กำลังโหลด…
      </div>
    )
  }
  if (error) return <div className="mt-1 ml-7 pl-3 py-1.5 text-base text-red-600">{error}</div>
  if (!children?.length && !files?.length) {
    return <div className="mt-1 ml-7 pl-3 py-1.5 text-base text-slate-400 italic">ไม่มีโฟลเดอร์ย่อยและไฟล์</div>
  }

  // Capped height keeps a big folder from stretching this column far past the other two.
  return (
    <div className="mt-1 ml-7 max-h-[360px] overflow-y-auto overscroll-contain pr-1">
      <ul className="home-stagger border-l-2 pl-2 space-y-0.5" style={{ borderColor: rgba(accent, 0.25) }}>
        {children?.map(c => (
          <SubFolderNode key={c.Id} folder={c} accent={accent} depth={0} />
        ))}
        {files?.map(f => <SubFileItem key={f.Id} file={f} />)}
      </ul>
    </div>
  )
}

// ────────── Single item ──────────
function HomeItem({ item, color, onSelectProgram, liClass, liStyle }) {
  const [expanded, setExpanded] = useRememberedExpand(`item:${item.id}`)
  const [opening, setOpening]   = useState(false)
  const iconBg  = rgba(color, 0.12)

  const baseRow = 'home-row group flex items-center gap-3 px-3 py-2.5 rounded-xl text-base text-slate-700'

  // Icon chip — colored, consistent, slightly scales on hover
  const IconChip = ({ icon, fallback }) => (
    <span
      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] home-row-icon"
      style={{ backgroundColor: iconBg, color }}
    >
      <FaIcon icon={icon || fallback} />
    </span>
  )

  const Arrow = () => (
    <span className="home-row-arrow flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center">
      <FontAwesomeIcon icon={['fas', 'arrow-right']} className="w-3" />
    </span>
  )

  // PROGRAM / PROGRAM GROUP (locked / no access)
  if ((item.linkType === 'program' || item.linkType === 'program_group') && !item.hasAccess) {
    return (
      <li className={liClass} style={liStyle}>
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed select-none bg-slate-50"
          title="คุณไม่มีสิทธิ์เข้าถึงไฟล์นี้"
        >
          <span className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-slate-200 text-slate-400">
            <FontAwesomeIcon icon={['fas', 'lock']} className="text-base" />
          </span>
          <span className="text-lg font-bold line-through truncate flex-1">{item.title}</span>
          <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            no access
          </span>
        </div>
      </li>
    )
  }

  // PROGRAM
  if (item.linkType === 'program') {
    const hasMultiple = item.filePaths && item.filePaths.length > 1;
    // The mapped file may have been renamed since an admin saved it, so ask the
    // server for the path that exists now, then fire kmportal:// straight away.
    // The raw mapped path stays as the href, used when the lookup fails.
    const handleClick = async (e) => {
      e.preventDefault();
      if (hasMultiple) { onSelectProgram({ ...item, groupColor: color }); return }
      setOpening(true)
      let target = item.filePath || ''
      try {
        const r = await api.get(`/api/home/items/${item.id}/resolve`)
        if (r.data?.filePath) target = r.data.filePath
      } catch {
        // keep the raw mapped path
      } finally {
        setOpening(false)
      }
      window.location.href = `kmportal://open?type=${encodeURIComponent(item.programType || 'file')}&path=${encodeURIComponent(target)}`
    };
    const url = hasMultiple
      ? '#'
      : `kmportal://open?type=${encodeURIComponent(item.programType || 'file')}&path=${encodeURIComponent(item.filePath || '')}`;
    return (
      <li className={liClass} style={liStyle}>
        <a href={url} onClick={handleClick} className={baseRow}>
          <IconChip icon={item.icon} fallback="fa-solid fa-circle-play" />
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold text-slate-800 truncate home-row-title">{item.title}</span>
            {item.subtitle && <span className="block text-base text-slate-400 truncate">{item.subtitle}</span>}
          </span>
          {opening
            ? <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="w-3" style={{ color }} />
            : <Arrow />}
        </a>
      </li>
    )
  }

  // PROGRAM GROUP — click opens a modal listing all files inside the mapped folder(s)
  if (item.linkType === 'program_group') {
    return (
      <li className={liClass} style={liStyle}>
        <button
          type="button"
          onClick={() => onSelectProgram({ ...item, groupColor: color })}
          className={`${baseRow} w-full text-left`}
        >
          <IconChip icon={item.icon} fallback="fa-solid fa-layer-group" />
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold text-slate-800 truncate home-row-title">{item.title}</span>
            {item.subtitle && <span className="block text-base text-slate-400 truncate">{item.subtitle}</span>}
          </span>
          <Arrow />
        </button>
      </li>
    )
  }

  // FOLDER
  if (item.linkType === 'folder') {
    return (
      <li className={liClass} style={liStyle}>
        <div className="flex items-stretch">
          {/* <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 w-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-l-xl transition-colors"
            aria-label={expanded ? 'ยุบโฟลเดอร์ย่อย' : 'ดูโฟลเดอร์ย่อย'}
            title={expanded ? 'ยุบโฟลเดอร์ย่อย' : 'ดูโฟลเดอร์ย่อย'}
          >
            <FontAwesomeIcon icon={['fas', expanded ? 'chevron-down' : 'chevron-right']} className="w-3" />
          </button> */}
          {/* While open, the row keeps a tint of the group color so it reads as "current" */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`${baseRow} flex-1 pl-2 text-left`}
            style={expanded ? { backgroundColor: rgba(color, 0.10), boxShadow: `inset 3px 0 0 ${color}` } : undefined}
          >
            <IconChip icon={item.icon} fallback="fa-solid fa-folder" />
            <span className="flex-1 min-w-0">
              <span className="block text-lg font-bold text-slate-800 truncate home-row-title">{item.title || item.folderName}</span>
              {item.subtitle && <span className="block text-base text-slate-400 truncate">{item.subtitle}</span>}
            </span>
            <FontAwesomeIcon icon={['fas', expanded ? 'chevron-down' : 'chevron-right']} className="w-3 text-slate-400" />
          </button>
        </div>
        <Collapse open={expanded}><FolderSubList folderId={item.folderId} accent={color} /></Collapse>
      </li>
    )
  }

  // KNOWLEDGE
  if (item.linkType === 'knowledge') {
    return (
      <li className={liClass} style={liStyle}>
        <Link
          to={`/knowledge/${item.knowledgeId}`}
          className={baseRow}
        >
          <IconChip icon={item.icon} fallback="fa-solid fa-book" />
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold text-slate-800 truncate home-row-title">{item.title || item.knowledgeTitle}</span>
            {item.subtitle && <span className="block text-base text-slate-400 truncate">{item.subtitle}</span>}
          </span>
          <Arrow />
        </Link>
      </li>
    )
  }

  // EXTERNAL LINK — only plain web URLs become an href (blocks javascript:, data:, …)
  if (item.linkType === 'external_link') {
    if (!isSafeWebUrl(item.externalUrl)) return null
    return (
      <li className={liClass} style={liStyle}>
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={baseRow}
        >
          <IconChip icon={item.icon} fallback="fa-solid fa-arrow-up-right-from-square" />
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-bold text-slate-800 truncate home-row-title">{item.title}</span>
            {item.subtitle && <span className="block text-base text-slate-400 truncate">{item.subtitle}</span>}
          </span>
          <FontAwesomeIcon
            icon={['fas', 'up-right-from-square']}
            className="w-3 text-slate-300 group-hover:opacity-100 transition-colors"
            style={{ color: undefined }}
          />
        </a>
      </li>
    )
  }

  return null
}

function isSafeWebUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim())
}

// ────────── Grid layout by column count ──────────
// Literal class strings so Tailwind's content scan keeps them.
const GRID_COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
}
const GRID_COLS_MANY = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' // 5+ wraps onto more rows
const gridColsFor = (n) => GRID_COLS[n] || GRID_COLS_MANY

// ────────── Default (collapsed) view ──────────
// Collapsed, a column shows only its pinned items. A column with no pinned
// item shows everything, so a group is never empty by accident.
const SHOW_ALL_KEY = 'home.showAll'
const ROW_LEAVE_MS = 260 // keep in sync with .home-row-leave in index.css

function visibleItems(items = [], showAll) {
  if (showAll) return items
  const pinned = items.filter(it => it.isPinned)
  return pinned.length ? pinned : items
}

// ────────── Same-title merge ──────────
// Admins often create one item per department with the same title
// (OPL + subtitle OPL-LLH, OPL-MBH, ...). A user who can see several of them
// gets one row that expands into the variants instead of repeated titles.
const normTitle = (t = '') => String(t).trim().toLowerCase()

function mergeByTitle(items = []) {
  const rows = []
  const byKey = new Map()
  for (const it of items) {
    const key = normTitle(it.title || it.folderName || it.knowledgeTitle)
    if (key && byKey.has(key)) { byKey.get(key).items.push(it); continue }
    const row = { key: key || `id:${it.id}`, items: [it] }
    if (key) byKey.set(key, row)
    rows.push(row)
  }
  return rows
}

/** "OPL-LLH" under title "OPL" → "LLH"; falls back to the subtitle, then the title. */
function variantLabel(item) {
  const title = String(item.title || '').trim()
  const sub = String(item.subtitle || '').trim()
  if (!sub) return title
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return sub.replace(new RegExp(`^${esc}\\s*[-–:·]?\\s*`, 'i'), '') || sub
}

function HomeItemGroup({ row, groupId, color, onSelectProgram, liClass, liStyle }) {
  const [expanded, setExpanded] = useRememberedExpand(`title:${groupId}:${row.key}`)
  const first = row.items[0]
  const labels = row.items.map(variantLabel)
  const activeBg = rgba(color, 0.10)

  return (
    <li className={liClass} style={liStyle}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="home-row group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-base text-slate-700 text-left"
        style={expanded ? { backgroundColor: activeBg, boxShadow: `inset 3px 0 0 ${color}` } : undefined}
      >
        <span
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] home-row-icon"
          style={{ backgroundColor: rgba(color, 0.12), color }}
        >
          <FaIcon icon={first.icon || 'fa-solid fa-layer-group'} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-800 truncate home-row-title">{first.title}</span>
            <span
              className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: rgba(color, 0.12), color }}
            >
              {row.items.length}
            </span>
          </span>
          <span className="block text-base text-slate-400 truncate">{labels.join(' · ')}</span>
        </span>
        <FontAwesomeIcon icon={['fas', expanded ? 'chevron-down' : 'chevron-right']} className="w-3 text-slate-400" />
      </button>

      <Collapse open={expanded}>
        <ul className="home-stagger mt-1 ml-7 border-l-2 pl-2 space-y-0.5" style={{ borderColor: rgba(color, 0.25) }}>
          {row.items.map((it, i) => (
            <HomeItem
              key={it.id}
              item={{ ...it, title: labels[i], subtitle: null }}
              color={color}
              onSelectProgram={onSelectProgram}
            />
          ))}
        </ul>
      </Collapse>
    </li>
  )
}

function readShowAll() {
  try { return sessionStorage.getItem(SHOW_ALL_KEY) === '1' } catch { return false }
}
function writeShowAll(v) {
  try { sessionStorage.setItem(SHOW_ALL_KEY, v ? '1' : '0') } catch { /* storage blocked */ }
}

// ────────── Single column ──────────
function HomeColumn({ group, showAll, leaving, onSelectProgram }) {
  const color = resolveHex(group.color)
  const fg    = pickTextOn(color)
  const count = mergeByTitle(group.items).length
  const rows  = mergeByTitle(visibleItems(group.items, showAll))
  // Rows that only exist under "Show more" slide in (staggered) and slide out before hiding.
  const defaultKeys = new Set(mergeByTitle(visibleItems(group.items, false)).map(r => r.key))
  let extraIdx = 0
  const rowAnim = (row) => {
    if (!showAll || defaultKeys.has(row.key)) return {}
    if (leaving) return { liClass: 'home-row-leave' }
    return { liClass: 'home-row-enter', liStyle: { animationDelay: `${Math.min(extraIdx++, 10) * 40}ms` } }
  }
  // Light header colors would vanish on the white icon circle, so fall back to dark text.
  const iconColor = fg === '#ffffff' ? color : '#1f2937'

  return (
    // The icon circle sits on the page background, so only the card below it
    // carries the border and fill. Card and circle lift together on hover,
    // with layered shadows tinted in the group color (iOS-style floating card).
    <div
      className="group flex flex-col items-center transition-transform duration-300 ease-out hover:-translate-y-1"
      style={{
        '--card-shadow': `0 1px 2px ${rgba(color, 0.10)}, 0 4px 12px -4px ${rgba(color, 0.18)}`,
        '--row-accent': color,
        '--row-accent-fg': fg,
        '--row-accent-text': iconColor,
        '--row-accent-shadow': rgba(color, 0.35),
        '--card-shadow-hover': `0 2px 4px ${rgba(color, 0.12)}, 0 10px 20px -8px ${rgba(color, 0.26)}`,
      }}
    >
      <div
        className="relative z-10 w-16 h-16 rounded-full bg-white border-4 flex items-center justify-center text-2xl"
        style={{ borderColor: color, color: iconColor, boxShadow: `0 3px 8px -2px ${rgba(color, 0.35)}` }}
      >
        <FaIcon icon={group.icon || 'fa-solid fa-grip'} />
      </div>
      <div
        className="w-full flex-1 -mt-8 rounded-[28px] border-2 backdrop-blur-xl overflow-hidden flex flex-col home-card"
        style={{
          borderColor: rgba(color, 0.55),
          background: `linear-gradient(180deg, ${rgba(color, 0.015)} 0%, ${rgba(color, 0.045)} 100%), #ffffff`,
        }}
      >
        {/* Header — title band under the centered icon circle */}
        <div
          className="relative w-full pt-10 pb-3 px-5 text-center"
          style={{
            background: `linear-gradient(135deg, ${color} 0%, ${rgba(color, 0.82)} 100%)`,
            color: fg,
          }}
        >
          <h3 className="font-display font-bold text-lg leading-tight truncate" style={{ color: fg }}>
            {group.title}
          </h3>
          {group.subtitle && (
            <p className="text-base mt-0.5 truncate" style={{ opacity: 0.85 }}>
              {group.subtitle}
            </p>
          )}
          {count > 0 && (
            <span
              className="absolute top-2 right-3 text-sm font-mono font-semibold px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: fg === '#ffffff' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.1)',
                color: fg,
              }}
              title={`${count} รายการ`}
            >
              {count}
            </span>
          )}
        </div>

        {/* Items */}
        <ul className="flex-1 p-2 space-y-0.5">
          {count === 0 ? (
            <li className="flex flex-col items-center justify-center text-center py-10 px-4 text-slate-400">
              <FontAwesomeIcon icon={['far', 'folder-open']} className="text-2xl mb-2 opacity-50" />
              <span className="text-base">ยังไม่มีรายการในกลุ่มนี้</span>
            </li>
          ) : (
            rows.map(row => row.items.length === 1
              ? <HomeItem key={row.items[0].id} item={row.items[0]} color={color} onSelectProgram={onSelectProgram} {...rowAnim(row)} />
              : <HomeItemGroup key={row.key} row={row} groupId={group.id} color={color} onSelectProgram={onSelectProgram} {...rowAnim(row)} />
            )
          )}
        </ul>
      </div>
    </div>
  )
}

// ────────── File Selection Modal (Popup) ──────────
// Handles two modes:
//   program        — list comes from item.filePaths (AD-group mappings, already resolved)
//   program_group  — list is fetched live from the server (files inside the mapped folder)
const PROGRAM_ICONS = {
  excel:   { icon: ['fas', 'file-excel'] },
  powerbi: { icon: ['fas', 'chart-bar'] },
  word:    { icon: ['fas', 'file-word'] },
  file:    { icon: ['fas', 'file-lines'] },
}
const OPENING_MS = 2500

/** Last folder name of a UNC/drive path — the full path lives in the tooltip. */
function parentFolder(p = '') {
  const parts = String(p).split(/[\\/]/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] : ''
}

function FileSelectionModal({ item, onClose }) {
  const isGroup = item?.linkType === 'program_group';
  const [groupFiles, setGroupFiles] = useState(null);
  const [loading, setLoading]       = useState(isGroup);
  const [error, setError]           = useState(null);
  const [opening, setOpening]       = useState(null);   // entry being launched
  const [closing, setClosing]       = useState(false);  // exit animation running

  useEffect(() => {
    if (!isGroup || !item?.id) return;
    let abort = false;
    setLoading(true);
    setError(null);
    api.get(`/api/home/items/${item.id}/files`)
      .then(r => { if (!abort) setGroupFiles(r.data?.files || []) })
      .catch(e => { if (!abort) setError(e.response?.data?.error || 'โหลดรายการไฟล์ไม่สำเร็จ') })
      .finally(() => { if (!abort) setLoading(false) });
    return () => { abort = true };
  }, [isGroup, item?.id]);

  // Esc closes; the ref always holds the latest requestClose.
  const closeRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.() };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!item) return null;

  const entries = isGroup
    ? (groupFiles || []).map(f => ({ name: f.fileName, path: f.filePath, adGroup: f.adGroup }))
    : (item.filePaths || []).map(fp => ({
        name: fp.filePath.split(/[\\/]/).pop() || fp.filePath,
        path: fp.filePath,
        adGroup: fp.adGroup,
      }));

  const color = resolveHex(item.groupColor);
  // One AD group for every file → show it once in the header instead of on each file.
  const adGroups = [...new Set(entries.map(en => en.adGroup).filter(Boolean))];
  const sharedAd = adGroups.length === 1 ? adGroups[0] : null;
  // Few files → big touch tiles; many → compact list.
  const asTiles = entries.length > 0 && entries.length <= 6;

  const info = PROGRAM_ICONS[String(item.programType).toLowerCase()] || PROGRAM_ICONS.file;

  // Exit animation first, then unmount.
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 200);
  };

  // kmportal:// takes a moment to launch the program, so show progress and
  // block a second tap before closing.
  const handleOpenPath = (en) => {
    if (opening) return;
    setOpening(en);
    window.location.href = `kmportal://open?type=${encodeURIComponent(item.programType || 'file')}&path=${encodeURIComponent(en.path)}`;
    setTimeout(requestClose, OPENING_MS);
  };

  closeRef.current = requestClose;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-2 ${closing ? 'modal-backdrop-out' : 'modal-backdrop-in'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={requestClose}
    >
      <div
        className={`bg-white rounded-[24px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col ${closing ? 'modal-panel-out' : 'modal-panel-in'}`}
        style={{ '--accent': color, '--accent-soft': rgba(color, 0.06) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" className="h-1.5" style={{ backgroundColor: color }} />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: rgba(color, 0.12), color }}
            >
              <FontAwesomeIcon icon={info.icon} />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-slate-800 text-xl leading-tight truncate">{item.title}</h3>
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                เลือกไฟล์ที่ต้องการเปิด
                {!loading && !error && <span className="text-slate-400">· {entries.length} ไฟล์</span>}
                {sharedAd && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    AD: {sharedAd}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={requestClose}
            title="ปิด"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <FontAwesomeIcon icon={['fas', 'xmark']} className="text-lg" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto bg-slate-50/60">
          {loading && (
            <div className="py-10 text-center text-base text-slate-400">
              <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="mr-2" />
              กำลังโหลดรายการไฟล์…
            </div>
          )}
          {!loading && error && (
            <div className="py-8 text-center text-base text-red-600">
              <FontAwesomeIcon icon={['fas', 'circle-exclamation']} className="mr-1" /> {error}
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="py-8 text-center text-base text-slate-400 italic">ไม่พบไฟล์ในโฟลเดอร์</div>
          )}

          {!loading && !error && asTiles && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {entries.map((en, idx) => {
                const isOpening = opening?.path === en.path;
                return (
                  <button
                    key={idx}
                    onClick={() => handleOpenPath(en)}
                    disabled={!!opening}
                    title={en.path}
                    className={`relative flex flex-col items-center text-center gap-2 px-4 py-5 rounded-2xl bg-white border-2 border-slate-200 transition-all hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] disabled:cursor-wait ${opening && !isOpening ? 'opacity-40' : ''}`}
                    style={isOpening ? { borderColor: color, backgroundColor: rgba(color, 0.06) } : undefined}
                  >
                    <span
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: rgba(color, 0.12), color }}
                    >
                      <FontAwesomeIcon icon={isOpening ? ['fas', 'circle-notch'] : info.icon} spin={isOpening} />
                    </span>
                    <span className="text-lg font-bold text-slate-800 leading-tight break-words line-clamp-2">{stripExt(en.name)}</span>
                    <span className="text-sm text-slate-400 truncate max-w-full">
                      {isOpening ? 'กำลังเปิด…' : parentFolder(en.path)}
                    </span>
                    {!sharedAd && en.adGroup && (
                      <span className="text-[11px] font-mono text-slate-400">AD: {en.adGroup}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !error && !asTiles && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((en, idx) => {
                const isOpening = opening?.path === en.path;
                return (
                  <button
                    key={idx}
                    onClick={() => handleOpenPath(en)}
                    disabled={!!opening}
                    title={en.path}
                    className={`w-full text-left min-h-[56px] px-4 py-3 rounded-xl bg-white border-2 border-slate-200 transition-all flex items-center gap-4 hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] disabled:cursor-wait ${opening && !isOpening ? 'opacity-40' : ''}`}
                    style={isOpening ? { borderColor: color } : undefined}
                  >
                    <FontAwesomeIcon
                      icon={isOpening ? ['fas', 'circle-notch'] : info.icon}
                      spin={isOpening}
                      className="w-5 text-xl flex-shrink-0"
                      style={{ color }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-slate-800 truncate">{stripExt(en.name)}</span>
                      <span className="block text-sm text-slate-400 truncate">
                        {isOpening ? 'กำลังเปิด…' : parentFolder(en.path)}
                        {!sharedAd && en.adGroup && ` · AD: ${en.adGroup}`}
                      </span>
                    </div>
                    <FontAwesomeIcon icon={['fas', 'chevron-right']} className="w-3 text-slate-300" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500 min-w-0 truncate">
            {opening && (
              <>
                <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="mr-2" style={{ color }} />
                กำลังเปิด <span className="font-semibold text-slate-700">{stripExt(opening.name)}</span>…
              </>
            )}
          </p>
          <button
            onClick={requestClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-base transition-colors flex-shrink-0"
          >
            {opening ? 'ปิด' : 'ยกเลิก'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ────────── Main layout ──────────
export default function HomeColumns() {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [selectedItemForSelect, setSelectedItemForSelect] = useState(null)
  const [showAll, setShowAll] = useState(readShowAll)

  const [leaving, setLeaving] = useState(false) // extra rows animating out before "Show less" applies

  const toggleShowAll = () => {
    if (leaving) return
    if (!showAll) {
      writeShowAll(true)
      setShowAll(true)
      return
    }
    setLeaving(true)
    setTimeout(() => {
      writeShowAll(false)
      setShowAll(false)
      setLeaving(false)
    }, ROW_LEAVE_MS)
  }

  useEffect(() => {
    let abort = false
    api.get('/api/home/data')
      .then(r => { if (!abort) setGroups(r.data?.groups || []) })
      .catch(e => { if (!abort) setError(e.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ') })
      .finally(() => { if (!abort) setLoading(false) })
    return () => { abort = true }
  }, [])

  if (loading) {
    return (
      <div className={`grid ${gridColsFor(3)} gap-4 lg:gap-6 mb-10`}>
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="skeleton h-20" />
            <div className="p-3 space-y-2">
              <div className="skeleton h-12 rounded-xl" />
              <div className="skeleton h-12 rounded-xl" />
              <div className="skeleton h-12 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="mb-10 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-base flex items-center gap-2">
        <FontAwesomeIcon icon={['fas', 'circle-exclamation']} />
        {error}
      </div>
    )
  }
  if (!groups.length) return null

  const hasHidden = groups.some(g => visibleItems(g.items, false).length < (g.items?.length || 0))
  return (
    <>
      <div className="mb-10">
        <div className={`grid ${gridColsFor(groups.length)} gap-4 lg:gap-6`}>
          {groups.map(g => (
            <HomeColumn key={g.id} group={g} showAll={showAll} leaving={leaving} onSelectProgram={setSelectedItemForSelect} />
          ))}
        </div>
        {hasHidden && (
          <button
            type="button"
            onClick={toggleShowAll}
            aria-expanded={showAll}
            className="show-more-btn group mt-8 w-full flex items-center justify-center gap-3 py-5 rounded-2xl border border-slate-300/60 bg-slate-200/50 backdrop-blur-sm font-display font-bold text-lg text-slate-700"
          >
            {showAll && !leaving ? 'Show less...' : 'Show more...'}
            <span className="show-more-chevron w-8 h-8 rounded-full flex items-center justify-center">
              <FontAwesomeIcon
                icon={['fas', 'chevron-down']}
                className={`w-3.5 transition-transform duration-300 ${showAll && !leaving ? 'rotate-180' : ''}`}
              />
            </span>
          </button>
        )}
      </div>
      {selectedItemForSelect && (
        <FileSelectionModal 
          item={selectedItemForSelect} 
          onClose={() => setSelectedItemForSelect(null)} 
        />
      )}
    </>
  )
}
