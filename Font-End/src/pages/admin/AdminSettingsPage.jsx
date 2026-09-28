import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { adminFetchSettings, adminUpdateSettings } from '../../services/services'
import { useToast } from '../../components/ui/Toast'
import PageHeader from '../../components/ui/PageHeader'
import { LoadingState, ErrorState, apiError } from '../../components/ui/States'

// ── Parse FA class string -> [prefix, iconName] ------------------
// รองรับ: 'fa-solid fa-network-wired', 'fa-folder', 'folder', ฯลฯ
// (PortalSidebarSection import ฟังก์ชันนี้ไปใช้ด้วย — ห้ามลบ export)
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
  { key: 'folder',        label: 'โฟลเดอร์',     faClass: 'fa-solid fa-folder' },
  { key: 'folder-open',   label: 'โฟลเดอร์เปิด', faClass: 'fa-solid fa-folder-open' },
  { key: 'box-archive',   label: 'คลังเอกสาร',   faClass: 'fa-solid fa-box-archive' },
  { key: 'database',      label: 'ฐานข้อมูล',    faClass: 'fa-solid fa-database' },
  { key: 'server',        label: 'เซิร์ฟเวอร์',    faClass: 'fa-solid fa-server' },
  { key: 'file',          label: 'ไฟล์',         faClass: 'fa-solid fa-file' },
  { key: 'file-lines',    label: 'เอกสาร',       faClass: 'fa-solid fa-file-lines' },
  { key: 'layer-group',   label: 'หลายชั้น',      faClass: 'fa-solid fa-layer-group' },
  { key: 'building',      label: 'อาคาร',        faClass: 'fa-solid fa-building' },
  { key: 'briefcase',     label: 'กระเป๋างาน',    faClass: 'fa-solid fa-briefcase' },
  { key: 'cloud',         label: 'คลาวด์',        faClass: 'fa-solid fa-cloud' },
  { key: 'house',         label: 'หน้าแรก',       faClass: 'fa-solid fa-house' },
  { key: 'book',          label: 'หนังสือ',       faClass: 'fa-solid fa-book' },
  { key: 'bookmark',      label: 'บุ๊กมาร์ก',      faClass: 'fa-solid fa-bookmark' },
  { key: 'globe',         label: 'ลูกโลก',        faClass: 'fa-solid fa-globe' },
  { key: 'cubes',         label: 'กล่อง',         faClass: 'fa-solid fa-cubes' },
  { key: 'circle-info',   label: 'ข้อมูล',        faClass: 'fa-solid fa-circle-info' },
  { key: 'hard-drive',    label: 'ฮาร์ดดิสก์',     faClass: 'fa-solid fa-hard-drive' },
  { key: 'network-wired', label: 'เครือข่าย',     faClass: 'fa-solid fa-network-wired' },
  { key: 'sitemap',       label: 'ผังโครงสร้าง',   faClass: 'fa-solid fa-sitemap' },
]

