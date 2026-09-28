import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { findIconDefinition } from '@fortawesome/fontawesome-svg-core'
import api from '../../services/axios'
import { useToast } from '../../components/ui/Toast'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Toggle from '../../components/ui/Toggle'
import Collapse from '../../components/ui/Collapse'
import { LoadingState, EmptyState, ErrorState, apiError } from '../../components/ui/States'

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
/** Is this FA class string one of the icons registered in the library? */
function faExists(cls) {
  if (!cls || !String(cls).trim()) return false
  const [prefix, iconName] = parseFa(cls)
  try { return !!findIconDefinition({ prefix, iconName }) } catch { return false }
}
function FaIcon({ icon, className = '', style }) {
  const def = icon && faExists(icon) ? parseFa(icon) : ['fas', icon ? 'circle-question' : 'circle']
  return <FontAwesomeIcon icon={def} className={className} style={style} />
}

// ────────── Color helpers ──────────
const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
const LEGACY = { blue: '#3B82F6', red: '#EF4444', green: '#10B981' }
const toHex  = (c) => (HEX_RE.test(c || '') ? c : (LEGACY[c] || '#3B82F6'))

function hexRgb(c) {
  const h = toHex(c).slice(1)
  const v = h.length === 3 ? h.split('').map(x => x + x).join('') : h
  return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16))
}
const rgba = (c, a) => { const [r, g, b] = hexRgb(c); return `rgba(${r}, ${g}, ${b}, ${a})` }
const isLight = (c) => { const [r, g, b] = hexRgb(c); return 0.299 * r + 0.587 * g + 0.114 * b > 170 }
/** Foreground that stays readable on a solid chip of this color. */
const inkOn = (c) => (isLight(c) ? '#030b2b' : '#ffffff')
/** The color itself as text/icon on white, darkened when it is too pale to read. */
const accentText = (c) => {
  if (!isLight(c)) return toHex(c)
  const [r, g, b] = hexRgb(c)
  return `rgb(${Math.round(r * 0.5)}, ${Math.round(g * 0.5)}, ${Math.round(b * 0.5)})`
}

const COLOR_PRESETS = [
  '#3B82F6', '#1E40AF', '#0EA5E9', // blues
  '#EF4444', '#B91C1C', '#F97316', // reds/orange
  '#10B981', '#047857', '#84CC16', // greens
  '#A855F7', '#7C3AED', '#EC4899', // purples/pink
  '#FFCC99', '#FBBF24', '#64748B', // pastels/gray
]

const ICON_PRESETS = [
  'fa-solid fa-folder',       'fa-solid fa-folder-open',  'fa-solid fa-briefcase',
  'fa-solid fa-clipboard-check', 'fa-solid fa-triangle-exclamation', 'fa-solid fa-info',
  'fa-solid fa-circle-info',  'fa-solid fa-bell',          'fa-solid fa-star',
  'fa-solid fa-chart-line',   'fa-solid fa-database',      'fa-solid fa-server',
  'fa-solid fa-file-excel',   'fa-solid fa-file-word',     'fa-solid fa-file-powerpoint',
  'fa-solid fa-chart-pie',    'fa-solid fa-book',          'fa-solid fa-globe',
]

const LINK_TYPES = [
  { value: 'program',       label: 'เปิดโปรแกรม',  icon: 'fa-solid fa-circle-play',           hint: 'ใช้ kmportal:// เปิดโปรแกรมในเครื่องของผู้ใช้' },
  { value: 'program_group', label: 'เปิดโปรแกรมแบบกลุ่ม', icon: 'fa-solid fa-layer-group',   hint: 'ชี้ path ไปยังโฟลเดอร์ — เมื่อคลิกจะแสดงไฟล์ทั้งหมดข้างในให้ผู้ใช้เลือกเปิด' },
  { value: 'folder',        label: 'โฟลเดอร์',      icon: 'fa-solid fa-folder',                 hint: 'ลิงก์ไปยังโฟลเดอร์ใน Portal' },
  { value: 'knowledge',     label: 'Knowledge',     icon: 'fa-solid fa-book',                   hint: 'ลิงก์ไปยังหน้า Knowledge Item' },
  { value: 'external_link', label: 'URL ภายนอก',    icon: 'fa-solid fa-arrow-up-right-from-square', hint: 'เปิดเว็บไซต์ภายนอก (เปิดแท็บใหม่)' },
]

const PROGRAM_TYPES = [
  { value: 'powerbi', label: 'Power BI', icon: 'fa-solid fa-chart-pie' },
  { value: 'excel',   label: 'Excel',    icon: 'fa-solid fa-file-excel' },
  { value: 'word',    label: 'Word',     icon: 'fa-solid fa-file-word' },
  { value: 'file',    label: 'ไฟล์อื่นๆ', icon: 'fa-solid fa-file' },
]

// ────────── Small UI primitives ──────────
function FieldError({ msg }) {
  if (!msg) return null
  return (
    <p className="field-error flex items-start gap-1.5" role="alert">
      <FontAwesomeIcon icon={['fas', 'circle-exclamation']} className="mt-1 flex-shrink-0" />
      <span>{msg}</span>
    </p>
  )
}

