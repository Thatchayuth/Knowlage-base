import { useState, useEffect } from 'react'
import { fetchMenu } from '../api/services'

export function useMenu() {
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    const loadMenu = async () => {
      try {
        const data = await fetchMenu()
        if (mounted) {
          setMenu(data)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err.message)
          setMenu([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadMenu()

    return () => {
      mounted = false
    }
  }, [])

  return { menu, loading, error }
}
