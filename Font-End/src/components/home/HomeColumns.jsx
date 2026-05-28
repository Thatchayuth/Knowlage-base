import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import api from '../../services/axios'
import { getFolderChildren, getFolderFiles } from '../../services/portal.service'

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
function fileBadge(file) {
  if (isPdf(file))   return { label: 'PDF', dot: 'bg-orange-400',  text: 'text-orange-500' }
  if (isExcel(file)) return { label: 'XLS', dot: 'bg-emerald-400', text: 'text-emerald-600' }
  return                    { label: 'VDO', dot: 'bg-purple-400',  text: 'text-purple-500' }
}

// ────────── Recursive folder node (mirrors PortalFolderItem) ──────────
function SubFolderNode({ folder, accent, depth = 0 }) {
  const [expanded, setExpanded] = useState(false)
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

  const handleToggle = useCallback(async () => {
    const next = !expanded
    setExpanded(next)
    if (next && children === null) await loadData()
  }, [expanded, children, loadData])

  return (
    <li>
      <div
        className="flex items-center gap-1.5 py-1 pr-2 rounded-md hover:bg-slate-50 transition-colors group"
        style={{ paddingLeft: `${4 + depth * 8}px` }}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
          aria-label={expanded ? 'ยุบ' : 'ขยาย'}
          title={expanded ? 'ยุบ' : 'ขยาย'}
        >
          {loading ? (
            <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="w-2.5" />
          ) : (
            <FontAwesomeIcon
              icon={['fas', 'chevron-right']}
              className={`w-2.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          )}
        </button>
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-base text-slate-700 hover:text-brand transition-colors text-left"
        >
          <FontAwesomeIcon icon={['fas', 'folder']} className="w-3 flex-shrink-0" style={{ color: accent }} />
          <span className="truncate font-medium">{folder.FolderName}</span>
          {folder._hasDirectAccess === false && (
            <FontAwesomeIcon icon={['fas', 'lock']} className="w-2.5 text-slate-400 flex-shrink-0" title="navigation เท่านั้น" />
          )}
        </button>
      </div>

      {expanded && !loading && (
        <ul
          className="ml-2.5 border-l pl-1.5 space-y-0.5"
          style={{ borderColor: rgba(accent, 0.2), marginLeft: `${10 + depth * 8}px` }}
        >
          {children?.map(child => (
            <SubFolderNode key={child.Id} folder={child} accent={accent} depth={depth + 1} />
          ))}
          {files?.map(f => <SubFileItem key={f.Id} file={f} />)}
          {children?.length === 0 && files?.length === 0 && (
            <li className="px-2 py-1 text-[11px] text-slate-400 italic">ไม่มีไฟล์</li>
          )}
        </ul>
      )}
    </li>
  )
}

// ────────── File leaf ──────────
function SubFileItem({ file }) {
  const navigate = useNavigate()
  const badge = fileBadge(file)
  if(badge.label === 'XLS') {
    const url = `kmportal://open?type=${encodeURIComponent(file.MimeType || 'file')}&path=${encodeURIComponent(file.FullPath || '')}`
    return (
      <li>
        <a href={url} className="w-full flex items-center gap-1.5 py-1 pl-1.5 pr-2 rounded-md text-left text-base text-slate-600 hover:bg-slate-50 hover:text-brand transition-colors group">
          <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${badge.dot}`} />
          <span className="truncate flex-1">{file.FileName}</span>
          <span className={`text-[9px] font-mono font-semibold flex-shrink-0 ${badge.text} opacity-70 group-hover:opacity-100`}>
            {badge.label}
          </span>
        </a>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/portal/file/${file.Id}`, { state: { file } })}
        className="w-full flex items-center gap-1.5 py-1 pl-1.5 pr-2 rounded-md text-left text-base text-slate-600 hover:bg-slate-50 hover:text-brand transition-colors group"
      >
        <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${badge.dot}`} />
        <span className="truncate flex-1">{file.FileName}</span>
        <span className={`text-[9px] font-mono font-semibold flex-shrink-0 ${badge.text} opacity-70 group-hover:opacity-100`}>
          {badge.label}
        </span>
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

  return (
    <ul className="mt-1 ml-7 border-l-2 pl-2 space-y-0.5" style={{ borderColor: rgba(accent, 0.25) }}>
      {children?.map(c => (
        <SubFolderNode key={c.Id} folder={c} accent={accent} depth={0} />
      ))}
      {files?.map(f => <SubFileItem key={f.Id} file={f} />)}
    </ul>
  )
}

// ────────── Single item ──────────
function HomeItem({ item, color }) {
  const [expanded, setExpanded] = useState(false)
  const hoverBg = rgba(color, 0.08)
  const iconBg  = rgba(color, 0.12)

  const handleEnter = (e) => { e.currentTarget.style.backgroundColor = hoverBg }
  const handleLeave = (e) => { e.currentTarget.style.backgroundColor = '' }

  const baseRow = 'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-base text-slate-700 transition-all duration-150'

  // Icon chip — colored, consistent, slightly scales on hover
  const IconChip = ({ icon, fallback }) => (
    <span
      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[18px] transition-transform group-hover:scale-105"
      style={{ backgroundColor: iconBg, color }}
    >
      <FaIcon icon={icon || fallback} />
    </span>
  )

  const Arrow = () => (
    <FontAwesomeIcon
      icon={['fas', 'arrow-right']}
      className="w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
      style={{ color }}
    />
  )

  // PROGRAM (locked / no access)
  if (item.linkType === 'program' && !item.hasAccess) {
    return (
      <li>
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed select-none bg-slate-50"
          title="คุณไม่มีสิทธิ์เข้าถึงไฟล์นี้"
        >
          <span className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-slate-200 text-slate-400">
            <FontAwesomeIcon icon={['fas', 'lock']} className="text-base" />
          </span>
          <span className="text-base line-through truncate flex-1">{item.title}</span>
          <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            no access
          </span>
        </div>
      </li>
    )
  }

  // PROGRAM
  if (item.linkType === 'program') {
    const url = `kmportal://open?type=${encodeURIComponent(item.programType || 'file')}&path=${encodeURIComponent(item.filePath || '')}`
    return (
      <li>
        <a href={url} onMouseEnter={handleEnter} onMouseLeave={handleLeave} className={baseRow}>
          <IconChip icon={item.icon} fallback="fa-solid fa-circle-play" />
          <span className="flex-1 min-w-0">
            <span className="block font-medium text-slate-800 truncate">{item.title}</span>
            {item.subtitle && <span className="block text-base text-slate-400 truncate">{item.subtitle}</span>}
          </span>
          <Arrow />
        </a>
      </li>
    )
  }

  // FOLDER
  if (item.linkType === 'folder') {
    return (
      <li>
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
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            className={`${baseRow} flex-1 pl-2 text-left`}
          >
            <IconChip icon={item.icon} fallback="fa-solid fa-folder" />
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-slate-800 truncate">{item.title || item.folderName}</span>
              {item.subtitle && <span className="block text-base text-slate-400 truncate">{item.subtitle}</span>}
            </span>
            <FontAwesomeIcon icon={['fas', expanded ? 'chevron-down' : 'chevron-right']} className="w-3 text-slate-400" />
          </button>
        </div>
        {expanded && <FolderSubList folderId={item.folderId} accent={color} />}
      </li>
    )
  }

  // KNOWLEDGE
  if (item.linkType === 'knowledge') {
    return (
      <li>
        <Link
          to={`/knowledge/${item.knowledgeId}`}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={baseRow}
        >
          <IconChip icon={item.icon} fallback="fa-solid fa-book" />
          <span className="flex-1 min-w-0">
            <span className="block font-medium text-slate-800 truncate">{item.title || item.knowledgeTitle}</span>
            {item.subtitle && <span className="block text-base text-slate-400 truncate">{item.subtitle}</span>}
          </span>
          <Arrow />
        </Link>
      </li>
    )
  }

  // EXTERNAL LINK
  if (item.linkType === 'external_link') {
    return (
      <li>
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={baseRow}
        >
          <IconChip icon={item.icon} fallback="fa-solid fa-arrow-up-right-from-square" />
          <span className="flex-1 min-w-0">
            <span className="block font-medium text-slate-800 truncate">{item.title}</span>
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

// ────────── Single column ──────────
function HomeColumn({ group }) {
  const color = resolveHex(group.color)
  const fg    = pickTextOn(color)
  const count = group.items?.length || 0

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow duration-200 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${rgba(color, 0.82)} 100%)`,
          color: fg,
        }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
          style={{ backgroundColor: fg === '#ffffff' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.1)' }}
        >
          <FaIcon icon={group.icon || 'fa-solid fa-grip'} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-bold text-lg leading-tight truncate" style={{ color: fg }}>
            {group.title}
          </h3>
          {group.subtitle && (
            <p className="text-base mt-0.5 truncate" style={{ opacity: 0.85 }}>
              {group.subtitle}
            </p>
          )}
        </div>
        {count > 0 && (
          <span
            className="flex-shrink-0 text-base font-mono font-semibold px-2.5 py-0.5 rounded-full"
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
      <ul className="flex-1 p-2 space-y-0.5 bg-white">
        {count === 0 ? (
          <li className="flex flex-col items-center justify-center text-center py-10 px-4 text-slate-400">
            <FontAwesomeIcon icon={['far', 'folder-open']} className="text-2xl mb-2 opacity-50" />
            <span className="text-base">ยังไม่มีรายการในกลุ่มนี้</span>
          </li>
        ) : (
          group.items.map(it => <HomeItem key={it.id} item={it} color={color} />)
        )}
      </ul>
    </div>
  )
}

// ────────── Main layout ──────────
export default function HomeColumns() {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-10">
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-10">
      {groups.map(g => <HomeColumn key={g.id} group={g} />)}
    </div>
  )
}
