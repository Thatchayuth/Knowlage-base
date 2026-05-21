import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchSettings, adminUpdateSettings } from '../../services/services'
import { useToast } from '../../components/ui/Toast'
import Spinner from '../../components/ui/Spinner'

// ── Parse FA class string -> [prefix, iconName] ------------------
// รองรับ: 'fa-solid fa-network-wired', 'fa-folder', 'folder', ฯลฯ
export function parsePortalIcon(cls) {
  if (!cls) return ['fas', 'folder']
  const parts = cls.trim().split(/\s+/)
  const styleMap = { 'fa-solid': 'fas', 'fa-regular': 'far', 'fa-brands': 'fab', fas: 'fas', far: 'far', fab: 'fab' }
  const styleEntry = parts.find(p => styleMap[p])
  const prefix = styleEntry ? styleMap[styleEntry] : 'fas'
  const namePart = parts.find(p => p.startsWith('fa-') && !styleMap[p])
  const name = namePart ? namePart.slice(3) : parts.find(p => !p.startsWith('fa-')) || 'folder'
  return [prefix, name]
}

// ── Icon catalog (faClass = class string ที่เก็บใน DB) -----------
const ICON_OPTIONS = [
  { key: 'folder',        label: 'Folder',      faClass: 'fa-solid fa-folder' },
  { key: 'folder-open',   label: 'Folder Open', faClass: 'fa-solid fa-folder-open' },
  { key: 'box-archive',   label: 'Archive',     faClass: 'fa-solid fa-box-archive' },
  { key: 'database',      label: 'Database',    faClass: 'fa-solid fa-database' },
  { key: 'server',        label: 'Server',      faClass: 'fa-solid fa-server' },
  { key: 'file',          label: 'File',        faClass: 'fa-solid fa-file' },
  { key: 'file-lines',    label: 'File Text',   faClass: 'fa-solid fa-file-lines' },
  { key: 'layer-group',   label: 'Layers',      faClass: 'fa-solid fa-layer-group' },
  { key: 'building',      label: 'Building',    faClass: 'fa-solid fa-building' },
  { key: 'briefcase',     label: 'Briefcase',   faClass: 'fa-solid fa-briefcase' },
  { key: 'cloud',         label: 'Cloud',       faClass: 'fa-solid fa-cloud' },
  { key: 'house',         label: 'Home',        faClass: 'fa-solid fa-house' },
  { key: 'book',          label: 'Book',        faClass: 'fa-solid fa-book' },
  { key: 'bookmark',      label: 'Bookmark',    faClass: 'fa-solid fa-bookmark' },
  { key: 'globe',         label: 'Globe',       faClass: 'fa-solid fa-globe' },
  { key: 'cubes',         label: 'Cubes',       faClass: 'fa-solid fa-cubes' },
  { key: 'circle-info',   label: 'Info',        faClass: 'fa-solid fa-circle-info' },
  { key: 'hard-drive',    label: 'Hard Drive',  faClass: 'fa-solid fa-hard-drive' },
  { key: 'network-wired', label: 'Network',     faClass: 'fa-solid fa-network-wired' },
  { key: 'sitemap',       label: 'Sitemap',     faClass: 'fa-solid fa-sitemap' },
]

