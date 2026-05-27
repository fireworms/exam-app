import axios from 'axios'
import { getToken, setToken, clearToken, getRefreshToken } from './api'
import API from './api'

const instance = axios.create()

instance.interceptors.request.use(config => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let waitQueue = []

function processQueue(error, token = null) {
  waitQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  waitQueue = []
}

instance.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }

    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      clearToken()
      window.location.href = '/login'
      return Promise.reject(err)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waitQueue.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return instance(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const res = await axios.post(`${API}/auth/refresh`, { refresh_token: refreshToken })
      const { access_token, refresh_token } = res.data
      setToken(access_token, refresh_token)
      instance.defaults.headers.common.Authorization = `Bearer ${access_token}`
      processQueue(null, access_token)
      original.headers.Authorization = `Bearer ${access_token}`
      return instance(original)
    } catch (refreshErr) {
      processQueue(new Error('refresh failed'))
      if (refreshErr.response?.status === 401) {
        clearToken()
        window.location.href = '/login'
      }
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

export default instance
