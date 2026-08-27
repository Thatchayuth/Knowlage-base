import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import api from '../../services/axios'
import { useToast } from '../../components/ui/Toast'

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
  if (!icon) return <FontAwesomeIcon icon={['fas', 'circle']} className={className} style={style} />
  try {
    return <FontAwesomeIcon icon={parseFa(icon)} className={className} style={style} />
  } catch {
    return <FontAwesomeIcon icon={['fas', 'circle-question']} className={className} style={style} />
  }
}

// ────────── Color helpers ──────────
const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
const LEGACY = { blue: '#3B82F6', red: '#EF4444', green: '#10B981' }
const toHex  = (c) => (HEX_RE.test(c || '') ? c : (LEGACY[c] || '#3B82F6'))

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
  { value: 'program',       label: 'เปิดโปรแกรม',  icon: 'fa-solid fa-circle-play',           hint: 'ใช้ kmportal:// เปิดโปรแกรมในเครื่อง user' },
  { value: 'program_group', label: 'เปิดโปรแกรมแบบกลุ่ม', icon: 'fa-solid fa-layer-group',   hint: 'ชี้ path ไปยังโฟลเดอร์ — เมื่อคลิกจะแสดงไฟล์ทั้งหมดข้างในให้ user เลือกเปิด' },
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
function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span className={`relative inline-block w-10 h-5 rounded-full transition ${checked ? 'bg-brand' : 'bg-steel-300'}`}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
      {label && <span className="text-sm text-steel-700">{label}</span>}
    </label>
  )
}

