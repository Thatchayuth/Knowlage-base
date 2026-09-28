import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { login } from '../api/services'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import Spinner from '../components/ui/Spinner'
import LogoNCR from '../img/NCR-logo-web.png'

export default function AdminLoginPage() {
  const { user, setUser, loading: authLoading } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const { toast }  = useToast()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [showPass, setShowPass] = useState(false)

  const from = location.state?.from?.pathname || '/'

  useEffect(() => {
    if (!authLoading && user) {
      navigate(from, { replace: true })
    }
  }, [user, authLoading, navigate, from])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError(null)
    setSubmitting(true)

    try {
      const u = await login(username.trim(), password)
      setUser(u)

      toast({ message: `Welcome, ${u.username}`, type: 'success' })

      navigate(from, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid username or password'
      setError(msg)
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-base text-brand-ink placeholder:text-slate-400 shadow-sm outline-none transition-all focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-60'
  const labelCls = 'block text-sm font-semibold text-slate-600 mb-1.5'

  return (
    <div className="min-h-screen app-shell flex items-center justify-center p-4">
      {/* Glows behind the card, in the column colors */}
      <div className="fixed top-1/4 left-1/2 -translate-x-[70%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/3 left-1/2 -translate-x-[10%] w-96 h-96 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[440px] relative modal-panel-in">
        {/* Card — same floating style as the home columns */}
        <div className="relative overflow-hidden rounded-[28px] bg-white border border-slate-200/70 shadow-[0_1px_3px_rgba(10,24,85,0.08),0_16px_40px_-10px_rgba(10,24,85,0.25),0_40px_80px_-28px_rgba(10,24,85,0.30)]">
          {/* Accent line in the column colors */}
          <div
            aria-hidden="true"
            className="h-1.5"
            style={{ background: 'linear-gradient(90deg, #1e40af 0%, #16a34a 50%, #0d9488 100%)' }}
          />

          <div className="px-8 pt-8 pb-9 sm:px-10">
            <div className="text-center mb-8">
              <img src={LogoNCR} alt="NCR" className="mx-auto h-20 w-auto" />
              <h1 className="mt-4 font-display font-bold text-2xl text-brand-ink">Cell-E Onsite Desktop</h1>
              <p className="text-slate-500 text-sm mt-1">Sign in with your domain credentials</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelCls}>Username</label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="domain\username"
                  className={inputCls}
                  disabled={submitting}
                  autoFocus
                />
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputCls} pr-12`}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand hover:bg-slate-100 transition-colors"
                    tabIndex={-1}
                    aria-label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPass ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full h-12 justify-center text-base rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={submitting || !username.trim() || !password}
              >
                {submitting ? <Spinner size="sm" /> : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                )}
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6 font-mono">
          Copyright © 2026 N.C.R. Rubber Industry Company.
        </p>
      </div>
    </div>
  )
}