function Badge({ icon, children, className = '', style }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-sm font-medium whitespace-nowrap ${className}`} style={style}>
      {icon && <FontAwesomeIcon icon={['fas', icon]} className="text-xs" />}
      {children}
    </span>
  )
}

/** Numbered section inside the item form. */
function FormSection({ step, title, description, children }) {
  return (
    <section className="pt-6 first:pt-0 border-t border-slate-100 first:border-t-0">
      <header className="flex items-start gap-3 mb-4">
        <span className="w-8 h-8 rounded-full bg-brand-soft text-brand font-display font-bold text-base flex items-center justify-center flex-shrink-0">
          {step}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="font-display font-bold text-lg text-slate-800 leading-tight">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

function IconPicker({ value, onChange, accent = '#0a1855' }) {
  const [open, setOpen] = useState(false)
  const typed = String(value || '').trim()
  const found = faExists(typed)
  return (
    <div>
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
        <span
          className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-colors"
          style={{ backgroundColor: rgba(accent, 0.14), color: accentText(accent) }}
          title="ตัวอย่างไอคอน"
        >
          <FaIcon icon={typed} />
        </span>
        <input
          className="input-field flex-1 min-w-0"
          placeholder="fa-solid fa-folder"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          aria-label="Font Awesome class"
        />
        <button type="button" onClick={() => setOpen(v => !v)} className="btn-secondary w-full sm:w-auto" aria-expanded={open}>
          <FontAwesomeIcon icon={['fas', 'icons']} />
          เลือกจากตัวอย่าง
          <FontAwesomeIcon icon={['fas', 'chevron-down']} className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {typed && !found && (
        <p className="field-error flex items-center gap-1.5">
          <FontAwesomeIcon icon={['fas', 'circle-question']} />
          ไม่พบไอคอน “{typed}” — ตรวจสอบชื่อ class อีกครั้ง
        </p>
      )}

      {open && (
        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-1.5 p-2 border border-slate-200 rounded-2xl bg-slate-50">
          {ICON_PRESETS.map(ic => {
            const active = typed === ic
            return (
              <button key={ic} type="button" onClick={() => { onChange(ic); setOpen(false) }}
                className={`h-12 rounded-xl flex items-center justify-center text-lg transition-colors ${
                  active ? 'bg-brand text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-brand-soft hover:text-brand'
                }`}
                title={ic} aria-label={ic}>
                <FaIcon icon={ic} />
              </button>
            )
          })}
        </div>
      )}

      <p className="field-hint">
        ใส่ class ของ Font Awesome เช่น <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">fa-solid fa-folder</span> — ดูทั้งหมดได้ที่{' '}
        <a href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noreferrer" className="text-brand font-medium underline hover:text-navy-700">fontawesome.com</a>
      </p>
    </div>
  )
}

// ────────── Searchable select (lightweight combo) ──────────
// The option list renders inline (in the normal flow, pushing content down) so the
// scrolling modal body never clips it.
function SearchableSelect({
  value, onChange, options, loading, error,
  placeholder = 'ค้นหาแล้วเลือก…',
  emptyHint = 'ไม่พบรายการ',
  onRetry,
  invalid = false,
}) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [focusIdx, setFocusIdx] = useState(0)
  const rootRef = useRef(null)

  // Resolve current selected option (value may be number or string)
  const selected = options.find(o => String(o.id) === String(value))

  const norm = s => String(s || '').toLowerCase()
  const filtered = !query.trim()
    ? options
    : options.filter(o => {
        const q = norm(query)
        return norm(o.label).includes(q) || norm(o.sublabel).includes(q) || String(o.id) === query.trim()
      })

  // Reset focus when filter changes
  useEffect(() => { setFocusIdx(0) }, [query, open])

  // Close when clicking anywhere outside the control
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const close = () => { setOpen(false); setQuery('') }
  const pick  = (opt) => { onChange(opt.id); close() }

  const handleKey = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter')     { e.preventDefault(); const opt = filtered[focusIdx]; if (opt) pick(opt) }
    else if (e.key === 'Escape')    { e.stopPropagation(); close() } // don't let Esc also close the modal
  }

  return (
    <div ref={rootRef} onKeyDown={handleKey}>
      {/* Trigger / value display */}
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className={`input-field text-left flex items-center justify-between gap-3 h-auto py-2 ${
          open ? 'border-brand ring-4 ring-brand/10' : ''
        } ${invalid && !open ? '!border-red-400' : ''}`}
      >
        {selected ? (
          <span className="flex-1 min-w-0">
            <span className="block truncate font-medium text-slate-800">{selected.label}</span>
            {selected.sublabel && <span className="block truncate text-sm text-slate-500">{selected.sublabel}</span>}
          </span>
        ) : (
          <span className="flex-1 text-slate-400">{placeholder}</span>
        )}
        <span className="flex items-center gap-2 flex-shrink-0">
          {selected && (
            <span className="text-sm tabular-nums px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">#{selected.id}</span>
          )}
          <FontAwesomeIcon icon={['fas', 'chevron-down']} className={`text-slate-400 text-sm transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Inline option panel */}
      {open && (
        <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <FontAwesomeIcon icon={['fas', 'magnifying-glass']} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                className="input-field pl-11"
                placeholder="พิมพ์เพื่อค้นหา…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {loading && (
              <div className="px-4 py-6 text-center text-base text-slate-500">
                <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="mr-2" />
                กำลังโหลดข้อมูล…
              </div>
            )}
            {!loading && error && (
              <div className="px-4 py-6 text-center text-base text-red-600">
                <FontAwesomeIcon icon={['fas', 'circle-exclamation']} className="mr-1.5" />{error}
                {onRetry && (
                  <div className="mt-3">
                    <button type="button" onClick={onRetry} className="btn-secondary">
                      <FontAwesomeIcon icon={['fas', 'rotate-right']} />ลองโหลดอีกครั้ง
                    </button>
                  </div>
                )}
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-base text-slate-500">
                <FontAwesomeIcon icon={['fas', 'inbox']} className="mr-1.5" />{emptyHint}
              </div>
            )}
            {!loading && !error && filtered.map((o, idx) => {
              const active = String(o.id) === String(value)
              const focused = idx === focusIdx
              return (
                <button
                  key={o.id}
                  type="button"
                  onMouseEnter={() => setFocusIdx(idx)}
                  onClick={() => pick(o)}
                  className={`w-full min-h-[48px] text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                    active ? 'bg-brand-soft' : focused ? 'bg-slate-50' : ''
                  }`}
                >
                  {o.icon && <FaIcon icon={o.icon} className="text-slate-500 w-5 text-center flex-shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate text-base ${active ? 'font-semibold text-brand' : 'text-slate-800'}`}>{o.label}</span>
                    {o.sublabel && <span className="block truncate text-sm text-slate-500">{o.sublabel}</span>}
                  </span>
                  <span className="text-sm tabular-nums px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 flex-shrink-0">#{o.id}</span>
                  {active && <FontAwesomeIcon icon={['fas', 'check']} className="text-brand flex-shrink-0" />}
                </button>
              )
            })}
          </div>

          {!loading && !error && options.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 text-sm text-slate-500 bg-slate-50 flex items-center justify-between gap-3">
              <span>{filtered.length} / {options.length} รายการ</span>
              <span className="hidden sm:inline">ใช้ปุ่ม ↑ ↓ เพื่อเลื่อน และ Enter เพื่อเลือก</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ────────── Data hooks for select options ──────────
function useFolderOptions(enabled) {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [trigger, setTrigger] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let abort = false
    setLoading(true); setError(null)
    api.get('/api/portal/admin/folders')
      .then(r => {
        if (abort) return
        const list = (r.data?.data || r.data || []).map(f => ({
          id:       f.Id,
          label:    f.FolderName,
          sublabel: f.FullPath || '',
          icon:     f.Icon ? `fa-solid fa-${f.Icon}` : 'fa-solid fa-folder',
        }))
        // sort by FullPath for readability
        list.sort((a, b) => (a.sublabel || a.label).localeCompare(b.sublabel || b.label, 'th'))
        setOptions(list)
      })
      .catch(e => { if (!abort) setError(apiError(e, 'โหลดรายการโฟลเดอร์ไม่สำเร็จ')) })
      .finally(() => { if (!abort) setLoading(false) })
    return () => { abort = true }
  }, [enabled, trigger])

  return { options, loading, error, reload: () => setTrigger(t => t + 1) }
}