function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="w-12 h-12 rounded-lg bg-steel-100 flex items-center justify-center text-steel-700 text-xl border border-steel-200">
          <FaIcon icon={value} />
        </div>
        <input
          className="input-field flex-1 font-mono text-xs"
          placeholder="fa-solid fa-folder"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
        />
        <button type="button" onClick={() => setOpen(v => !v)}
                className="px-3 py-2 text-sm rounded-lg border border-steel-200 hover:bg-steel-50">
          <FontAwesomeIcon icon={['fas', open ? 'chevron-up' : 'chevron-down']} className="mr-1" />
          ตัวอย่าง
        </button>
      </div>
      {open && (
        <div className="mt-2 grid grid-cols-9 gap-1 p-2 border border-steel-200 rounded-xl bg-navy-50 max-h-44 overflow-y-auto">
          {ICON_PRESETS.map(ic => (
            <button key={ic} type="button" onClick={() => { onChange(ic); setOpen(false) }}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-steel-700 hover:bg-brand/10 transition ${value === ic ? 'bg-brand/15 text-brand' : 'bg-white'}`}
              title={ic}>
              <FaIcon icon={ic} />
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-steel-500">
        ใส่ class string ของ Font Awesome (เช่น <code className="bg-steel-100 px-1 rounded">fa-solid fa-folder</code>) — ดูทั้งหมดได้ที่{' '}
        <a href="https://fontawesome.com/search?o=r&m=free" target="_blank" rel="noreferrer" className="text-brand underline hover:text-navy-800">fontawesome.com</a>
      </p>
    </div>
  )
}

// ────────── Searchable select (lightweight combo) ──────────
function SearchableSelect({
  value, onChange, options, loading, error,
  placeholder = 'ค้นหาแล้วเลือก…',
  emptyHint = 'ไม่พบรายการ',
  onRetry,
}) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [focusIdx, setFocusIdx] = useState(0)

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

  const handleKey = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter')     { e.preventDefault(); const opt = filtered[focusIdx]; if (opt) { onChange(opt.id); setOpen(false); setQuery('') } }
    else if (e.key === 'Escape')    { setOpen(false) }
  }

  return (
    <div className="relative">
      {/* Trigger / value display */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`input-field text-left flex items-center justify-between gap-2 ${open ? 'ring-1 ring-brand/20 border-brand' : ''}`}
      >
        {selected ? (
          <span className="flex-1 min-w-0">
            <span className="block truncate font-medium text-steel-800">{selected.label}</span>
            {selected.sublabel && <span className="block truncate text-xs text-steel-500">{selected.sublabel}</span>}
          </span>
        ) : (
          <span className="flex-1 text-steel-400">{placeholder}</span>
        )}
        <span className="flex items-center gap-2 flex-shrink-0">
          {selected && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-steel-100 text-steel-500">#{selected.id}</span>
          )}
          <FontAwesomeIcon icon={['fas', open ? 'chevron-up' : 'chevron-down']} className="text-steel-400 text-xs" />
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* click-out overlay */}
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setQuery('') }} />
          <div className="absolute z-40 mt-1 w-full bg-white rounded-xl border border-steel-200 shadow-lg overflow-hidden">
            <div className="p-2 border-b border-steel-100">
              <div className="relative">
                <FontAwesomeIcon icon={['fas', 'magnifying-glass']} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-400 text-xs" />
                <input
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-steel-200 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                  placeholder="พิมพ์เพื่อค้นหา…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {loading && (
                <div className="px-4 py-6 text-center text-sm text-steel-400">
                  <FontAwesomeIcon icon={['fas', 'circle-notch']} spin className="mr-2" />
                  กำลังโหลดข้อมูล…
                </div>
              )}
              {!loading && error && (
                <div className="px-4 py-6 text-center text-sm text-red-600">
                  <FontAwesomeIcon icon={['fas', 'circle-exclamation']} className="mr-1" /> {error}
                  {onRetry && (
                    <button type="button" onClick={onRetry} className="block mx-auto mt-2 text-xs text-blue-600 underline">
                      ลองโหลดอีกครั้ง
                    </button>
                  )}
                </div>
              )}
              {!loading && !error && filtered.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-steel-400">
                  <FontAwesomeIcon icon={['fas', 'inbox']} className="mr-1" /> {emptyHint}
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
                    onClick={() => { onChange(o.id); setOpen(false); setQuery('') }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 transition ${
                      active ? 'bg-brand/8' : focused ? 'bg-navy-50' : ''
                    }`}
                  >
                    {o.icon && (
                      <FaIcon icon={o.icon} className="mt-0.5 text-steel-500 w-4 text-center flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate text-sm ${active ? 'font-semibold text-brand' : 'text-steel-800'}`}>
                        {o.label}
                      </span>
                      {o.sublabel && <span className="block truncate text-xs text-steel-500">{o.sublabel}</span>}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-steel-100 text-steel-400 flex-shrink-0">#{o.id}</span>
                    {active && <FontAwesomeIcon icon={['fas', 'check']} className="text-brand text-xs mt-1 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>

            {!loading && !error && options.length > 0 && (
              <div className="px-3 py-1.5 border-t border-steel-100 text-[10px] text-steel-400 bg-navy-50/60 flex items-center justify-between">
                <span>{filtered.length} / {options.length} รายการ</span>
                <span><kbd className="px-1 bg-white border rounded">↑↓</kbd> เลือก <kbd className="px-1 bg-white border rounded">Enter</kbd></span>
              </div>
            )}
          </div>
        </>
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
      .catch(e => { if (!abort) setError(e.response?.data?.error || e.response?.data?.message || 'โหลดรายการโฟลเดอร์ไม่สำเร็จ') })
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
        for (const l1 of menu) {
          // direct items under L1
          for (const it of (l1.directItems || [])) {
            list.push({
              id:       it.id,
              label:    it.title,
              sublabel: l1.name,
              icon:     it.displayMode === 'PDF' ? 'fa-solid fa-file-pdf'
                       : it.displayMode === 'LINK' ? 'fa-solid fa-link'
                       : 'fa-solid fa-file-lines',
            })
          }
          for (const l2 of (l1.level2 || [])) {
            for (const it of (l2.items || [])) {
              list.push({
                id:       it.id,
                label:    it.title,
                sublabel: `${l1.name} › ${l2.name}`,
                icon:     it.displayMode === 'PDF' ? 'fa-solid fa-file-pdf'
                         : it.displayMode === 'LINK' ? 'fa-solid fa-link'
                         : 'fa-solid fa-file-lines',
              })
            }
          }
        }
        list.sort((a, b) => a.label.localeCompare(b.label, 'th'))
        setOptions(list)
      })
      .catch(e => { if (!abort) setError(e.response?.data?.error || 'โหลดรายการ Knowledge ไม่สำเร็จ') })
      .finally(() => { if (!abort) setLoading(false) })
    return () => { abort = true }
  }, [enabled, trigger])

  return { options, loading, error, reload: () => setTrigger(t => t + 1) }
}

function ColorPicker({ value, onChange }) {
  const v = toHex(value)
  return (
    <div>
      <div className="flex items-center gap-2">
        <input type="color" value={v} onChange={e => onChange(e.target.value.toUpperCase())}
               className="w-14 h-10 rounded cursor-pointer border border-steel-200" />
        <input className="input-field flex-1 font-mono uppercase"
               value={value || ''} placeholder="#FFCC99"
               onChange={e => onChange(e.target.value)} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COLOR_PRESETS.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={`w-7 h-7 rounded-md border-2 transition ${v.toLowerCase() === c.toLowerCase() ? 'border-steel-800 scale-110' : 'border-white shadow'}`}
            style={{ backgroundColor: c }} title={c} />
        ))}
      </div>
    </div>
  )
}

