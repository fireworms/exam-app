import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API, { setToken } from '../api'

function getPasswordStrength(pw) {
  if (!pw) return null
  const long = pw.length >= 8
  const hasLetter = /[a-zA-Z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw)
  const score = [long, hasLetter, hasNumber, hasSpecial].filter(Boolean).length
  if (score <= 2) return { label: '약함', color: '#ff6b6b', width: '33%' }
  if (score === 3) return { label: '보통', color: '#ffd93d', width: '66%' }
  return { label: '강함', color: '#6bcb77', width: '100%' }
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const strength = mode === 'signup' ? getPasswordStrength(password) : null
  const confirmMismatch = mode === 'signup' && confirm && password !== confirm

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (mode === 'signup' && password !== confirm) {
      setError('비밀번호가 일치하지 않아요')
      return
    }
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/signup'
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || '오류가 발생했어요')
        return
      }
      if (mode === 'login') {
        setToken(data.access_token, data.refresh_token)
        localStorage.setItem('exam_user', data.email)
        navigate('/')
      } else {
        setMode('login')
        setPassword('')
        setConfirm('')
        setInfo('회원가입 완료! 로그인해주세요.')
      }
    } catch {
      setError('서버에 연결할 수 없어요')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) { setError('이메일을 먼저 입력해주세요'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || '오류가 발생했어요'); return }
      setInfo('비밀번호 재설정 이메일을 보냈어요. 받은편지함을 확인해주세요.')
    } catch {
      setError('서버에 연결할 수 없어요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>📝 공시생 문제풀이</h1>
        <div style={s.tabs}>
          <button style={mode === 'login' ? s.tabActive : s.tab} onClick={() => { setMode('login'); setError(''); setInfo('') }}>로그인</button>
          <button style={mode === 'signup' ? s.tabActive : s.tab} onClick={() => { setMode('signup'); setError(''); setInfo('') }}>회원가입</button>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="email" placeholder="이메일" value={email}
            onChange={e => setEmail(e.target.value)}
            style={s.input} required autoFocus
          />

          {/* 비밀번호 + 토글 */}
          <div style={s.pwWrap}>
            <input
              type={showPw ? 'text' : 'password'} placeholder="비밀번호 (영문+숫자 8자 이상)"
              value={password} onChange={e => setPassword(e.target.value)}
              style={{ ...s.input, paddingRight: 40, margin: 0 }} required
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={s.eyeBtn}>
              {showPw ? '🙈' : '👁'}
            </button>
          </div>

          {/* 비밀번호 강도 */}
          {strength && (
            <div style={s.strengthWrap}>
              <div style={{ ...s.strengthBar, width: strength.width, background: strength.color }} />
              <span style={{ ...s.strengthLabel, color: strength.color }}>{strength.label}</span>
            </div>
          )}

          {/* 비밀번호 확인 (회원가입만) */}
          {mode === 'signup' && (
            <input
              type={showPw ? 'text' : 'password'} placeholder="비밀번호 확인"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              style={{ ...s.input, borderColor: confirmMismatch ? '#ff6b6b' : undefined }} required
            />
          )}
          {confirmMismatch && <p style={s.error}>비밀번호가 일치하지 않아요</p>}

          {error && <p style={s.error}>{error}</p>}
          {info && <p style={s.info}>{info}</p>}

          <button type="submit" style={s.btn} disabled={loading || confirmMismatch}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>

          {mode === 'login' && (
            <button type="button" onClick={handleForgotPassword} style={s.linkBtn} disabled={loading}>
              비밀번호를 잊으셨나요?
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #0f0f0f)' },
  card: { background: 'var(--surface, #1a1a1a)', borderRadius: 16, padding: '40px 36px', width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  title: { textAlign: 'center', marginBottom: 24, fontSize: 22, color: 'var(--text, #fff)' },
  tabs: { display: 'flex', marginBottom: 24, background: 'var(--bg, #0f0f0f)', borderRadius: 8, padding: 4, gap: 4 },
  tab: { flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #888)', fontSize: 14 },
  tabActive: { flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, background: 'var(--primary, #6c63ff)', cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 600 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: { padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border, #333)', background: 'var(--bg, #0f0f0f)', color: 'var(--text, #fff)', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' },
  pwWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 },
  strengthWrap: { display: 'flex', alignItems: 'center', gap: 8, height: 6 },
  strengthBar: { height: 6, borderRadius: 3, transition: 'width 0.3s, background 0.3s', background: '#555' },
  strengthLabel: { fontSize: 12, minWidth: 24 },
  error: { color: '#ff6b6b', fontSize: 13, margin: 0 },
  info: { color: '#6bcb77', fontSize: 13, margin: 0 },
  btn: { marginTop: 4, padding: '13px 0', borderRadius: 8, border: 'none', background: 'var(--primary, #6c63ff)', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--text-muted, #888)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'center' },
}
