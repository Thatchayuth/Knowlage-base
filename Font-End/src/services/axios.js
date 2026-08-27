import axios from 'axios'

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If we are running the built production app (not in Vite dev server),
    // and the configured VITE_API_URL is empty or points to localhost/127.0.0.1
    if (!import.meta.env.DEV && (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      // Dynamic fallback: Use the same server protocol and host, but target port 5203 (backend port on IIS)
      return `${window.location.protocol}//${hostname}:5203`;
    }
  }
  return envUrl || '';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
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