// ────────── Group editor ──────────
function GroupEditor({ group, onSave }) {
  const [title, setTitle]       = useState(group.Title)
  const [subtitle, setSubtitle] = useState(group.Subtitle || '')
  const [icon, setIcon]         = useState(group.Icon || 'fa-solid fa-folder')
  const [color, setColor]       = useState(toHex(group.Color))
  const [enabled, setEnabled]   = useState(!!group.IsEnabled)
  const [saving, setSaving]     = useState(false)
  const { toast } = useToast()

  const handleSave = async () => {
    if (!HEX_RE.test(color)) { toast({ message: 'กรุณาใส่สีในรูปแบบ HEX เช่น #FFCC99', type: 'error' }); return }
    setSaving(true)
    try {
      await api.put(`/api/admin/home/groups/${group.Id}`, {
        title, subtitle, icon, color: color.toUpperCase(),
        sortOrder: group.SortOrder,
        isEnabled: enabled,
      })
      toast({ message: 'บันทึกสำเร็จ', type: 'success' })
      onSave?.()
    } catch (e) {
      toast({ message: e.response?.data?.error || 'บันทึกไม่สำเร็จ', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-gradient-to-br from-navy-50 to-white rounded-2xl border border-steel-200">
      <div className="md:col-span-2 flex items-center justify-between border-b border-steel-200 pb-3">
        <h3 className="font-display font-semibold text-brand-ink"><FontAwesomeIcon icon={['fas', 'gear']} className="mr-2 text-brand" /> ตั้งค่า Group</h3>
        <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} />
      </div>

      <label className="text-sm">
        <span className="font-semibold text-steel-700">ชื่อหัวข้อ *</span>
        <input className="input-field mt-1" value={title} onChange={e => setTitle(e.target.value)} />
      </label>
      <label className="text-sm">
        <span className="font-semibold text-steel-700">คำอธิบายย่อย</span>
        <input className="input-field mt-1" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
      </label>

      <div className="md:col-span-2">
        <span className="font-semibold text-steel-700 text-sm">ไอคอน (Font Awesome)</span>
        <div className="mt-1"><IconPicker value={icon} onChange={setIcon} /></div>
      </div>

      <div className="md:col-span-2">
        <span className="font-semibold text-steel-700 text-sm">สีหัวข้อ (HEX)</span>
        <div className="mt-1"><ColorPicker value={color} onChange={setColor} /></div>
      </div>

      <div className="md:col-span-2 flex justify-end pt-3 border-t border-steel-200">
        <button
          className="btn-primary disabled:opacity-50"
          disabled={saving} onClick={handleSave}>
          {saving
            ? <><FontAwesomeIcon icon={['fas', 'spinner']} spin />กำลังบันทึก...</>
            : <><FontAwesomeIcon icon={['fas', 'floppy-disk']} />บันทึกการตั้งค่ากลุ่ม</>}
        </button>
      </div>
    </div>
  )
}

// ────────── Item form modal ──────────
function ItemForm({ groupId, initial, onClose, onSaved }) {
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
  const [sortOrder, setSortOrder]     = useState(initial?.SortOrder ?? 0)
  const [mappings, setMappings]       = useState(
    initial?.Mappings?.map(m => ({ adGroup: m.AdGroup, filePath: m.FilePath })) || []
  )
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Lazy-load options only when needed
  const folderQ    = useFolderOptions(linkType === 'folder')
  const knowledgeQ = useKnowledgeOptions(linkType === 'knowledge')

  const addMapping = () => setMappings(prev => [...prev, { adGroup: '', filePath: '' }])
  const updateMapping = (i, key, val) => setMappings(prev => prev.map((m, idx) => idx === i ? { ...m, [key]: val } : m))
  const removeMapping = (i) => setMappings(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!title.trim()) { toast({ message: 'กรุณากรอกชื่อรายการ', type: 'error' }); return }
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
        mappings: (linkType === 'program' || linkType === 'program_group')
          ? mappings.filter(m => m.adGroup && m.filePath)
          : [],
      }
      if (isEdit) await api.put(`/api/admin/home/items/${initial.Id}`, payload)
      else        await api.post('/api/admin/home/items', payload)
      toast({ message: 'บันทึกสำเร็จ', type: 'success' })
      onSaved?.()
      onClose?.()
    } catch (e) {
      toast({ message: e.response?.data?.error || 'บันทึกไม่สำเร็จ', type: 'error' })
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-brand-ink/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl my-4 shadow-panel overflow-hidden">
        {/* Header */}
        <div className="px-7 py-5 border-b border-steel-200 flex items-center justify-between bg-gradient-to-r from-brand to-navy-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur text-white flex items-center justify-center text-lg ring-1 ring-white/20">
              <FontAwesomeIcon icon={['fas', isEdit ? 'pen-to-square' : 'plus']} />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-white">{isEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h3>
              <p className="text-xs text-navy-100">กรอกข้อมูลให้ครบและกดบันทึก</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full text-white/80 hover:bg-white/15 hover:text-white transition">
            <FontAwesomeIcon icon={['fas', 'xmark']} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-6 max-h-[78vh] overflow-y-auto bg-navy-50/30">
          {/* Section 1: ข้อมูลทั่วไป */}
          <section className="bg-white rounded-2xl border border-steel-200 p-5 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] flex items-center justify-center font-display">1</span>
              ข้อมูลทั่วไป
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm md:col-span-2">
                <span className="font-semibold text-steel-700">ชื่อรายการ *</span>
                <input className="input-field mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น Power BI - Production Dashboard" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="font-semibold text-steel-700">คำอธิบายย่อย (ถ้ามี)</span>
                <input className="input-field mt-1" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
              </label>
              <div className="md:col-span-2">
                <span className="font-semibold text-sm text-steel-700">ไอคอน</span>
                <div className="mt-1"><IconPicker value={icon} onChange={setIcon} /></div>
              </div>
            </div>
          </section>

          {/* Section 2: ประเภทลิงก์ */}
          <section className="bg-white rounded-2xl border border-steel-200 p-5 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] flex items-center justify-center font-display">2</span>
              ประเภทลิงก์
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {LINK_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setLinkType(t.value)}
                  className={`p-4 rounded-2xl border-2 text-center transition ${linkType === t.value ? 'border-brand bg-brand/5 text-brand shadow-sm' : 'border-steel-200 hover:border-brand/40 bg-white text-steel-600'}`}
                >
                  <FaIcon icon={t.icon} className="text-2xl mb-1" />
                  <div className="text-xs font-semibold">{t.label}</div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-steel-500">
              <FontAwesomeIcon icon={['fas', 'circle-info']} className="mr-1 text-brand" />
              {LINK_TYPES.find(t => t.value === linkType)?.hint}
            </p>
          </section>

          {/* Section 3: ตั้งค่าตามประเภท */}
          <section className="bg-white rounded-2xl border border-steel-200 p-5 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] flex items-center justify-center font-display">3</span>
              ตั้งค่ารายละเอียด
            </h4>

            {(linkType === 'program' || linkType === 'program_group') && (
              <div className="space-y-4 p-4 bg-navy-50 rounded-xl border border-navy-100">
                <div>
                  <span className="font-semibold text-sm text-steel-700">ชนิดโปรแกรม</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                    {PROGRAM_TYPES.map(p => (
                      <button key={p.value} type="button" onClick={() => setProgramType(p.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition ${programType === p.value ? 'bg-brand text-white shadow-sm' : 'bg-white border border-steel-200 hover:border-brand/40 text-steel-700'}`}>
                        <FaIcon icon={p.icon} className="mr-2" />{p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-sm text-steel-700">
                        {linkType === 'program_group' ? 'การจับคู่ AD Group → Folder Path' : 'การจับคู่ AD Group → File Path'}
                      </span>
                      <p className="text-xs text-steel-500">
                        {linkType === 'program_group'
                          ? 'ชี้ path ไปยังโฟลเดอร์ — เมื่อ user คลิก ระบบจะแสดงไฟล์ทั้งหมดในโฟลเดอร์ให้เลือกเปิด'
                          : 'ผู้ใช้ในกลุ่มที่ตรงกันจะเปิดไฟล์ที่กำหนด (ใช้รายการแรกที่ตรง)'}
                      </p>
                    </div>
                    <button type="button" onClick={addMapping}
                      className="px-3 py-1.5 text-xs rounded-xl bg-brand hover:bg-navy-800 text-white font-medium shadow-sm transition">
                      <FontAwesomeIcon icon={['fas', 'plus']} className="mr-1" />เพิ่ม
                    </button>
                  </div>

                  {mappings.length === 0 ? (
                    <div className="text-center text-xs text-steel-400 py-5 border border-dashed border-steel-300 rounded-xl bg-white">
                      ยังไม่มีการจับคู่ — กดปุ่ม "เพิ่ม"
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {mappings.map((m, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4">
                            <input className="input-field text-xs"
                              placeholder="AD Group (เช่น dt-staff)"
                              value={m.adGroup}
                              onChange={e => updateMapping(i, 'adGroup', e.target.value)} />
                          </div>
                          <div className="col-span-7">
                            <input className="input-field text-xs font-mono"
                              placeholder={linkType === 'program_group' ? '\\\\server\\share\\reports-folder' : '\\\\server\\share\\file.pbix'}
                              value={m.filePath}
                              onChange={e => updateMapping(i, 'filePath', e.target.value)} />
                          </div>
                          <button type="button" onClick={() => removeMapping(i)}
                            className="col-span-1 w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center">
                            <FontAwesomeIcon icon={['fas', 'trash']} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {linkType === 'folder' && (
              <div className="text-sm p-4 bg-navy-50 rounded-xl border border-navy-100">
                <span className="font-semibold block mb-1 text-steel-700">เลือกโฟลเดอร์ *</span>
                <SearchableSelect
                  value={folderId}
                  onChange={(id) => setFolderId(id)}
                  options={folderQ.options}
                  loading={folderQ.loading}
                  error={folderQ.error}
                  onRetry={folderQ.reload}
                  placeholder="ค้นหาโฟลเดอร์… (พิมพ์ชื่อหรือ path)"
                  emptyHint="ไม่พบโฟลเดอร์ที่ตรงคำค้น"
                />
                <span className="text-xs text-steel-500 mt-2 block">
                  <FontAwesomeIcon icon={['fas', 'circle-info']} className="mr-1 text-brand" />
                  ค้นด้วยชื่อหรือ Full Path ของโฟลเดอร์
                </span>
              </div>
            )}

            {linkType === 'knowledge' && (
              <div className="text-sm p-4 bg-navy-50 rounded-xl border border-navy-100">
                <span className="font-semibold block mb-1 text-steel-700">เลือก Knowledge Item *</span>
                <SearchableSelect
                  value={knowledgeId}
                  onChange={(id) => setKnowledgeId(id)}
                  options={knowledgeQ.options}
                  loading={knowledgeQ.loading}
                  error={knowledgeQ.error}
                  onRetry={knowledgeQ.reload}
                  placeholder="ค้นหา Knowledge… (พิมพ์ชื่อหรือหมวด)"
                  emptyHint="ไม่พบ Knowledge ที่ตรงคำค้น"
                />
                <span className="text-xs text-steel-500 mt-2 block">
                  <FontAwesomeIcon icon={['fas', 'circle-info']} className="mr-1 text-brand" />
                  ค้นด้วยชื่อหัวข้อหรือชื่อหมวด (Level 1 / Level 2)
                </span>
              </div>
            )}

            {linkType === 'external_link' && (
              <div className="text-sm p-4 bg-navy-50 rounded-xl border border-navy-100">
                <span className="font-semibold block mb-1 text-steel-700">URL *</span>
                <input className="input-field" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://example.com" />
                <span className="text-xs text-steel-500 mt-2 block">
                  <FontAwesomeIcon icon={['fas', 'circle-info']} className="mr-1 text-brand" />
                  ลิงก์จะถูกเปิดในแท็บใหม่
                </span>
              </div>
            )}
          </section>

          {/* Section 4: ตัวเลือกอื่น */}
          <section className="bg-white rounded-2xl border border-steel-200 p-5 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] flex items-center justify-center font-display">4</span>
              ตัวเลือกอื่น
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <label className="text-sm">
                <span className="font-semibold text-steel-700">ลำดับการแสดง</span>
                <input type="number" className="input-field mt-1" value={sortOrder} onChange={e => setSortOrder(e.target.value)} />
                <span className="text-xs text-steel-500">เลขน้อยมาก่อน</span>
              </label>
              <div className="text-sm">
                <span className="font-semibold block mb-2 text-steel-700">สถานะ</span>
                <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-steel-200 flex justify-between bg-white">
          <button className="btn-ghost" onClick={onClose}>
            <FontAwesomeIcon icon={['fas', 'xmark']} />ยกเลิก
          </button>
          <button
            className="btn-primary disabled:opacity-50"
            disabled={saving} onClick={handleSave}>
            {saving
              ? <><FontAwesomeIcon icon={['fas', 'spinner']} spin />กำลังบันทึก...</>
              : <><FontAwesomeIcon icon={['fas', 'check']} />{isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────── Items list (per group) ──────────
function ItemsList({ items, onEdit, onDelete }) {
  if (!items?.length) {
    return (
      <div className="text-center py-8 text-steel-400 border border-dashed border-steel-300 rounded-lg">
        <FontAwesomeIcon icon={['fas', 'box-open']} className="text-3xl mb-2 opacity-50" />
        <div className="text-sm">ยังไม่มีรายการในกลุ่มนี้</div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {items.map(it => (
        <div key={it.Id}
             className="flex items-center gap-3 px-3 py-2.5 bg-white border border-steel-200 rounded-xl hover:border-brand/40 hover:shadow-sm transition group">
          <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center text-brand">
            <FaIcon icon={it.Icon} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-steel-800 truncate">{it.Title}</span>
              {!it.IsEnabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-steel-200 text-steel-600">ปิด</span>}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand/8 text-brand font-medium">
                {LINK_TYPES.find(t => t.value === it.LinkType)?.label || it.LinkType}
              </span>
            </div>
            <div className="text-xs text-steel-500 truncate mt-0.5">
              {it.LinkType === 'program' && `${it.ProgramType || ''} · ${it.Mappings?.length || 0} mappings`}
              {it.LinkType === 'program_group' && `${it.ProgramType || ''} · ${it.Mappings?.length || 0} folders`}
              {it.LinkType === 'folder' && `Folder #${it.FolderId}`}
              {it.LinkType === 'knowledge' && `Knowledge #${it.KnowledgeId}`}
              {it.LinkType === 'external_link' && it.ExternalUrl}
            </div>
          </div>
          <div className="text-xs text-steel-400 px-2 font-mono">#{it.SortOrder}</div>
          <button onClick={() => onEdit(it)}
            className="px-3 py-1.5 text-xs rounded-lg text-brand hover:bg-brand/10 font-medium opacity-0 group-hover:opacity-100 transition">
            <FontAwesomeIcon icon={['fas', 'pen-to-square']} className="mr-1" />แก้ไข
          </button>
          <button onClick={() => onDelete(it)}
            className="px-3 py-1.5 text-xs rounded-lg text-red-600 hover:bg-red-50 font-medium opacity-0 group-hover:opacity-100 transition">
            <FontAwesomeIcon icon={['fas', 'trash']} className="mr-1" />ลบ
          </button>
        </div>
      ))}
    </div>
  )
}

// ────────── Main page ──────────
export default function AdminHomePage() {
  const [groups, setGroups]   = useState([])
  const [loading, setLoading] = useState(true)
  const [openGroupId, setOpenGroupId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formGroupId, setFormGroupId] = useState(null)
  const [formInitial, setFormInitial] = useState(null)
  const { toast } = useToast()

  const reload = async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/admin/home/all')
      setGroups(r.data?.groups || [])
    } catch (e) {
      toast({ message: e.response?.data?.error || 'โหลดไม่สำเร็จ', type: 'error' })
    } finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [])

  const onAdd  = (gId)         => { setFormGroupId(gId); setFormInitial(null); setShowForm(true) }
  const onEdit = (gId, item)   => { setFormGroupId(gId); setFormInitial(item); setShowForm(true) }
  const onDelete = async (it) => {
    if (!window.confirm(`ลบรายการ "${it.Title}" ?`)) return
    try {
      await api.delete(`/api/admin/home/items/${it.Id}`)
      toast({ message: 'ลบสำเร็จ', type: 'success' })
      reload()
    } catch (e) {
      toast({ message: e.response?.data?.error || 'ลบไม่สำเร็จ', type: 'error' })
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-24 skeleton rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-brand-ink flex items-center gap-2">
            <FontAwesomeIcon icon={['fas', 'table-columns']} className="text-brand" />
            จัดการ Home Columns
          </h1>
          <p className="text-sm text-steel-500 mt-1">
            ตั้งค่ากลุ่มและรายการ 3 คอลัมน์ที่จะแสดงบนหน้าแรกของผู้ใช้
          </p>
        </div>
        <a href="/docs/installer/README.md" target="_blank" rel="noreferrer"
          className="text-xs text-brand hover:underline inline-flex items-center gap-1">
          <FontAwesomeIcon icon={['fas', 'circle-question']} />คู่มือการใช้งาน
        </a>
      </div>

      {/* Groups */}
      {groups.map(g => {
        const color  = toHex(g.Color)
        const isOpen = openGroupId === g.Id
        return (
          <div key={g.Id} className="bg-white rounded-2xl shadow-sm border border-steel-200 mb-4 overflow-hidden">
            {/* Group bar */}
            <button
              onClick={() => setOpenGroupId(isOpen ? null : g.Id)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-navy-50/40 transition"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl shadow-sm"
                     style={{ backgroundColor: color, color: '#fff' }}>
                  <FaIcon icon={g.Icon || 'fa-solid fa-folder'} />
                </div>
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-lg text-brand-ink">{g.Title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-steel-100 text-steel-500 font-mono">{g.GroupKey}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand/8 text-brand font-medium">
                      {g.Items?.length || 0} รายการ
                    </span>
                    {!g.IsEnabled && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">ปิดอยู่</span>}
                  </div>
                  {g.Subtitle && <p className="text-xs text-steel-500 mt-0.5 truncate">{g.Subtitle}</p>}
                </div>
              </div>
              <FontAwesomeIcon icon={['fas', isOpen ? 'chevron-up' : 'chevron-down']} className="text-steel-400" />
            </button>

            {isOpen && (
              <div className="px-5 pb-5 pt-2 bg-navy-50/30 space-y-4 border-t border-steel-200">
                <GroupEditor group={g} onSave={reload} />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-display font-semibold text-brand-ink flex items-center gap-2">
                      <FontAwesomeIcon icon={['fas', 'list']} className="text-brand" />
                      รายการในกลุ่มนี้
                    </h4>
                    <button onClick={() => onAdd(g.Id)} className="btn-primary text-sm">
                      <FontAwesomeIcon icon={['fas', 'plus']} />เพิ่มรายการ
                    </button>
                  </div>
                  <ItemsList items={g.Items} onEdit={(it) => onEdit(g.Id, it)} onDelete={onDelete} />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {showForm && (
        <ItemForm
          groupId={formGroupId}
          initial={formInitial}
          onClose={() => setShowForm(false)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
