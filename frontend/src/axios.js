import axios from 'axios'
import { supabase } from './supabase'

const instance = axios.create()

let currentToken = null

// getSession() 완료 전에 API 요청이 나가지 않도록 Promise로 대기
const tokenReady = supabase.auth.getSession().then(({ data: { session } }) => {
  currentToken = session?.access_token || null
})

// 토큰 변경 시 캐시 업데이트
supabase.auth.onAuthStateChange((_event, session) => {
  currentToken = session?.access_token || null
  if (!session && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/reset-password')) {
    window.location.href = '/login'
  }
})

instance.interceptors.request.use(async config => {
  await tokenReady
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