function useKnowledgeOptions(enabled) {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [trigger, setTrigger] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let abort = false
    setLoading(true); setError(null)
    api.get('/api/menu')
      .then(r => {
        if (abort) return
        const menu = r.data?.data || []
        const list = []
        const iconFor = (it) => it.displayMode === 'PDF' ? 'fa-solid fa-file-pdf'
          : it.displayMode === 'LINK' ? 'fa-solid fa-link'
          : 'fa-solid fa-file-lines'
        for (const l1 of menu) {
          // direct items under L1
          for (const it of (l1.directItems || [])) {
            list.push({ id: it.id, label: it.title, sublabel: l1.name, icon: iconFor(it) })
          }
          for (const l2 of (l1.level2 || [])) {
            for (const it of (l2.items || [])) {
              list.push({ id: it.id, label: it.title, sublabel: `${l1.name} › ${l2.name}`, icon: iconFor(it) })
            }
          }
        }
        list.sort((a, b) => a.label.localeCompare(b.label, 'th'))
        setOptions(list)
      })
      .catch(e => { if (!abort) setError(apiError(e, 'โหลดรายการ Knowledge ไม่สำเร็จ')) })
      .finally(() => { if (!abort) setLoading(false) })
    return () => { abort = true }
  }, [enabled, trigger])

  return { options, loading, error, reload: () => setTrigger(t => t + 1) }
}

