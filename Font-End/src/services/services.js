import api from './axios'

// ─── Public ──────────────────────────────────────────────────
export const fetchMenu = () =>
  api.get('/api/menu').then(r => r.data.data)

export const fetchKnowledge = id =>
  api.get(`/api/knowledge/${id}`).then(r => r.data.data)

export const searchKnowledge = (q, page = 1, limit = 20) =>
  api.get('/api/search', { params: { q, page, limit } }).then(r => r.data.data)

// ─── Auth ─────────────────────────────────────────────────────
export const fetchCurrentUser = () =>
  api.get('/api/auth/me').then(r => r.data)

export const login = (username, password) => {
  const encoded = btoa(`${username}:${password}`)
  sessionStorage.setItem('km_credentials', encoded)
  return api.get('/api/auth/me')
    .then(r => {
      sessionStorage.setItem('km_user', JSON.stringify(r.data))
      return r.data
    })
    .catch(err => {
      sessionStorage.removeItem('km_credentials')
      throw err
    })
}

export const logout = () => {
  sessionStorage.removeItem('km_credentials')
  sessionStorage.removeItem('km_user')
}

// ─── Admin: Level 1 ───────────────────────────────────────────
export const adminCreateLevel1  = (data)     => api.post('/api/admin/level1', data).then(r => r.data.data)
export const adminUpdateLevel1  = (id, data) => api.put(`/api/admin/level1/${id}`, data).then(r => r.data.data)
export const adminDeleteLevel1  = (id)       => api.delete(`/api/admin/level1/${id}`).then(r => r.data)

// ─── Admin: Level 2 ───────────────────────────────────────────
export const adminCreateLevel2  = (data)     => api.post('/api/admin/level2', data).then(r => r.data.data)
export const adminUpdateLevel2  = (id, data) => api.put(`/api/admin/level2/${id}`, data).then(r => r.data.data)
export const adminDeleteLevel2  = (id)       => api.delete(`/api/admin/level2/${id}`).then(r => r.data)
export const adminToggleLevel2  = (id)       => api.patch(`/api/admin/level2/${id}/toggle`).then(r => r.data.data)

// ─── Admin: Knowledge ─────────────────────────────────────────
export const adminCreateKnowledge = (data)     => api.post('/api/admin/knowledge', data).then(r => r.data.data)
export const adminUpdateKnowledge = (id, data) => api.put(`/api/admin/knowledge/${id}`, data).then(r => r.data.data)
export const adminDeleteKnowledge = (id)       => api.delete(`/api/admin/knowledge/${id}`).then(r => r.data)
