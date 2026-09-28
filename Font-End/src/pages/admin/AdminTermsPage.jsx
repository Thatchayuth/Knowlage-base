import { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useToast } from '../../components/ui/Toast'
import api from '../../services/axios'
import { adminFetchSettings } from '../../services/services'
import PageHeader from '../../components/ui/PageHeader'
import Toggle from '../../components/ui/Toggle'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { LoadingState, ErrorState, apiError } from '../../components/ui/States'

const ACCEPT_TYPES = 'image/jpeg,image/png,image/gif,image/webp'
const ACCEPT_LIST  = ACCEPT_TYPES.split(',')
const MAX_SIZE_MB  = 10
const MAX_MINUTES  = 480

function CardHeader({ icon, title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-4 mb-5 border-b border-slate-100">
      <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg bg-brand-soft text-brand">
        <FontAwesomeIcon icon={['fas', icon]} />
      </span>
      <div className="flex-1 min-w-0">
        <h2 className="font-display font-bold text-lg text-slate-800">{title}</h2>
        {subtitle && <p className="text-base text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export default function AdminTermsPage() {
  const { toast } = useToast()
  const fileInputRef = useRef(null)
  const imgUrlRef    = useRef(null)   // blob URL ปัจจุบัน (ไว้ revoke)
  const previewRef   = useRef(null)   // blob URL preview ปัจจุบัน (ไว้ revoke)

  const [imgUrl,    setImgUrl]    = useState(null)   // blob URL ของรูปปัจจุบัน
  const [enabled,   setEnabled]   = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [preview,   setPreview]   = useState(null)   // blob URL preview ก่อน upload
  const [file,      setFile]      = useState(null)   // File object
  const [dragOver,  setDragOver]  = useState(false)

  // Inactivity timeout settings
  const [inactivityMinutes, setInactivityMinutes] = useState(0)
  const [savingSettings,    setSavingSettings]    = useState(false)
  // ค่าที่บันทึกอยู่ใน server (ไว้เทียบว่าแก้ไขแล้วยังไม่บันทึก)
  const [saved, setSaved] = useState({ enabled: false, minutes: 0 })

  // แทนที่ blob URL พร้อม revoke ตัวเก่า
  const replaceImgUrl = (url) => {
    if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current)
    imgUrlRef.current = url
    setImgUrl(url)
  }
  const replacePreview = (url) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)
  }

  // โหลดเฉพาะรูปปัจจุบัน (ไม่แตะค่าอื่นในฟอร์ม)
  const loadCurrentImage = () =>
    api.get('/api/settings/terms-image', { responseType: 'blob' })
      .then(resp => replaceImgUrl(URL.createObjectURL(resp.data)))
      .catch(() => replaceImgUrl(null))

  // โหลด settings + รูป (ครั้งแรกที่เปิดหน้า)
  const loadAll = () => {
    setLoading(true)
    setLoadError(null)
    adminFetchSettings()
      .then(s => {
        s = s || {}
        const en = s.terms_image_enabled === 'true'
        const mins = parseInt(s.terms_inactivity_minutes, 10)
        const m = isNaN(mins) || mins < 0 ? 0 : mins
        setEnabled(en)
        setInactivityMinutes(m)
        setSaved({ enabled: en, minutes: m })
        // มีรูปอยู่ก็แสดง แม้ popup จะถูกปิดอยู่ (เพื่อให้ลบ/ดูได้)
        if (s.terms_image_filename) return loadCurrentImage()
        replaceImgUrl(null)
        return null
      })
      .catch(err => {
        replaceImgUrl(null)
        const message = apiError(err, 'โหลดการตั้งค่าไม่สำเร็จ')
        setLoadError(message)
        toast({ message, type: 'error' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
    return () => {
      if (imgUrlRef.current) URL.revokeObjectURL(imgUrlRef.current)
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, []) // eslint-disable-line

  // ตรวจไฟล์ แล้วตั้งเป็น preview (ใช้ทั้งเลือกไฟล์และลากวาง)
  const acceptFile = (f) => {
    if (!f) return false
    if (!ACCEPT_LIST.includes(f.type)) {
      toast({ message: 'อนุญาตเฉพาะไฟล์ JPG, PNG, GIF หรือ WEBP', type: 'error' })
      return false
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ message: `ไฟล์ใหญ่เกิน ${MAX_SIZE_MB} MB`, type: 'error' })
      return false
    }
    setFile(f)
    replacePreview(URL.createObjectURL(f))
    return true
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!acceptFile(f)) e.target.value = ''   // ให้เลือกไฟล์เดิมซ้ำแล้ว onChange ยังทำงาน
  }

  const openPicker = () => fileInputRef.current?.click()

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (uploading) return
    acceptFile(e.dataTransfer.files?.[0])
  }
  const dragProps = {
    onDragOver:  (e) => { e.preventDefault(); if (!dragOver) setDragOver(true) },
    onDragLeave: () => setDragOver(false),
    onDrop:      handleDrop,
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('termsImage', file)
    try {
      const resp = await api.post('/api/admin/terms-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast({ message: 'อัปโหลดรูปสำเร็จ — เปิด Popup ให้ผู้ใช้แล้ว', type: 'success' })
      setFile(null)
      replacePreview(null)
      // server เปิด popup อัตโนมัติเมื่ออัปโหลด → สะท้อนสถานะนั้น (ไม่แตะเวลา inactivity)
      if (resp.data?.data?.enabled) {
        setEnabled(true)
        setSaved(prev => ({ ...prev, enabled: true }))
      }
      await loadCurrentImage()
    } catch (err) {
      toast({ message: apiError(err, 'อัปโหลดล้มเหลว'), type: 'error' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete('/api/admin/terms-image')
      toast({ message: 'ลบรูปเรียบร้อย — ปิด Popup แล้ว', type: 'success' })
      replaceImgUrl(null)
      setEnabled(false)
      setSaved(prev => ({ ...prev, enabled: false }))
      setConfirmDelete(false)
    } catch (err) {
      toast({ message: apiError(err, 'ลบล้มเหลว'), type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleCancelPreview = () => {
    replacePreview(null)
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const minutesNum   = parseInt(inactivityMinutes, 10)
  const minutesValid = !isNaN(minutesNum) && minutesNum >= 0 && minutesNum <= MAX_MINUTES
  const dirty = enabled !== saved.enabled || (minutesValid ? minutesNum : inactivityMinutes) !== saved.minutes

  const handleSaveSettings = async (e) => {
    e?.preventDefault()
    if (!minutesValid) {
      toast({ message: `กรุณากรอกเวลา 0–${MAX_MINUTES} นาที (0 = ปิดใช้งาน)`, type: 'error' })
      return
    }
    setSavingSettings(true)
    try {
      await api.put('/api/admin/terms-settings', {
        terms_inactivity_minutes: minutesNum,
        terms_image_enabled: enabled,
      })
      setInactivityMinutes(minutesNum)
      setSaved({ enabled, minutes: minutesNum })
      toast({ message: 'บันทึกการตั้งค่าสำเร็จ', type: 'success' })
    } catch (err) {
      toast({ message: apiError(err, 'บันทึกล้มเหลว'), type: 'error' })
    } finally {
      setSavingSettings(false)
    }
  }

  const live = saved.enabled && !!imgUrl
  const statusBadge = (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
      live ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
    }`}>
      <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {live ? 'Popup เปิดอยู่' : imgUrl ? 'Popup ปิดอยู่' : 'ยังไม่มีรูป'}
    </span>
  )

  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={ACCEPT_TYPES}
      className="hidden"
      onChange={handleFileChange}
    />
  )

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <PageHeader
        icon="chalkboard-user"
        title="เรียนรู้การใช้งานระบบ"
        subtitle="รูปแนะนำการใช้งานที่แสดงเป็น Popup ให้ผู้ใช้กดยอมรับหลังเข้าสู่ระบบ"
      />

      {loading ? (
        <LoadingState rows={4} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={loadAll} />
      ) : (
        <div className="space-y-6">
          {/* ── Image card ─────────────────────────────────────── */}
          <section className="admin-card p-5 sm:p-6">
            <CardHeader
              icon="image"
              title="รูปภาพ"
              subtitle={`JPG, PNG, GIF, WEBP · ไม่เกิน ${MAX_SIZE_MB} MB`}
              right={statusBadge}
            />
            {hiddenInput}

            {preview ? (
              /* รูปใหม่ที่ยังไม่ได้อัปโหลด */
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-base font-semibold text-brand">
                  <FontAwesomeIcon icon={['fas', 'eye']} /> ตัวอย่างรูปใหม่ (ยังไม่ได้อัปโหลด)
                </div>
                <div className="rounded-2xl border-2 border-brand/30 overflow-hidden bg-slate-50">
                  <img src={preview} alt="ตัวอย่างรูปใหม่" className="w-full h-auto max-h-[420px] object-contain" />
                </div>
                <p className="text-base text-slate-600 break-all">
                  <FontAwesomeIcon icon={['fas', 'file-image']} className="mr-2 text-slate-500" />
                  <span className="font-mono">{file?.name}</span>
                  <span className="text-slate-500"> · {((file?.size || 0) / 1024 / 1024).toFixed(2)} MB</span>
                </p>
                <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-base text-sky-900">
                  <FontAwesomeIcon icon={['fas', 'circle-info']} className="mt-1 flex-shrink-0" />
                  <span>
                    เมื่ออัปโหลด ระบบจะ<strong>แทนที่รูปเดิม</strong>และ<strong>เปิด Popup ให้อัตโนมัติ</strong>
                  </span>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                  <button type="button" onClick={handleCancelPreview} disabled={uploading} className="btn-secondary">
                    ยกเลิก
                  </button>
                  <button type="button" onClick={handleUpload} disabled={uploading} className="btn-primary">
                    {uploading
                      ? <><FontAwesomeIcon icon={['fas', 'circle-notch']} spin /> กำลังอัปโหลด…</>
                      : <><FontAwesomeIcon icon={['fas', 'cloud-arrow-up']} /> อัปโหลดและเปิด Popup</>}
                  </button>
                </div>
              </div>
            ) : imgUrl ? (
              /* รูปปัจจุบัน */
              <div className="space-y-4">
                <div
                  {...dragProps}
                  className={`relative rounded-2xl border overflow-hidden bg-slate-50 transition-colors [&>*]:pointer-events-none ${
                    dragOver ? 'border-brand ring-4 ring-brand/15' : 'border-slate-200'
                  }`}
                >
                  <img src={imgUrl} alt="รูปเรียนรู้การใช้งานระบบปัจจุบัน" className="w-full h-auto max-h-[480px] object-contain" />
                  {dragOver && (
                    <div className="absolute inset-0 flex items-center justify-center bg-brand-soft/90 text-lg font-semibold text-brand">
                      <FontAwesomeIcon icon={['fas', 'file-arrow-down']} className="mr-2" /> วางไฟล์เพื่อเปลี่ยนรูป
                    </div>
                  )}
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
                  <button type="button" onClick={() => setConfirmDelete(true)} className="btn-secondary !text-red-600 !border-red-200 hover:!bg-red-50">
                    <FontAwesomeIcon icon={['fas', 'trash-can']} /> ลบรูป
                  </button>
                  <button type="button" onClick={openPicker} className="btn-primary">
                    <FontAwesomeIcon icon={['fas', 'arrows-rotate']} /> เปลี่ยนรูป
                  </button>
                </div>
                <p className="field-hint !mt-0">ลากไฟล์รูปมาวางบนรูปด้านบนเพื่อเปลี่ยนได้เช่นกัน</p>
              </div>
            ) : (
              /* ยังไม่มีรูป → dropzone */
              <button
                type="button"
                onClick={openPicker}
                {...dragProps}
                className={`w-full flex flex-col items-center justify-center gap-3 px-6 py-12 rounded-2xl border-2 border-dashed [&>*]:pointer-events-none text-center transition-colors focus:outline-none focus:ring-4 focus:ring-brand/15 ${
                  dragOver
                    ? 'border-brand bg-brand-soft'
                    : 'border-slate-300 bg-slate-50 hover:border-brand/50 hover:bg-brand-soft/50'
                }`}
              >
                <span className="w-14 h-14 rounded-2xl bg-white text-brand shadow-sm flex items-center justify-center text-2xl">
                  <FontAwesomeIcon icon={['fas', 'cloud-arrow-up']} />
                </span>
                <span className="text-lg font-semibold text-slate-800">
                  {dragOver ? 'วางไฟล์ที่นี่' : 'คลิกเพื่อเลือกรูป หรือลากไฟล์มาวาง'}
                </span>
                <span className="text-base text-slate-500">
                  JPG, PNG, GIF, WEBP · ไม่เกิน {MAX_SIZE_MB} MB — อัปโหลดแล้ว Popup จะเปิดให้อัตโนมัติ
                </span>
              </button>
            )}
          </section>

          {/* ── Settings card ──────────────────────────────────── */}
          <form onSubmit={handleSaveSettings} className="admin-card p-5 sm:p-6">
            <CardHeader
              icon="gear"
              title="การแสดง Popup"
              subtitle="เปิด/ปิด Popup และกำหนดให้แสดงซ้ำเมื่อไม่มีการใช้งาน"
            />

            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <Toggle
                  checked={enabled}
                  onChange={setEnabled}
                  label="แสดง Popup ให้ผู้ใช้หลังเข้าสู่ระบบ"
                  disabled={savingSettings || (!imgUrl && !enabled)}
                />
                <p className="field-hint !mt-0">
                  {imgUrl
                    ? 'เมื่อปิด ผู้ใช้จะไม่เห็น Popup แม้จะมีรูปอยู่'
                    : 'ต้องอัปโหลดรูปก่อนจึงจะเปิด Popup ได้'}
                </p>
              </div>

              <div>
                <label htmlFor="inactivity-minutes" className="field-label">แสดง Popup ซ้ำเมื่อไม่มีการใช้งานนาน</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="inactivity-minutes"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_MINUTES}
                    value={inactivityMinutes}
                    onChange={e => setInactivityMinutes(e.target.value)}
                    className="input-field !w-36"
                    placeholder="0"
                    disabled={savingSettings}
                  />
                  <span className="text-base text-slate-600">นาที</span>
                  {minutesValid && minutesNum > 0 && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-brand-soft text-brand">
                      <FontAwesomeIcon icon={['fas', 'clock-rotate-left']} />
                      แสดงซ้ำเมื่อไม่มีการใช้งาน {minutesNum} นาที
                    </span>
                  )}
                  {minutesValid && minutesNum === 0 && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100 text-slate-600">
                      แสดงครั้งเดียวต่อ session
                    </span>
                  )}
                </div>
                {!minutesValid && inactivityMinutes !== '' ? (
                  <p className="field-error">กรุณากรอกตัวเลข 0–{MAX_MINUTES}</p>
                ) : (
                  <p className="field-hint">0 = ไม่แสดงซ้ำ · สูงสุด {MAX_MINUTES} นาที (8 ชั่วโมง)</p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <span className={`inline-flex items-center gap-2 text-base ${dirty ? 'text-amber-700 font-semibold' : 'text-slate-500'}`} aria-live="polite">
                <FontAwesomeIcon icon={['fas', dirty ? 'circle-exclamation' : 'circle-check']} className={dirty ? '' : 'text-emerald-600'} />
                {dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'บันทึกแล้ว'}
              </span>
              <button type="submit" disabled={savingSettings || !dirty || !minutesValid} className="btn-primary">
                {savingSettings
                  ? <><FontAwesomeIcon icon={['fas', 'circle-notch']} spin /> กำลังบันทึก…</>
                  : <><FontAwesomeIcon icon={['fas', 'floppy-disk']} /> บันทึกการตั้งค่า</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        isDangerous
        title="ลบรูปเรียนรู้การใช้งานระบบ"
        message="ลบรูปนี้และปิด Popup ทันที ผู้ใช้จะไม่เห็น Popup จนกว่าจะอัปโหลดรูปใหม่"
        confirmText="ลบรูป"
      />
    </div>
  )
}
