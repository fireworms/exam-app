const API = import.meta.env.VITE_API_URL || '/api'

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

export default API
