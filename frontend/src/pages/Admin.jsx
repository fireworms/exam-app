import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadPage from './UploadPage'
import { UploadLogs, ExamManager } from './LogsPage'
import axios from '../axios'
import API from '../api'

const ADMIN_PW = '1234' // 변경하세요

function ReportsList() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const { data } = await axios.get(`${API}/reports`)
      setReports(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const dismiss = async (questionId) => {
    await axios.delete(`${API}/reports/${questionId}`)
    setReports(prev => prev.filter(r => r.question_id !== questionId))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>불러오는 중...</div>
  if (!reports.length) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text2)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
      신고된 문제가 없어요
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text2)', fontSize: 14 }}>총 {reports.length}건</span>
        <button onClick={load} style={btnStyle}>새로고침</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {reports.map(r => (
          <div key={r.id} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {r.year}년 {r.month}월 · {r.subject} · Q{r.question_number}
                {r.is_mine && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)' }}>내 신고</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.question_text}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, opacity: 0.6 }}>
                {new Date(r.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => navigate(`/edit/${r.question_id}`)} style={btnStyle}>편집</button>
              <button onClick={() => dismiss(r.question_id)} style={{ ...btnStyle, color: 'var(--wrong)', borderColor: 'var(--wrong)' }}>해제</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const TABS = [
  { id: 'upload', label: '업로드' },
  { id: 'logs', label: '로그' },
  { id: 'exams', label: '회차 관리' },
  { id: 'reports', label: '신고' },
]

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('_adm') === '1')
  const [input, setInput] = useState('')
  const [err, setErr] = useState(false)
  const [tab, setTab] = useState('upload')

  const tryUnlock = () => {
    if (input === ADMIN_PW) {
      sessionStorage.setItem('_adm', '1')
      setUnlocked(true)
    } else {
      setErr(true)
      setInput('')
    }
  }

  if (!unlocked) {
    return (
      <div style={{ maxWidth: 320, margin: '120px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔐</div>
        <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>관리자 페이지</h2>
        <input
          type="password" value={input} autoFocus
          onChange={e => { setInput(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && tryUnlock()}
          placeholder="비밀번호"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 14px', fontSize: 15,
            border: `1px solid ${err ? 'var(--wrong)' : 'var(--border)'}`,
            borderRadius: 8, background: 'var(--bg2)', color: 'var(--text)',
            marginBottom: 8, outline: 'none',
          }}
        />
        {err && <div style={{ color: 'var(--wrong)', fontSize: 13, marginBottom: 8 }}>비밀번호가 틀렸어요</div>}
        <button onClick={tryUnlock} style={{
          width: '100%', padding: '10px', background: 'var(--accent)',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>확인</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>관리자</h1>
        <button onClick={() => { sessionStorage.removeItem('_adm'); setUnlocked(false) }}
          style={{ ...btnStyle, fontSize: 12 }}>잠금</button>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
            color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -2, transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'upload' && <UploadPage />}
      {tab === 'logs' && <UploadLogs />}
      {tab === 'exams' && <ExamManager />}
      {tab === 'reports' && <ReportsList />}
    </div>
  )
}

const btnStyle = {
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 7, padding: '6px 14px', cursor: 'pointer',
  fontSize: 13, color: 'var(--text2)',
}
