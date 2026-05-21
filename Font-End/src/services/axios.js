import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 60000,   // 60s general; sync calls override per-request
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach Basic Auth from session storage if present
api.interceptors.request.use(
  (config) => {
    const credentials = sessionStorage.getItem('km_credentials')
    if (credentials) {
      config.headers['Authorization'] = `Basic ${credentials}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401/403 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login if on admin or portal pages
      const path = window.location.pathname
      if (path.startsWith('/administrator') || path.startsWith('/portal')) {
        sessionStorage.removeItem('km_credentials')
        sessionStorage.removeItem('km_user')
        window.location.href = '/admin-login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
