import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
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
      // Only clear and redirect if we're on an admin page
      if (window.location.pathname.startsWith('/administrator')) {
        sessionStorage.removeItem('km_credentials')
        sessionStorage.removeItem('km_user')
        window.location.href = '/admin-login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
