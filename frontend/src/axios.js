import axios from 'axios'
import { supabase } from './supabase'

const instance = axios.create()

let currentToken = null

// 세션 초기화
supabase.auth.getSession().then(({ data: { session } }) => {
  currentToken = session?.access_token || null
})

// 토큰 변경 시 캐시 업데이트
supabase.auth.onAuthStateChange((_event, session) => {
  currentToken = session?.access_token || null
  if (!session && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/reset-password')) {
    window.location.href = '/login'
  }
})

instance.interceptors.request.use(config => {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`
  }
  return config
})

instance.interceptors.response.use(
  res => res,
  err => Promise.reject(err)
)

export default instance
