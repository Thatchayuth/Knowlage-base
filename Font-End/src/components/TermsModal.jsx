import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/axios'

const STORAGE_KEY = 'km_terms_accepted'

/**
 * TermsModal — แสดง popup เงื่อนไขการใช้งานเป็นรูปภาพหลัง login
 * - อ่านรูปจาก GET /api/settings/terms-image
 * - ถ้า terms_image_enabled = false หรือไม่มีรูป → ไม่แสดง
 * - กด "รับทราบและยอมรับ" → บันทึก sessionStorage → ปิด modal
 * - terms_inactivity_minutes > 0 → เมื่อไม่มี activity นาน N นาที → แสดง popup ซ้ำ
 */
export default function TermsModal({ user }) {
  const [show,    setShow]    = useState(false)
  const [imgSrc,  setImgSrc]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [zoomed,  setZoomed]  = useState(false)

  // refs สำหรับ inactivity timer (ไม่ trigger re-render)
  const inactivityTimerRef = useRef(null)
  const inactivityMinutesRef = useRef(0)  // 0 = ปิดใช้งาน
  const imgSrcRef = useRef(null)          // เก็บ blob URL ที่โหลดแล้ว

  // ── เริ่ม/reset inactivity timer ────────────────────────────
  const startInactivityTimer = useCallback(() => {
    if (inactivityMinutesRef.current <= 0) return
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      // หมดเวลา inactivity → ล้าง sessionStorage → แสดง modal ซ้ำ
      sessionStorage.removeItem(STORAGE_KEY)
      setZoomed(false)
      setShow(true)
    }, inactivityMinutesRef.current * 60 * 1000)
  }, [])

  const resetInactivityTimer = useCallback(() => {
    if (inactivityMinutesRef.current > 0) startInactivityTimer()
  }, [startInactivityTimer])

  // ── โหลด settings + รูปเมื่อ user login ────────────────────
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)

    api.get('/api/settings')
      .then(r => {
        const s = r.data?.data || {}
        // บันทึก inactivity minutes
        const mins = parseInt(s.terms_inactivity_minutes, 10)
        inactivityMinutesRef.current = isNaN(mins) || mins < 0 ? 0 : mins

        if (s.terms_image_enabled !== 'true') return null
        if (!s.terms_image_filename) return null
        return api.get('/api/settings/terms-image', { responseType: 'blob' })
      })
      .then(resp => {
        if (cancelled) return
        if (!resp) {
          // feature ปิดหรือไม่มีรูป → ไม่แสดง แต่ start timer ถ้า already accepted
          if (sessionStorage.getItem(STORAGE_KEY) && inactivityMinutesRef.current > 0) {
            startInactivityTimer()
          }
          return
        }
        const url = URL.createObjectURL(resp.data)
        imgSrcRef.current = url
        if (!cancelled) {
          setImgSrc(url)
          if (!sessionStorage.getItem(STORAGE_KEY)) {
            // ยังไม่ยอมรับ → แสดง modal
            setShow(true)
          } else if (inactivityMinutesRef.current > 0) {
            // ยอมรับแล้ว → เริ่ม inactivity timer
            startInactivityTimer()
          }
        }
      })
      .catch(() => { /* ไม่มีรูป หรือ error → ไม่แสดง */ })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [user, startInactivityTimer])

  // ── ฟัง activity events บน document ────────────────────────
  useEffect(() => {
    if (!user) return
    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    EVENTS.forEach(e => document.addEventListener(e, resetInactivityTimer, { passive: true }))
    return () => {
      EVENTS.forEach(e => document.removeEventListener(e, resetInactivityTimer))
    }
  }, [user, resetInactivityTimer])

  // ── cleanup เมื่อ unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      if (imgSrcRef.current) URL.revokeObjectURL(imgSrcRef.current)
    }
  }, [])

  const handleAccept = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
    setZoomed(false)
    // เริ่ม inactivity countdown หลังจาก user กด ยอมรับ
    startInactivityTimer()
  }, [startInactivityTimer])

  if (!show || loading) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display font-bold text-slate-800 text-base leading-tight">
                เงื่อนไขการใช้งาน
              </h2>
              <p className="text-xs text-slate-500">กรุณาอ่านและยอมรับก่อนใช้งานระบบ</p>
            </div>
          </div>
          {/* Zoom toggle */}
          <button
            onClick={() => setZoomed(z => !z)}
            title={zoomed ? 'ย่อรูป' : 'ขยายรูป'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            {zoomed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>

        {/* Image area */}
        <div className={`flex-1 overflow-auto bg-slate-100 flex items-start justify-center ${zoomed ? 'p-0' : 'p-4'}`}>
          <img
            src={imgSrc}
            alt="เงื่อนไขการใช้งาน"
            className={`rounded-lg shadow-sm select-none transition-all duration-200 ${
              zoomed
                ? 'w-full h-auto rounded-none shadow-none'
                : 'max-w-full h-auto cursor-zoom-in'
            }`}
            onClick={() => !zoomed && setZoomed(true)}
            draggable={false}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500 leading-relaxed flex-1">
            การใช้งานระบบนี้ถือว่าท่านได้อ่านและยอมรับเงื่อนไขการใช้งานทั้งหมดแล้ว
          </p>
          <button
            onClick={handleAccept}
            className="flex-shrink-0 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            รับทราบและยอมรับ
          </button>
        </div>
      </div>
    </div>
  )
}
