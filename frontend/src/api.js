const API = import.meta.env.VITE_API_URL || ''

export function getToken() {
  return localStorage.getItem('exam_token')
}

export function setToken(token, refreshToken) {
  localStorage.setItem('exam_token', token)
  if (refreshToken) localStorage.setItem('exam_refresh_token', refreshToken)
}

export function getRefreshToken() {
  return localStorage.getItem('exam_refresh_token')
}

export function clearToken() {
  localStorage.removeItem('exam_token')
  localStorage.removeItem('exam_refresh_token')
  localStorage.removeItem('exam_user')
}

export function authFetch(url, options = {}) {
  const token = getToken()
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401) {
      clearToken()
      window.location.href = '/login'
    }
    return res
  })
}

export default API