function CardHeader({ icon, tone = 'brand', title, subtitle }) {
  const tones = {
    brand:   'bg-brand-soft text-brand',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
      <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg ${tones[tone]}`}>
        <FontAwesomeIcon icon={['fas', icon]} />
      </span>
      <div className="min-w-0">
        <h2 className="font-display font-bold text-lg text-slate-800">{title}</h2>
        {subtitle && <p className="text-base text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------
export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [portalTitle, setPortalTitle] = useState('')
  const [portalIcon,  setPortalIcon]  = useState('fa-solid fa-folder')
  const [iconInput,   setIconInput]   = useState('fa-solid fa-folder')
  const [driveRoot,   setDriveRoot]   = useState('')
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [loadError, setLoadError]     = useState(null)

  const loadSettings = () => {
    setLoading(true)
    setLoadError(null)
    adminFetchSettings()
      .then(data => {
        data = data || {}
        setPortalTitle(data.portal_title || '')
        const icon = data.portal_icon || 'fa-solid fa-folder'
        setPortalIcon(icon)
        setIconInput(icon)
        setDriveRoot(data.portal_drive_root || '')
      })
      .catch(err => {
        const message = apiError(err, 'โหลดการตั้งค่าไม่สำเร็จ')
        setLoadError(message)
        toast({ message, type: 'error' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSettings()
  }, []) // eslint-disable-line

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
      // แจ้งส่วนอื่น (เช่น PortalSidebarSection) ให้โหลด settings ใหม่
      window.dispatchEvent(new Event('settings:updated'))
    } catch (err) {
      toast({ message: apiError(err, 'บันทึกไม่สำเร็จ'), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  let previewIcon
  try { previewIcon = parsePortalIcon(portalIcon) } catch { previewIcon = ['fas', 'folder'] }

  const syncInterval = import.meta.env.VITE_SYNC_INTERVAL || '5'

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <PageHeader
        icon="sliders"
        title="ตั้งค่าเว็บไซต์"
        subtitle="ปรับชื่อ ไอคอน และตำแหน่ง Shared Drive ที่ใช้ Sync"
      />

      {loading ? (
        <LoadingState rows={5} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadSettings} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Sidebar portal section ─────────────────────────── */}
          <section className="admin-card p-5 sm:p-6">
            <CardHeader
              icon="folder-tree"
              title="หัวข้อ File Portal ใน Sidebar"
              subtitle="ชื่อและไอคอนที่ผู้ใช้เห็นในเมนูด้านซ้าย"
            />

            <div className="space-y-6">
              <div>
                <label htmlFor="portal-title" className="field-label">
                  ชื่อหัวข้อ <span className="text-red-600">*</span>
                </label>
                <input
                  id="portal-title"
                  type="text"
                  className="input-field"
                  value={portalTitle}
                  onChange={e => setPortalTitle(e.target.value)}
                  placeholder="เช่น Cell-E-File Portal"
                  maxLength={200}
                  required
                />
                <p className="field-hint">ชื่อที่แสดงเป็นหัวข้อหลักใน Sidebar (สูงสุด 200 ตัวอักษร)</p>
              </div>

              <div>
                <span className="field-label">ไอคอน — เลือกจากรายการ</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2" role="radiogroup" aria-label="ไอคอน">
                  {ICON_OPTIONS.map(opt => {
                    const isActive = portalIcon === opt.faClass
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        title={opt.faClass}
                        onClick={() => selectGridIcon(opt.faClass)}
                        className={[
                          'relative flex flex-col items-center justify-center gap-2 min-h-[72px] px-2 py-3 rounded-2xl border text-center',
                          'transition-all duration-150 select-none focus:outline-none focus:ring-4 focus:ring-brand/15',
                          isActive
                            ? 'bg-brand-soft border-brand text-brand ring-1 ring-brand/30'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-brand/40 hover:bg-brand-soft/50 hover:text-brand',
                        ].join(' ')}
                      >
                        {isActive && (
                          <FontAwesomeIcon icon={['fas', 'circle-check']} className="absolute top-1.5 right-1.5 text-sm text-brand" />
                        )}
                        <FontAwesomeIcon icon={parsePortalIcon(opt.faClass)} className="text-xl" />
                        <span className="text-sm leading-tight font-medium">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="portal-icon" className="field-label">หรือกรอกชื่อคลาส Font Awesome เอง</label>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
                    <FontAwesomeIcon icon={previewIcon} />
                  </span>
                  <input
                    id="portal-icon"
                    type="text"
                    className="input-field font-mono flex-1"
                    value={iconInput}
                    onChange={handleIconInput}
                    placeholder="เช่น fa-solid fa-network-wired"
                    spellCheck={false}
                  />
                </div>
                <p className="field-hint">
                  รูปแบบ <code className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">fa-solid fa-ชื่อไอคอน</code>
                  {' '}— ดูรายชื่อไอคอนทั้งหมดได้ที่{' '}
                  <a
                    href="https://fontawesome.com/search?o=r&m=free&s=solid"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand underline underline-offset-2 hover:text-navy-600"
                  >
                    fontawesome.com
                    <FontAwesomeIcon icon={['fas', 'arrow-up-right-from-square']} className="ml-1 text-xs" />
                  </a>
                </p>
              </div>

              {/* Preview — ดีไซน์เดียวกับหัวข้อใน Sidebar ฝั่งผู้ใช้ */}
              <div>
                <span className="field-label">ตัวอย่างที่ผู้ใช้จะเห็น</span>
                <div className="rounded-2xl p-3 bg-gradient-to-b from-[#0d1f6b] via-brand to-[#060d33] shadow-[0_12px_28px_-14px_rgba(10,24,85,0.7)]">
                  <div className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl bg-white/[0.07]">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-sky-400/25 to-teal-400/20 ring-1 ring-white/10 text-sky-200">
                      <FontAwesomeIcon icon={previewIcon} className="w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-display font-semibold text-[15px] text-white truncate">
                        {portalTitle.trim() || 'ยังไม่ได้กรอกชื่อ'}
                      </span>
                      <span className="block text-xs text-slate-300">จำนวนโฟลเดอร์ที่ผู้ใช้มีสิทธิ์</span>
                    </span>
                    <FontAwesomeIcon icon={['fas', 'chevron-down']} className="w-3 text-slate-300 flex-shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Auto-Sync Drive Root ───────────────────────────── */}
          <section className="admin-card p-5 sm:p-6">
            <CardHeader
              icon="rotate"
              tone="emerald"
              title="Shared Drive สำหรับ Sync"
              subtitle={`ระบบจะ Sync โฟลเดอร์จาก path นี้อัตโนมัติทุก ${syncInterval} นาที`}
            />

            <div>
              <label htmlFor="drive-root" className="field-label">Path ของ Shared Drive</label>
              <input
                id="drive-root"
                type="text"
                className="input-field font-mono"
                value={driveRoot}
                onChange={e => setDriveRoot(e.target.value)}
                placeholder="เช่น R:\ICT\_Cell-E-OnsiteDesktop หรือ \\fileserver\share"
                maxLength={500}
                spellCheck={false}
              />
              <p className="field-hint">
                ใช้ทั้ง Auto-Sync และการกด Sync เอง (ถ้าไม่ได้ระบุ path อื่น) — Path อื่นที่ระบุในหน้า Sync ต้องอยู่ภายใต้ path นี้เท่านั้น
              </p>
              {driveRoot.trim() === '' && (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-800">
                  <FontAwesomeIcon icon={['fas', 'circle-pause']} className="mt-1 flex-shrink-0" />
                  <span>เว้นว่างไว้ = <strong>หยุด Auto-Sync</strong> และจะกด Sync จากหน้า Sync ไม่ได้ จนกว่าจะกรอก path ใหม่</span>
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto"
              disabled={saving || !portalTitle.trim()}
            >
              {saving
                ? <><FontAwesomeIcon icon={['fas', 'circle-notch']} spin /> กำลังบันทึก…</>
                : <><FontAwesomeIcon icon={['fas', 'floppy-disk']} /> บันทึกการตั้งค่า</>}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
