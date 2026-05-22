import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'

function getPasswordStrength(pw) {
  if (!pw) return null
  const score = [pw.length >= 8, /[a-zA-Z]/.test(pw), /[0-9]/.test(pw), /[^a-zA-Z0-9]/.test(pw)].filter(Boolean).length
  if (score <= 2) return { label: '약함', color: '#ff6b6b', width: '33%' }
  if (score === 3) return { label: '보통', color: '#ffd93d', width: '66%' }
  return { label: '강함', color: '#6bcb77', width: '100%' }
}

export default function ResetPassword() {
  const [token, setToken_] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // URL 해시에서 access_token 추출 (#access_token=...&type=recovery)
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const t = params.get('access_token')
    const type = params.get('type')
    if (t && type === 'recovery') {
      setToken_(t)
    } else {
      setError('유효하지 않은 링크예요.')
    }
  }, [])

  const strength = getPasswordStrength(password)
  const confirmMismatch = confirm && password !== confirm

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('비밀번호가 일치하지 않아요'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/auth/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || '오류가 발생했어요'); return }
      alert('비밀번호가 변경됐어요. 다시 로그인해주세요.')
      localStorage.removeItem('exam_token')
      navigate('/login')
    } catch {
      setError('서버에 연결할 수 없어요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <h1 style={s.title}>🔑 비밀번호 재설정</h1>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.pwWrap}>
            <input
              type={showPw ? 'text' : 'password'} placeholder="새 비밀번호 (영문+숫자 8자 이상)"
              value={password} onChange={e => setPassword(e.target.value)}
              style={{ ...s.input, paddingRight: 40, margin: 0 }} required disabled={!token}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={s.eyeBtn}>{showPw ? '🙈' : '👁'}</button>
          </div>
          {strength && (
            <div style={s.strengthWrap}>
              <div style={{ ...s.strengthBar, width: strength.width, background: strength.color }} />
              <span style={{ fontSize: 12, color: strength.color }}>{strength.label}</span>
            </div>
          )}
          <input
            type={showPw ? 'text' : 'password'} placeholder="비밀번호 확인"
            value={confirm} onChange={e => setConfirm(e.target.value)}
            style={{ ...s.input, borderColor: confirmMismatch ? '#ff6b6b' : undefined }} required disabled={!token}
          />
          {confirmMismatch && <p style={s.error}>비밀번호가 일치하지 않아요</p>}
          {error && <p style={s.error}>{error}</p>}
          <button type="submit" style={s.btn} disabled={loading || !token || confirmMismatch}>
            {loading ? '처리 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #0f0f0f)' },
  card: { background: 'var(--surface, #1a1a1a)', borderRadius: 16, padding: '40px 36px', width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  title: { textAlign: 'center', marginBottom: 24, fontSize: 20, color: 'var(--text, #fff)' },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: { padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border, #333)', background: 'var(--bg, #0f0f0f)', color: 'var(--text, #fff)', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' },
  pwWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 },
  strengthWrap: { display: 'flex', alignItems: 'center', gap: 8, height: 6 },
  strengthBar: { height: 6, borderRadius: 3, transition: 'width 0.3s, background 0.3s' },
  error: { color: '#ff6b6b', fontSize: 13, margin: 0 },
  btn: { marginTop: 4, padding: '13px 0', borderRadius: 8, border: 'none', background: 'var(--primary, #6c63ff)', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' },
}