// -----------------------------------------------------------------
export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [portalTitle, setPortalTitle] = useState('')
  const [portalIcon,  setPortalIcon]  = useState('fa-solid fa-folder')
  const [iconInput,   setIconInput]   = useState('fa-solid fa-folder')
  const [driveRoot,   setDriveRoot]   = useState('')
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    fetchSettings()
      .then(data => {
        setPortalTitle(data.portal_title || '')
        const icon = data.portal_icon || 'fa-solid fa-folder'
        setPortalIcon(icon)
        setIconInput(icon)
        setDriveRoot(data.portal_drive_root || '')
      })
      .catch(() => toast({ message: 'Failed to load settings', type: 'error' }))
      .finally(() => setLoading(false))
  }, [])

  const selectGridIcon = (faClass) => {
    setPortalIcon(faClass)
    setIconInput(faClass)
  }

  const handleIconInput = (e) => {
    const val = e.target.value
    setIconInput(val)
    setPortalIcon(val.trim() || 'fa-solid fa-folder')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!portalTitle.trim()) return
    setSaving(true)
    try {
      const icon = iconInput.trim() || 'fa-solid fa-folder'
      await adminUpdateSettings({ portal_title: portalTitle.trim(), portal_icon: icon, portal_drive_root: driveRoot.trim() })
      setPortalIcon(icon)
      setIconInput(icon)
      toast({ message: 'บันทึกการตั้งค่าเรียบร้อย', type: 'success' })
    } catch (err) {
      toast({ message: err.response?.data?.error || 'บันทึกไม่สำเร็จ', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  let previewIcon
  try { previewIcon = parsePortalIcon(portalIcon) } catch { previewIcon = ['fas', 'folder'] }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-brand-ink">Site Settings</h1>
        <p className="text-steel-500 text-sm mt-1">ตั้งค่าการแสดงผลของเว็บไซต์</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="panel p-6 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-accent-500/10 border border-accent-500/25 flex items-center justify-center flex-shrink-0">
                <FontAwesomeIcon icon={['fas', 'folder']} className="text-accent-500" />
              </div>
              <div>
                <div className="font-semibold text-brand-ink text-sm">Sidebar Portal Section</div>
                <div className="text-xs text-steel-500">ปรับชื่อและไอคอนที่แสดงใน Sidebar ของผู้ใช้งาน</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">
                Portal Title *
              </label>
              <input
                type="text"
                className="input-field text-sm"
                value={portalTitle}
                onChange={e => setPortalTitle(e.target.value)}
                placeholder="เช่น Cell-E-File Portal"
                maxLength={200}
                required
              />
              <p className="text-xs text-steel-600 mt-1">ชื่อที่แสดงเป็นหัวข้อหลักใน Sidebar (สูงสุด 200 ตัวอักษร)</p>
            </div>

            <div>
              <label className="block text-xs font-mono text-steel-400 mb-2 uppercase tracking-wider">
                Portal Icon — เลือกจากรายการ
              </label>
              <div className="grid grid-cols-5 gap-2">
                {ICON_OPTIONS.map(opt => {
                  const isActive = portalIcon === opt.faClass
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      title={opt.faClass}
                      onClick={() => selectGridIcon(opt.faClass)}
                      className={[
                        'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-center',
                        'transition-all duration-150 cursor-pointer select-none',
                        isActive
                          ? 'bg-accent-500/15 border-accent-500 text-accent-500 shadow-sm ring-1 ring-accent-500/40'
                          : 'bg-gray-50 border-gray-200 text-steel-500 hover:bg-accent-500/5 hover:border-accent-500/40 hover:text-accent-500',
                      ].join(' ')}
                    >
                      <FontAwesomeIcon icon={parsePortalIcon(opt.faClass)} className="w-5 h-5" />
                      <span className="text-[10px] leading-none font-medium">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">
                หรือกรอก Class เอง (Font Awesome)
              </label>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand border border-white/10 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={previewIcon} className="text-accent-400 text-sm" />
                </div>
                <input
                  type="text"
                  className="input-field text-sm font-mono flex-1"
                  value={iconInput}
                  onChange={handleIconInput}
                  placeholder="เช่น fa-solid fa-network-wired"
                  spellCheck={false}
                />
              </div>
              <p className="text-xs text-steel-600 mt-1">
                รูปแบบ: <code className="bg-gray-100 px-1 rounded text-xs">fa-solid fa-[ชื่อไอคอน]</code> — ดูรายการไอคอนทั้งหมดได้ที่{' '}
                <a href="https://fontawesome.com/search?o=r&m=free&s=solid" target="_blank" rel="noopener noreferrer" className="text-accent-500 hover:underline">
                  fontawesome.com
                </a>
              </p>
            </div>

            <div className="p-3 rounded-lg bg-brand border border-white/20">
              <p className="text-xs font-mono text-white/40 mb-2 uppercase tracking-wider">Preview — Sidebar</p>
              <div className="flex items-center gap-2 px-1 py-1">
                <FontAwesomeIcon icon={previewIcon} className="w-4 h-4 text-accent-500/80 flex-shrink-0" />
                <span className="text-sm font-display font-semibold text-slate-200">
                  {portalTitle || <span className="text-white/30 italic">ยังไม่ได้กรอก...</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Auto-Sync Drive Root */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-brand-ink text-sm">Auto-Sync — Shared Drive Root</div>
                <div className="text-xs text-steel-500">Path ของ Shared Drive ที่ระบบจะ Sync อัตโนมัติทุก {import.meta.env.VITE_SYNC_INTERVAL || '5'} นาที</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-steel-400 mb-1.5 uppercase tracking-wider">
                Drive Root Path
              </label>
              <input
                type="text"
                className="input-field text-sm font-mono"
                value={driveRoot}
                onChange={e => setDriveRoot(e.target.value)}
                placeholder="เช่น R:\ICT\_Cell-E-OnsiteDesktop หรือ \\\\fileserver\\share"
                maxLength={500}
                spellCheck={false}
              />
              <p className="text-xs text-steel-600 mt-1">
                Path นี้จะถูกใช้โดย Auto-Sync และ Manual Sync (ถ้าไม่ได้ระบุ path อื่น) — เว้นว่างเพื่อหยุด Auto-Sync
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !portalTitle.trim()}
            >              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  บันทึกการตั้งค่า
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}