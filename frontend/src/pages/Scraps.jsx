import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

import API from '../api'

export default function Scraps() {
  const [scraps, setScraps] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const res = await axios.get(`${API}/scraps`)
    setScraps(res.data)
    setLoading(false)
  }

  const remove = async (questionId) => {
    await axios.delete(`${API}/scraps/${questionId}`)
    setScraps(prev => prev.filter(s => s.id !== questionId))
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: 40 }}>불러오는 중...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>스크랩</h1>
        {scraps.length > 0 && (
          <button onClick={() => navigate('/quiz?mode=scrap')} style={{
            background: 'var(--scrap)', color: '#000',
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          }}>
            스크랩만 풀기 →
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text2)', marginBottom: 32 }}>
        {scraps.length > 0 ? `${scraps.length}개의 스크랩 문제가 있어요` : '스크랩한 문제가 없어요'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {scraps.map(q => (
          <div key={q.id} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {q.subject} · {q.year}년 {q.month}월 · Q{q.number}
              </div>
              <button onClick={() => remove(q.id)} style={{
                background: 'transparent', color: 'var(--text2)', fontSize: 12,
                border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6,
              }}>
                제거
              </button>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
              {q.question_text.length > 150 ? q.question_text.slice(0, 150) + '...' : q.question_text}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {q.choices.map(c => (
                <div key={c.id} style={{
                  fontSize: 13, padding: '6px 10px', borderRadius: 6,
                  background: c.is_correct ? 'rgba(74,222,128,0.1)' : 'transparent',
                  color: c.is_correct ? 'var(--correct)' : 'var(--text2)',
                  border: c.is_correct ? '1px solid rgba(74,222,128,0.3)' : '1px solid transparent',
                }}>
                  {c.number}. {c.text}
                </div>
              ))}
            </div>
            {q.memo && (
              <div style={{
                marginTop: 12, padding: '8px 12px', background: 'var(--bg3)',
                borderRadius: 6, fontSize: 13, color: 'var(--text2)',
              }}>
                📝 {q.memo}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
