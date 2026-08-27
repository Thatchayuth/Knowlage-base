import { useState, useEffect, useRef } from 'react'
import { useToast } from '../../components/ui/Toast'
import Spinner from '../../components/ui/Spinner'
import api from '../../services/axios'

const ACCEPT_TYPES = 'image/jpeg,image/png,image/gif,image/webp'
const MAX_SIZE_MB  = 10

export default function AdminTermsPage() {
  const { toast } = useToast()
  const fileInputRef = useRef(null)

  const [imgUrl,    setImgUrl]    = useState(null)   // blob URL ของรูปปัจจุบัน
  const [enabled,   setEnabled]   = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [preview,   setPreview]   = useState(null)   // blob URL preview ก่อน upload
  const [file,      setFile]      = useState(null)   // File object

  // Inactivity timeout settings
  const [inactivityMinutes, setInactivityMinutes] = useState(0)
  const [savingSettings,    setSavingSettings]    = useState(false)

  // โหลดรูปปัจจุบัน + settings
  const loadCurrentImage = () => {
    setLoading(true)
    api.get('/api/settings')
      .then(r => {
        const s = r.data?.data || {}
        setEnabled(s.terms_image_enabled === 'true')
        const mins = parseInt(s.terms_inactivity_minutes, 10)
        setInactivityMinutes(isNaN(mins) || mins < 0 ? 0 : mins)
        if (s.terms_image_filename && s.terms_image_enabled === 'true') {
          return api.get('/api/settings/terms-image', { responseType: 'blob' })
        }
        return null
      })
      .then(resp => {
        if (resp) {
          const url = URL.createObjectURL(resp.data)
          setImgUrl(url)
        } else {
          setImgUrl(null)
        }
      })
      .catch(() => setImgUrl(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCurrentImage()
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl)
      if (preview) URL.revokeObjectURL(preview)
    }
  }, []) // eslint-disable-line

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ message: `ไฟล์ใหญ่เกิน ${MAX_SIZE_MB} MB`, type: 'error' })
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('termsImage', file)
    try {
      await api.post('/api/admin/terms-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast({ message: 'อัปโหลดรูปเงื่อนไขสำเร็จ', type: 'success' })
      setFile(null)
      if (preview) { URL.revokeObjectURL(preview); setPreview(null) }
      loadCurrentImage()
    } catch {
      toast({ message: 'อัปโหลดล้มเหลว', type: 'error' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('ยืนยันลบรูปเรียนรู้การใช้งานระบบ?')) return
    setDeleting(true)
    try {
      await api.delete('/api/admin/terms-image')
      toast({ message: 'ลบรูปเรียบร้อย', type: 'success' })
      if (imgUrl) { URL.revokeObjectURL(imgUrl); setImgUrl(null) }
      setEnabled(false)
    } catch {
      toast({ message: 'ลบล้มเหลว', type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleCancelPreview = () => {
    if (preview) { URL.revokeObjectURL(preview); setPreview(null) }
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSaveSettings = async () => {
    const mins = parseInt(inactivityMinutes, 10)
    if (isNaN(mins) || mins < 0 || mins > 480) {
      toast({ message: 'กรุณากรอกเวลา 0–480 นาที (0 = ปิดใช้งาน)', type: 'error' })
      return
    }
    setSavingSettings(true)
    try {
      await api.put('/api/admin/terms-settings', {
        terms_inactivity_minutes: mins,
        terms_image_enabled: enabled,
      })
      toast({ message: 'บันทึกการตั้งค่าสำเร็จ', type: 'success' })
    } catch {
      toast({ message: 'บันทึกล้มเหลว', type: 'error' })
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-display font-bold text-slate-800">เรียนรู้การใช้งานระบบ</h1>
        <p className="text-sm text-slate-500 mt-1">
          จัดการรูปภาพเงื่อนไขที่แสดง popup ให้ผู้ใช้ยอมรับหลัง login
        </p>
      </div>

      {/* Current image panel */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            รูปปัจจุบัน
          </h2>
          {/* Status badge */}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            enabled && imgUrl
              ? 'bg-green-100 text-green-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {enabled && imgUrl ? 'เปิดใช้งาน' : 'ปิดใช้งาน / ยังไม่มีรูป'}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner />
          </div>
        ) : imgUrl ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              <img
                src={imgUrl}
                alt="Terms of use"
                className="w-full h-auto max-h-[480px] object-contain"
              />
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? <Spinner size="sm" /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              ลบรูปนี้
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <div className="text-center">
              <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-400">ยังไม่มีรูปเงื่อนไข</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload panel */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          อัปโหลดรูปใหม่
        </h2>

        {/* Drop zone / file input */}
        <label
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm text-slate-500">
            คลิกเพื่อเลือกไฟล์รูป
          </span>
          <span className="text-xs text-slate-400 mt-1">JPG, PNG, GIF, WEBP · สูงสุด {MAX_SIZE_MB} MB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_TYPES}
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {/* Preview ก่อน upload */}
        {preview && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Preview</p>
            <div className="rounded-xl border border-blue-200 overflow-hidden bg-slate-50">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-auto max-h-[400px] object-contain"
              />
            </div>
            <p className="text-xs text-slate-500">
              ไฟล์: <span className="font-mono text-slate-700">{file?.name}</span>
              {' · '}{(file?.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? <Spinner size="sm" /> : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
                อัปโหลด
              </button>
              <button
                onClick={handleCancelPreview}
                disabled={uploading}
                className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-lg transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings panel — enabled toggle + inactivity timeout */}
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          การตั้งค่า Popup
        </h2>

        {/* Enable / Disable toggle */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-700">เปิดใช้งาน Popup เงื่อนไข</p>
            <p className="text-xs text-slate-400 mt-0.5">เมื่อปิด ผู้ใช้จะไม่เห็น popup แม้จะมีรูปอยู่</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              enabled ? 'bg-blue-600' : 'bg-slate-200'
            }`}
            role="switch"
            aria-checked={enabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Inactivity timeout */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            เวลา Inactivity ก่อนแสดง Popup ซ้ำ
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={480}
              value={inactivityMinutes}
              onChange={e => setInactivityMinutes(e.target.value)}
              className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
            <span className="text-sm text-slate-500">นาที</span>
            {inactivityMinutes > 0 && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                แสดงซ้ำทุก {inactivityMinutes} นาที ที่ไม่มีการใช้งาน
              </span>
            )}
            {(inactivityMinutes === 0 || inactivityMinutes === '0' || inactivityMinutes === '') && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                ปิดใช้งาน (แสดงครั้งเดียวต่อ session)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            ค่า 0 = ไม่แสดงซ้ำ · สูงสุด 480 นาที (8 ชั่วโมง)
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {savingSettings ? <Spinner size="sm" /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 13l4 4L19 7" />
            </svg>
          )}
          บันทึกการตั้งค่า
        </button>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4">
        <p className="text-sm text-blue-700 leading-relaxed">
          <span className="font-semibold">หมายเหตุ:</span> รูปภาพนี้จะแสดงเป็น popup modal ให้ผู้ใช้ยอมรับทันทีหลัง login
          ครั้งแรกของแต่ละ session · การอัปโหลดรูปใหม่จะแทนที่รูปเดิมทันที
        </p>
      </div>
    </div>
  )
}
