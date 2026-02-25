import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'

export default function ProtectedRoute({ children, requiredRole = 'admin' }) {
  const { user, loading, checked, checkAuth } = useAuth()
  const location = useLocation()
  const [verifying, setVerifying] = useState(!checked)

  useEffect(() => {
    if (!checked) {
      checkAuth().finally(() => setVerifying(false))
    } else {
      setVerifying(false)
    }
  }, [checked, checkAuth])

  if (loading || verifying) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-slate-400 text-sm font-mono">Verifying access…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin-login" state={{ from: location }} replace />
  }

  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
