import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { fetchCurrentUser, logout as apiLogout } from '../api/services'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState(false)

  const checkAuth = useCallback(async () => {
    const cached = sessionStorage.getItem('km_user')
    const creds  = sessionStorage.getItem('km_credentials')

    if (!creds) {
      setUser(null)
      setLoading(false)
      setChecked(true)
      return null
    }

    if (cached) {
      const u = JSON.parse(cached)
      setUser(u)
      setLoading(false)
      setChecked(true)
      // Re-validate in background
      fetchCurrentUser()
        .then(fresh => { setUser(fresh); sessionStorage.setItem('km_user', JSON.stringify(fresh)) })
        .catch(() => {
          setUser(null)
          sessionStorage.removeItem('km_credentials')
          sessionStorage.removeItem('km_user')
        })
      return u
    }

    try {
      const u = await fetchCurrentUser()
      setUser(u)
      sessionStorage.setItem('km_user', JSON.stringify(u))
      return u
    } catch {
      setUser(null)
      sessionStorage.removeItem('km_credentials')
      sessionStorage.removeItem('km_user')
      return null
    } finally {
      setLoading(false)
      setChecked(true)
    }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const logout = useCallback(() => {
    apiLogout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, checked, checkAuth, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