function ColorPicker({ value, onChange, invalid }) {
  const v = toHex(value)
  return (
    <div>
      <div className="flex items-center gap-2">
        <input type="color" value={v} onChange={e => onChange(e.target.value.toUpperCase())}
               className="w-14 h-11 p-1 rounded-xl cursor-pointer border border-slate-200 bg-white flex-shrink-0"
               aria-label="เลือกสี" />
        <input className={`input-field flex-1 uppercase ${invalid ? '!border-red-400' : ''}`}
               value={value || ''} placeholder="#FFCC99"
               onChange={e => onChange(e.target.value)}
               aria-label="รหัสสี HEX" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {COLOR_PRESETS.map(c => {
          const active = v.toLowerCase() === c.toLowerCase()
          return (
            <button key={c} type="button" onClick={() => onChange(c)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-150 hover:scale-105 ${
                active ? 'ring-2 ring-offset-2 ring-slate-700' : 'shadow-sm ring-1 ring-black/5'
              }`}
              style={{ backgroundColor: c, color: inkOn(c) }}
              title={c} aria-label={`สี ${c}`} aria-pressed={active}>
              {active && <FontAwesomeIcon icon={['fas', 'check']} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ────────── Group editor ──────────
// group = null → "add column" mode (POST); otherwise edits that group (PUT).
function GroupEditor({ group, onSave, onCancel }) {
  const isNew = !group
  const [title, setTitle]       = useState(group?.Title || '')
  const [subtitle, setSubtitle] = useState(group?.Subtitle || '')
  const [icon, setIcon]         = useState(group?.Icon || 'fa-solid fa-folder')
  const [color, setColor]       = useState(toHex(group?.Color))
  const [enabled, setEnabled]   = useState(isNew ? true : !!group.IsEnabled)
  const [saving, setSaving]     = useState(false)
  const [errors, setErrors]     = useState({})
  const { toast } = useToast()

  const handleSave = async () => {
    const errs = {}
    if (!title.trim()) errs.title = 'กรุณากรอกชื่อหัวข้อ'
    if (!HEX_RE.test(color)) errs.color = 'กรุณาใส่สีในรูปแบบ HEX เช่น #FFCC99'
    setErrors(errs)
    if (Object.keys(errs).length) { toast({ message: Object.values(errs)[0], type: 'error' }); return }
    setSaving(true)
    try {
      // sortOrder is left out: position is changed only by the move up/down buttons
      const payload = { title: title.trim(), subtitle, icon, color: color.toUpperCase(), isEnabled: enabled }
      const r = isNew
        ? await api.post('/api/admin/home/groups', payload)
        : await api.put(`/api/admin/home/groups/${group.Id}`, payload)
      toast({ message: isNew ? 'เพิ่มคอลัมน์สำเร็จ' : 'บันทึกการตั้งค่าคอลัมน์สำเร็จ', type: 'success' })
      onSave?.(r.data)
    } catch (e) {
      toast({ message: apiError(e, 'บันทึกไม่สำเร็จ'), type: 'error' })
    } finally { setSaving(false) }
  }

  const accent = toHex(color)

  const fields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
      <div>
        <label className="field-label" htmlFor={`g-title-${group?.Id ?? 'new'}`}>ชื่อหัวข้อ <span className="text-red-500">*</span></label>
        <input id={`g-title-${group?.Id ?? 'new'}`} className={`input-field ${errors.title ? '!border-red-400' : ''}`}
               value={title} placeholder="เช่น รายงานประจำวัน"
               onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: undefined })) }} />
        <FieldError msg={errors.title} />
      </div>
      <div>
        <label className="field-label" htmlFor={`g-sub-${group?.Id ?? 'new'}`}>คำอธิบายย่อย</label>
        <input id={`g-sub-${group?.Id ?? 'new'}`} className="input-field" value={subtitle || ''}
               placeholder="ข้อความสั้นๆ ใต้หัวข้อ (ถ้ามี)"
               onChange={e => setSubtitle(e.target.value)} />
      </div>

      <div className="md:col-span-2">
        <span className="field-label">ไอคอน (Font Awesome)</span>
        <IconPicker value={icon} onChange={setIcon} accent={accent} />
      </div>

      <div className="md:col-span-2">
        <span className="field-label">สีประจำคอลัมน์ (HEX)</span>
        <ColorPicker value={color} invalid={!!errors.color}
                     onChange={(c) => { setColor(c); setErrors(p => ({ ...p, color: undefined })) }} />
        <FieldError msg={errors.color} />
        <p className="field-hint">ใช้เป็นสีหัวคอลัมน์และสีไอคอนของรายการบนหน้าแรก</p>
      </div>

      <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
        <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'เปิดใช้งาน — แสดงบนหน้าแรก' : 'ปิดใช้งาน — ซ่อนจากหน้าแรก'} />
      </div>
    </div>
  )

  const actions = (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-5 mt-5 border-t border-slate-100">
      {onCancel && (
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          ยกเลิก
        </button>
      )}
      <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
        {saving
          ? <><FontAwesomeIcon icon={['fas', 'circle-notch']} spin />กำลังบันทึก…</>
          : isNew
            ? <><FontAwesomeIcon icon={['fas', 'plus']} />เพิ่มคอลัมน์</>
            : <><FontAwesomeIcon icon={['fas', 'floppy-disk']} />บันทึกการตั้งค่าคอลัมน์</>}
      </button>
    </div>
  )

  if (isNew) {
    return (
      <div className="admin-card overflow-hidden animate-fade-in">
        <div className="h-1.5 transition-colors" style={{ backgroundColor: accent }} />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-colors"
                  style={{ backgroundColor: accent, color: inkOn(accent) }}>
              <FaIcon icon={icon} />
            </span>
            <div>
              <h2 className="font-display font-bold text-xl text-slate-800">เพิ่มคอลัมน์ใหม่</h2>
              <p className="text-sm text-slate-500">คอลัมน์ใหม่จะต่อท้ายรายการ — เปลี่ยนลำดับได้ภายหลังด้วยปุ่มลูกศร</p>
            </div>
          </div>
          {fields}
          {actions}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-display font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={['fas', 'sliders']} className="text-brand" />
        ตั้งค่าคอลัมน์
      </h3>
      {fields}
      {actions}
    </div>
  )
}

// ────────── Item form modal ──────────
function ItemForm({ open, groupId, groupTitle, groupColor, initial, onClose, onSaved }) {
  const isEdit = !!initial?.Id
  const [title, setTitle]             = useState(initial?.Title || '')
  const [subtitle, setSubtitle]       = useState(initial?.Subtitle || '')
  const [icon, setIcon]               = useState(initial?.Icon || 'fa-solid fa-circle')
  const [linkType, setLinkType]       = useState(initial?.LinkType || 'program')
  const [programType, setProgramType] = useState(initial?.ProgramType || 'powerbi')
  const [folderId, setFolderId]       = useState(initial?.FolderId || '')
  const [knowledgeId, setKnowledgeId] = useState(initial?.KnowledgeId || '')
  const [externalUrl, setExternalUrl] = useState(initial?.ExternalUrl || '')
  const [enabled, setEnabled]         = useState(initial?.IsEnabled !== false)
  const [pinned, setPinned]           = useState(!!initial?.IsPinned)
  const [sortOrder, setSortOrder]     = useState(initial?.SortOrder ?? 0)
  const [mappings, setMappings]       = useState(
    initial?.Mappings?.map(m => ({ adGroup: m.AdGroup, filePath: m.FilePath })) || []
  )
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [errors, setErrors] = useState({}) // field → message (client check or server 400)
  const { toast } = useToast()

  // Dirty tracking: compare the current form against a snapshot taken on mount.
  const snapshot = () => JSON.stringify({
    title, subtitle, icon, linkType, programType,
    folderId: String(folderId ?? ''), knowledgeId: String(knowledgeId ?? ''),
    externalUrl, enabled, pinned, sortOrder: String(sortOrder ?? ''), mappings,
  })
  const [initialSnap] = useState(snapshot)
  const dirty = snapshot() !== initialSnap

  // Lazy-load options only when needed
  const folderQ    = useFolderOptions(linkType === 'folder')
  const knowledgeQ = useKnowledgeOptions(linkType === 'knowledge')

  const clearErr = (key) => setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev))
  const addMapping = () => { setMappings(prev => [...prev, { adGroup: '', filePath: '' }]); clearErr('mappings') }
  const updateMapping = (i, key, val) => { setMappings(prev => prev.map((m, idx) => idx === i ? { ...m, [key]: val } : m)); clearErr('mappings') }
  const removeMapping = (i) => setMappings(prev => prev.filter((_, idx) => idx !== i))

  const isProgram = linkType === 'program' || linkType === 'program_group'

  // Same rules as the backend: every linkType needs its target.
  const validate = () => {
    const errs = {}
    if (!title.trim()) errs.title = 'กรุณากรอกชื่อรายการ'
    if (linkType === 'folder' && !folderId) errs.folderId = 'กรุณาเลือกโฟลเดอร์'
    if (linkType === 'knowledge' && !knowledgeId) errs.knowledgeId = 'กรุณาเลือก Knowledge Item'
    if (linkType === 'external_link') {
      const u = externalUrl.trim()
      if (!u) errs.externalUrl = 'กรุณากรอก URL'
      else if (!/^https?:\/\/\S+$/i.test(u)) errs.externalUrl = 'URL ต้องขึ้นต้นด้วย http:// หรือ https://'
    }
    if (isProgram) {
      const partial = mappings.some(m => !m.adGroup.trim() !== !m.filePath.trim())
      if (partial) errs.mappings = 'กรอก AD Group และ Path ให้ครบทุกแถว (หรือลบแถวที่ไม่ใช้)'
      else if (!mappings.some(m => m.adGroup.trim() && m.filePath.trim())) {
        errs.mappings = 'กรุณาเพิ่มการจับคู่ AD Group → Path อย่างน้อย 1 รายการ'
      }
    }
    return errs
  }

  const handleSave = async () => {
    const clientErrs = validate()
    setErrors(clientErrs)
    if (Object.keys(clientErrs).length) {
      toast({ message: Object.values(clientErrs)[0], type: 'error' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        groupId,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        icon: icon.trim() || null,
        linkType,
        programType: (linkType === 'program' || linkType === 'program_group') ? programType : null,
        folderId:    linkType === 'folder' ? Number(folderId) || null : null,
        knowledgeId: linkType === 'knowledge' ? Number(knowledgeId) || null : null,
        externalUrl: linkType === 'external_link' ? externalUrl.trim() : null,
        sortOrder: Number(sortOrder) || 0,
        isEnabled: enabled,
        isPinned: pinned,
        mappings: isProgram
          ? mappings
              .map(m => ({ adGroup: m.adGroup.trim(), filePath: m.filePath.trim() }))
              .filter(m => m.adGroup && m.filePath)
          : [],
      }
      if (isEdit) await api.put(`/api/admin/home/items/${initial.Id}`, payload)
      else        await api.post('/api/admin/home/items', payload)
      toast({ message: isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มรายการสำเร็จ', type: 'success' })
      onSaved?.()
      onClose?.()
    } catch (e) {
      // Server 400 → { error, errors: [{ path, msg }] } — show next to the field
      const serverErrs = {}
      for (const er of e.response?.data?.errors || []) {
        const key = String(er.path || '').startsWith('mappings') ? 'mappings' : er.path
        if (key && !serverErrs[key]) serverErrs[key] = er.msg
      }
      setErrors(serverErrs)
      toast({ message: apiError(e, 'บันทึกไม่สำเร็จ'), type: 'error' })
    } finally { setSaving(false) }
  }

  // Esc / backdrop / X / ยกเลิก all come here; ask before throwing away edits.
  const requestClose = () => {
    if (saving || confirmDiscard) return
    if (dirty) setConfirmDiscard(true)
    else onClose?.()
  }

  const color = toHex(groupColor)
  const activeType = LINK_TYPES.find(t => t.value === linkType)

  const headerIcon = (
    <span className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: rgba(color, 0.14), color: accentText(color) }}>
      <FontAwesomeIcon icon={['fas', isEdit ? 'pen-to-square' : 'plus']} />
    </span>
  )

  const footer = (
    <>
      <span className="mr-auto self-center text-sm text-slate-500 hidden sm:inline">
        {dirty ? <><FontAwesomeIcon icon={['fas', 'circle']} className="text-[8px] text-amber-500 mr-2 align-middle" />มีการแก้ไขที่ยังไม่บันทึก</> : null}
      </span>
      <button type="button" className="btn-secondary" onClick={requestClose} disabled={saving}>
        ยกเลิก
      </button>
      <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
        {saving
          ? <><FontAwesomeIcon icon={['fas', 'circle-notch']} spin />กำลังบันทึก…</>
          : <><FontAwesomeIcon icon={['fas', 'check']} />{isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}</>}
      </button>
    </>
  )

  return (
    <>
      <Modal
        isOpen={open}
        onClose={requestClose}
        busy={saving}
        size="xl"
        icon={headerIcon}
        title={isEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
        subtitle={groupTitle ? `ในคอลัมน์ “${groupTitle}”` : 'กรอกข้อมูลให้ครบแล้วกดบันทึก'}
        footer={footer}
      >
        <div className="space-y-6">
          {/* Section 1: ข้อมูลทั่วไป */}
          <FormSection step={1} title="ข้อมูลทั่วไป" description="ชื่อ คำอธิบาย และไอคอนที่ผู้ใช้จะเห็นบนหน้าแรก">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="field-label" htmlFor="item-title">ชื่อรายการ <span className="text-red-500">*</span></label>
                <input id="item-title" className={`input-field ${errors.title ? '!border-red-400' : ''}`} value={title}
                       onChange={e => { setTitle(e.target.value); clearErr('title') }}
                       placeholder="เช่น Power BI - Production Dashboard" />
                <FieldError msg={errors.title} />
              </div>
              <div>
                <label className="field-label" htmlFor="item-subtitle">คำอธิบายย่อย (ถ้ามี)</label>
                <input id="item-subtitle" className="input-field" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <span className="field-label">ไอคอน</span>
                <IconPicker value={icon} onChange={setIcon} accent={color} />
              </div>
            </div>
          </FormSection>

          {/* Section 2: ประเภทลิงก์ */}
          <FormSection step={2} title="ประเภทลิงก์" description="เมื่อผู้ใช้คลิกรายการนี้ จะให้เกิดอะไรขึ้น">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="radiogroup" aria-label="ประเภทลิงก์">
              {LINK_TYPES.map(t => {
                const active = linkType === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLinkType(t.value)}
                    className={`min-h-[96px] p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 text-center transition-all duration-200 ${
                      active ? 'border-brand bg-brand-soft text-brand shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40 hover:bg-slate-50'
                    }`}
                  >
                    <FaIcon icon={t.icon} className="text-2xl" />
                    <span className="text-base font-semibold leading-tight">{t.label}</span>
                  </button>
                )
              })}
            </div>
            {activeType && (
              <p className="field-hint flex items-start gap-2">
                <FontAwesomeIcon icon={['fas', 'circle-info']} className="mt-1 text-brand flex-shrink-0" />
                <span>{activeType.hint}</span>
              </p>
            )}
          </FormSection>

          {/* Section 3: ตั้งค่าตามประเภท */}
          <FormSection step={3} title="ตั้งค่าปลายทาง" description={activeType ? `รายละเอียดสำหรับ “${activeType.label}”` : undefined}>
            {isProgram && (
              <div className="space-y-6">
                <div>
                  <span className="field-label">ชนิดโปรแกรม</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {PROGRAM_TYPES.map(p => (
                      <button key={p.value} type="button" onClick={() => setProgramType(p.value)}
                        aria-pressed={programType === p.value}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-base font-medium flex items-center justify-center gap-2 transition-colors ${
                          programType === p.value ? 'bg-brand text-white shadow-sm' : 'bg-white border border-slate-200 hover:border-brand/40 hover:bg-slate-50 text-slate-700'
                        }`}>
                        <FaIcon icon={p.icon} />{p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="field-label">
                    {linkType === 'program_group' ? 'การจับคู่ AD Group → Folder Path' : 'การจับคู่ AD Group → File Path'}
                    <span className="text-red-500"> *</span>
                  </span>
                  <div className="rounded-2xl bg-brand-soft/60 border border-brand/10 px-4 py-3 mb-3 text-sm text-slate-600 leading-relaxed">
                    {linkType === 'program_group' ? (
                      <p>ชี้ path ไปยังโฟลเดอร์ — เมื่อผู้ใช้คลิก ระบบจะแสดงไฟล์ทั้งหมดในโฟลเดอร์ให้เลือกเปิด</p>
                    ) : (
                      <>
                        <p className="mb-1.5">ผู้ใช้ในกลุ่มที่ตรงกันจะเปิดไฟล์ที่กำหนด (ใช้แถวแรกที่ตรง) — Path รองรับ 3 แบบ:</p>
                        <ul className="list-disc pl-5 space-y-0.5">
                          <li>ไฟล์ตรงตัว — ถ้าไฟล์ถูกเปลี่ยนชื่อ ระบบจะหาไฟล์ที่ใกล้เคียงที่สุดในโฟลเดอร์เดียวกันให้อัตโนมัติ</li>
                          <li>โฟลเดอร์ (ลงท้ายด้วย <span className="font-mono">\</span>) — เปิดไฟล์ที่แก้ไขล่าสุด</li>
                          <li>Wildcard เช่น <span className="font-mono">L1-2-Data*.xlsm</span> — เปิดไฟล์ที่ตรงรูปแบบและแก้ไขล่าสุด</li>
                        </ul>
                      </>
                    )}
                  </div>

                  {mappings.length === 0 ? (
                    <div className="text-center text-base text-slate-500 py-6 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60">
                      ยังไม่มีการจับคู่ — กด “เพิ่มการจับคู่” ด้านล่าง
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Column captions (desktop) */}
                      <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 pr-12 text-sm font-semibold text-slate-500">
                        <span>AD Group</span>
                        <span>{linkType === 'program_group' ? 'Folder Path' : 'File Path'}</span>
                      </div>
                      {mappings.map((m, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 md:p-0 rounded-2xl md:rounded-none border md:border-0 border-slate-200 bg-slate-50/60 md:bg-transparent">
                          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
                            <div>
                              <span className="md:hidden block text-sm font-semibold text-slate-500 mb-1">AD Group</span>
                              <input className="input-field font-mono"
                                placeholder="เช่น dt-staff"
                                aria-label={`AD Group แถวที่ ${i + 1}`}
                                value={m.adGroup}
                                onChange={e => updateMapping(i, 'adGroup', e.target.value)} />
                            </div>
                            <div>
                              <span className="md:hidden block text-sm font-semibold text-slate-500 mb-1">
                                {linkType === 'program_group' ? 'Folder Path' : 'File Path'}
                              </span>
                              <input className="input-field font-mono"
                                placeholder={linkType === 'program_group' ? '\\\\server\\share\\reports-folder' : '\\\\server\\share\\file.pbix'}
                                aria-label={`Path แถวที่ ${i + 1}`}
                                value={m.filePath}
                                onChange={e => updateMapping(i, 'filePath', e.target.value)} />
                            </div>
                          </div>
                          <button type="button" onClick={() => removeMapping(i)}
                            className="btn-icon btn-icon-danger mt-0.5" title="ลบแถวนี้" aria-label={`ลบแถวที่ ${i + 1}`}>
                            <FontAwesomeIcon icon={['fas', 'trash-can']} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <FieldError msg={errors.mappings} />
                  <button type="button" onClick={addMapping} className="btn-secondary mt-3">
                    <FontAwesomeIcon icon={['fas', 'plus']} />เพิ่มการจับคู่
                  </button>
                </div>
              </div>
            )}

            {linkType === 'folder' && (
              <div>
                <span className="field-label">เลือกโฟลเดอร์ <span className="text-red-500">*</span></span>
                <SearchableSelect
                  value={folderId}
                  onChange={(id) => { setFolderId(id); clearErr('folderId') }}
                  options={folderQ.options}
                  loading={folderQ.loading}
                  error={folderQ.error}
                  onRetry={folderQ.reload}
                  invalid={!!errors.folderId}
                  placeholder="ค้นหาโฟลเดอร์… (พิมพ์ชื่อหรือ path)"
                  emptyHint="ไม่พบโฟลเดอร์ที่ตรงคำค้น"
                />
                <FieldError msg={errors.folderId} />
                <p className="field-hint">ค้นหาได้ด้วยชื่อหรือ Full Path ของโฟลเดอร์</p>
              </div>
            )}

            {linkType === 'knowledge' && (
              <div>
                <span className="field-label">เลือก Knowledge Item <span className="text-red-500">*</span></span>
                <SearchableSelect
                  value={knowledgeId}
                  onChange={(id) => { setKnowledgeId(id); clearErr('knowledgeId') }}
                  options={knowledgeQ.options}
                  loading={knowledgeQ.loading}
                  error={knowledgeQ.error}
                  onRetry={knowledgeQ.reload}
                  invalid={!!errors.knowledgeId}
                  placeholder="ค้นหา Knowledge… (พิมพ์ชื่อหรือหมวด)"
                  emptyHint="ไม่พบ Knowledge ที่ตรงคำค้น"
                />
                <FieldError msg={errors.knowledgeId} />
                <p className="field-hint">ค้นหาได้ด้วยชื่อหัวข้อหรือชื่อหมวด (Level 1 / Level 2)</p>
              </div>
            )}

            {linkType === 'external_link' && (
              <div>
                <label className="field-label" htmlFor="item-url">URL <span className="text-red-500">*</span></label>
                <input id="item-url" type="url" inputMode="url"
                       className={`input-field ${errors.externalUrl ? '!border-red-400' : ''}`}
                       value={externalUrl}
                       onChange={e => { setExternalUrl(e.target.value); clearErr('externalUrl') }}
                       placeholder="https://example.com" />
                <FieldError msg={errors.externalUrl} />
                <p className="field-hint">ลิงก์จะเปิดในแท็บใหม่ — รองรับเฉพาะ http:// และ https://</p>
              </div>
            )}
          </FormSection>

          {/* Section 4: การแสดงผล */}
          <FormSection step={4} title="การแสดงผล" description="ลำดับ สถานะ และการแสดงบนหน้าแรก">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="field-label" htmlFor="item-sort">ลำดับการแสดง</label>
                <input id="item-sort" type="number" className="input-field" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
                <p className="field-hint">เลขน้อยแสดงก่อน</p>
              </div>
              <div>
                <span className="field-label">สถานะ</span>
                <div className="min-h-[44px] flex items-center">
                  <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน (ไม่แสดงบนหน้าแรก)'} />
                </div>
              </div>
              <div className={`md:col-span-2 rounded-2xl border px-4 py-4 transition-colors ${pinned ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
                <Toggle checked={pinned} onChange={setPinned} label={<span className="font-semibold">แสดงตั้งแต่แรก</span>} />
                <p className="field-hint">
                  {pinned
                    ? 'รายการนี้จะแสดงในคอลัมน์ทันทีโดยไม่ต้องกด “แสดงเพิ่มเติม”'
                    : 'ค่าเริ่มต้น: รายการจะถูกซ่อนไว้ใต้ปุ่ม “แสดงเพิ่มเติม” (Show more) ของคอลัมน์ — เปิดตัวเลือกนี้หากต้องการให้แสดงทันที'}
                </p>
              </div>
            </div>
          </FormSection>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => { setConfirmDiscard(false); onClose?.() }}
        title="ทิ้งการแก้ไข?"
        message="ข้อมูลที่กรอกไว้ในฟอร์มนี้ยังไม่ได้บันทึก หากปิดตอนนี้การแก้ไขทั้งหมดจะหายไป"
        confirmText="ทิ้งการแก้ไข"
        cancelText="กลับไปแก้ไขต่อ"
        isDangerous
      />
    </>
  )
}

// ────────── Items list (per group) ──────────
function targetSummary(it) {
  const prog = PROGRAM_TYPES.find(p => p.value === it.ProgramType)?.label || it.ProgramType || ''
  const n = it.Mappings?.length || 0
  switch (it.LinkType) {
    case 'program':       return { icon: 'users',       text: `${prog} · จับคู่ ${n} กลุ่ม AD` }
    case 'program_group': return { icon: 'folder-tree', text: `${prog} · ${n} โฟลเดอร์ตามกลุ่ม AD` }
    case 'folder':        return { icon: 'folder',      text: `โฟลเดอร์ #${it.FolderId ?? '-'}` }
    case 'knowledge':     return { icon: 'book',        text: `Knowledge #${it.KnowledgeId ?? '-'}` }
    case 'external_link': return { icon: 'link',        text: it.ExternalUrl || '-' }
    default:              return { icon: 'circle-question', text: '-' }
  }
}

function ItemsList({ items, color, onEdit, onDelete, onAdd }) {
  if (!items?.length) {
    return (
      <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-2xl">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
          <FontAwesomeIcon icon={['fas', 'box-open']} />
        </div>
        <p className="text-base text-slate-500">ยังไม่มีรายการในคอลัมน์นี้</p>
        <button type="button" onClick={onAdd} className="btn-secondary mt-4">
          <FontAwesomeIcon icon={['fas', 'plus']} />เพิ่มรายการแรก
        </button>
      </div>
    )
  }
  const chipBg = rgba(color, 0.14)
  const chipFg = accentText(color)
  return (
    <ul className="space-y-2">
      {items.map(it => {
        const type = LINK_TYPES.find(t => t.value === it.LinkType)
        const target = targetSummary(it)
        return (
          <li key={it.Id}
              className={`flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200 ${
                it.IsEnabled ? '' : 'bg-slate-50/80'
              }`}>
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${it.IsEnabled ? '' : 'opacity-50'}`}
                  style={{ backgroundColor: chipBg, color: chipFg }}>
              <FaIcon icon={it.Icon} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-semibold text-base truncate max-w-full ${it.IsEnabled ? 'text-slate-800' : 'text-slate-500'}`}>{it.Title}</span>
                <Badge className="bg-brand-soft text-brand">
                  {type && <FaIcon icon={type.icon} className="text-xs" />}
                  {type?.label || it.LinkType}
                </Badge>
                {it.IsPinned && <Badge icon="thumbtack" className="bg-amber-50 text-amber-700 border border-amber-200">แสดงตั้งแต่แรก</Badge>}
                {!it.IsEnabled && <Badge icon="eye-slash" className="bg-slate-200 text-slate-600">ปิดใช้งาน</Badge>}
              </div>
              <div className="mt-1 text-sm text-slate-500 flex items-center gap-1.5 min-w-0">
                <FontAwesomeIcon icon={['fas', target.icon]} className="flex-shrink-0 text-slate-400" />
                <span className="truncate">{target.text}</span>
                <span className="flex-shrink-0 text-slate-400">· ลำดับ {it.SortOrder ?? 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button type="button" onClick={() => onEdit(it)} className="btn-icon" title="แก้ไขรายการ" aria-label={`แก้ไข ${it.Title}`}>
                <FontAwesomeIcon icon={['fas', 'pen-to-square']} />
              </button>
              <button type="button" onClick={() => onDelete(it)} className="btn-icon btn-icon-danger" title="ลบรายการ" aria-label={`ลบ ${it.Title}`}>
                <FontAwesomeIcon icon={['fas', 'trash-can']} />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ────────── Group card ──────────
function GroupCard({ group: g, index, total, isOpen, busy, deleting, onToggle, onMove, onDelete, onSaved, onAddItem, onEditItem, onDeleteItem }) {
  const color = toHex(g.Color)
  const count = g.Items?.length || 0
  return (
    <article className="admin-card overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 min-w-0 flex items-center gap-4 text-left rounded-2xl -m-2 p-2 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        >
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl shadow-sm"
                style={{ backgroundColor: color, color: inkOn(color) }}>
            <FaIcon icon={g.Icon || 'fa-solid fa-folder'} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-lg text-slate-800 leading-tight">{g.Title}</span>
              <Badge style={{ backgroundColor: rgba(color, 0.12), color: accentText(color) }}>{count} รายการ</Badge>
              {g.IsEnabled
                ? <Badge icon="circle-check" className="bg-emerald-50 text-emerald-700">เปิดใช้งาน</Badge>
                : <Badge icon="eye-slash" className="bg-slate-200 text-slate-600">ปิดอยู่</Badge>}
            </span>
            {g.Subtitle && <span className="block text-base text-slate-500 mt-0.5 truncate">{g.Subtitle}</span>}
          </span>
          <FontAwesomeIcon icon={['fas', 'chevron-down']}
                           className={`text-slate-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Column actions: order, settings, delete — always visible */}
        <div className="flex items-center gap-1 self-end md:self-auto md:pl-3 md:border-l md:border-slate-100">
          <span className="text-sm text-slate-400 tabular-nums px-2 hidden sm:inline">ลำดับ {index + 1}/{total}</span>
          <button type="button" title="เลื่อนขึ้น" aria-label="เลื่อนขึ้น" className="btn-icon"
            disabled={busy || index === 0} onClick={() => onMove(-1)}>
            <FontAwesomeIcon icon={['fas', 'arrow-up']} />
          </button>
          <button type="button" title="เลื่อนลง" aria-label="เลื่อนลง" className="btn-icon"
            disabled={busy || index === total - 1} onClick={() => onMove(1)}>
            <FontAwesomeIcon icon={['fas', 'arrow-down']} />
          </button>
          <button type="button" title="ตั้งค่าคอลัมน์" aria-label="ตั้งค่าคอลัมน์" aria-pressed={isOpen}
            className={`btn-icon ${isOpen ? 'bg-brand-soft text-brand' : ''}`} onClick={onToggle}>
            <FontAwesomeIcon icon={['fas', 'gear']} />
          </button>
          <button type="button" title="ลบคอลัมน์" aria-label="ลบคอลัมน์" className="btn-icon btn-icon-danger"
            disabled={busy} onClick={onDelete}>
            <FontAwesomeIcon icon={['fas', deleting ? 'circle-notch' : 'trash-can']} spin={deleting} />
          </button>
        </div>
      </div>

      <Collapse open={isOpen}>
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-5">
          <GroupEditor group={g} onSave={onSaved} />

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2">
                <FontAwesomeIcon icon={['fas', 'list-ul']} className="text-brand" />
                รายการในคอลัมน์นี้
                <span className="text-base font-normal text-slate-500">({count})</span>
              </h3>
              <button type="button" onClick={onAddItem} className="btn-primary">
                <FontAwesomeIcon icon={['fas', 'plus']} />เพิ่มรายการ
              </button>
            </div>
            <ItemsList items={g.Items} color={color} onEdit={onEditItem} onDelete={onDeleteItem} onAdd={onAddItem} />
          </div>
        </div>
      </Collapse>
    </article>
  )
}

// ────────── Main page ──────────
export default function AdminHomePage() {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)       // first load only
  const [loadError, setLoadError] = useState(null)   // first load failed — shows retry card
  const [openGroupId, setOpenGroupId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formKey, setFormKey]   = useState(0)        // remounts ItemForm with fresh state per open
  const [formGroup, setFormGroup] = useState(null)
  const [formInitial, setFormInitial] = useState(null)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [busyGroupId, setBusyGroupId]   = useState(null) // group being moved/deleted
  const [groupToDelete, setGroupToDelete] = useState(null)
  const [itemToDelete, setItemToDelete]   = useState(null)
  const [deletingItem, setDeletingItem]   = useState(false)
  const { toast } = useToast()

  // background=true keeps the page (and scroll position) and just swaps the data in
  const reload = async ({ background = false } = {}) => {
    if (!background) { setLoading(true); setLoadError(null) }
    try {
      const r = await api.get('/api/admin/home/all')
      setGroups(r.data?.groups || [])
      setLoadError(null)
    } catch (e) {
      const msg = apiError(e, 'โหลดไม่สำเร็จ')
      if (background) toast({ message: msg, type: 'error' })
      else setLoadError(msg)
    } finally {
      if (!background) setLoading(false)
    }
  }
  const refresh = () => reload({ background: true })

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openItemForm = (g, item) => {
    setFormGroup(g)
    setFormInitial(item)
    setFormKey(k => k + 1)
    setShowForm(true)
  }

  const confirmDeleteItem = async () => {
    const it = itemToDelete
    if (!it) return
    setDeletingItem(true)
    try {
      await api.delete(`/api/admin/home/items/${it.Id}`)
      toast({ message: `ลบรายการ “${it.Title}” สำเร็จ`, type: 'success' })
      setItemToDelete(null)
      refresh()
    } catch (e) {
      toast({ message: apiError(e, 'ลบไม่สำเร็จ'), type: 'error' })
    } finally { setDeletingItem(false) }
  }

  const onGroupCreated = (data) => {
    setShowAddGroup(false)
    if (data?.id) setOpenGroupId(data.id)
    refresh()
  }

  const confirmDeleteGroup = async () => {
    const g = groupToDelete
    if (!g) return
    const n = g.Items?.length || 0
    setBusyGroupId(g.Id)
    try {
      const r = await api.delete(`/api/admin/home/groups/${g.Id}`)
      toast({ message: `ลบคอลัมน์สำเร็จ (ลบ ${r.data?.deletedItems ?? n} รายการ)`, type: 'success' })
      if (openGroupId === g.Id) setOpenGroupId(null)
      setGroupToDelete(null)
      refresh()
    } catch (e) {
      toast({ message: apiError(e, 'ลบไม่สำเร็จ'), type: 'error' })
    } finally { setBusyGroupId(null) }
  }

  // Swap with the neighbour and save the whole order (1..n) in one request.
  const onMoveGroup = async (idx, dir) => {
    const j = idx + dir
    if (j < 0 || j >= groups.length || busyGroupId) return
    const next = [...groups]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    const order = next.map((g, i) => ({ id: g.Id, sortOrder: i + 1 }))
    setGroups(next.map((g, i) => ({ ...g, SortOrder: i + 1 }))) // optimistic
    setBusyGroupId(groups[idx].Id)
    try {
      await api.put('/api/admin/home/groups/order', { order })
    } catch (e) {
      toast({ message: apiError(e, 'เปลี่ยนลำดับไม่สำเร็จ'), type: 'error' })
    } finally {
      setBusyGroupId(null)
      refresh()
    }
  }

  const header = (
    <PageHeader
      icon="table-columns"
      title="คอลัมน์หน้าแรก"
      subtitle="กำหนดคอลัมน์ (กลุ่ม) และรายการลิงก์ที่แสดงบนหน้าแรกของผู้ใช้ — ลำดับ สี ไอคอน และสิทธิ์ตามกลุ่ม AD"
      actions={!loading && !loadError && (
        <button type="button" onClick={() => setShowAddGroup(true)} className="btn-primary" disabled={showAddGroup}>
          <FontAwesomeIcon icon={['fas', 'plus']} />เพิ่มคอลัมน์
        </button>
      )}
    />
  )

  if (loading) {
    return <div className="animate-fade-in">{header}<LoadingState rows={4} /></div>
  }

  if (loadError) {
    return <div className="animate-fade-in">{header}<ErrorState message={loadError} onRetry={() => reload()} /></div>
  }

  const deleteGroupCount = groupToDelete?.Items?.length || 0

  return (
    <div className="animate-fade-in">
      {header}

      {showAddGroup && (
        <div className="mb-5">
          <GroupEditor group={null} onSave={onGroupCreated} onCancel={() => setShowAddGroup(false)} />
        </div>
      )}

      {groups.length === 0 && !showAddGroup && (
        <EmptyState
          icon="table-columns"
          title="ยังไม่มีคอลัมน์"
          message="เพิ่มคอลัมน์แรกเพื่อเริ่มจัดหน้าแรกของผู้ใช้"
          action={
            <button type="button" className="btn-primary" onClick={() => setShowAddGroup(true)}>
              <FontAwesomeIcon icon={['fas', 'plus']} />เพิ่มคอลัมน์
            </button>
          }
        />
      )}

      <div className="space-y-4">
        {groups.map((g, idx) => (
          <GroupCard
            key={g.Id}
            group={g}
            index={idx}
            total={groups.length}
            isOpen={openGroupId === g.Id}
            busy={busyGroupId !== null}
            deleting={busyGroupId === g.Id && groupToDelete?.Id === g.Id}
            onToggle={() => setOpenGroupId(openGroupId === g.Id ? null : g.Id)}
            onMove={(dir) => onMoveGroup(idx, dir)}
            onDelete={() => setGroupToDelete(g)}
            onSaved={refresh}
            onAddItem={() => openItemForm(g, null)}
            onEditItem={(it) => openItemForm(g, it)}
            onDeleteItem={(it) => setItemToDelete(it)}
          />
        ))}
      </div>

      {formKey > 0 && (
        <ItemForm
          key={formKey}
          open={showForm}
          groupId={formGroup?.Id}
          groupTitle={formGroup?.Title}
          groupColor={formGroup?.Color}
          initial={formInitial}
          onClose={() => setShowForm(false)}
          onSaved={refresh}
        />
      )}

      <ConfirmDialog
        open={!!groupToDelete}
        onClose={() => { if (!busyGroupId) setGroupToDelete(null) }}
        onConfirm={confirmDeleteGroup}
        loading={!!groupToDelete && busyGroupId === groupToDelete.Id}
        isDangerous
        title="ลบคอลัมน์นี้?"
        confirmText="ลบคอลัมน์"
        message={
          <>
            <p>ต้องการลบคอลัมน์ <strong className="text-slate-800">“{groupToDelete?.Title}”</strong> ใช่หรือไม่</p>
            <p className="mt-2">
              {deleteGroupCount > 0
                ? <>รายการในคอลัมน์นี้ <strong className="text-red-600">{deleteGroupCount} รายการ</strong> จะถูกลบไปด้วย</>
                : 'คอลัมน์นี้ไม่มีรายการ'}
            </p>
            <p className="mt-2 text-red-600">การลบไม่สามารถกู้คืนได้</p>
          </>
        }
      />

      <ConfirmDialog
        open={!!itemToDelete}
        onClose={() => { if (!deletingItem) setItemToDelete(null) }}
        onConfirm={confirmDeleteItem}
        loading={deletingItem}
        isDangerous
        title="ลบรายการนี้?"
        confirmText="ลบรายการ"
        message={<>ต้องการลบรายการ <strong className="text-slate-800">“{itemToDelete?.Title}”</strong> ใช่หรือไม่ — การลบไม่สามารถกู้คืนได้</>}
      />
    </div>
  )
}
