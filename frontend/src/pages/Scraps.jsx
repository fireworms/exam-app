import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from '../axios'
import API from '../api'
import QuestionCard from '../components/QuestionCard'

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
          <QuestionCard key={q.id} q={q} maxLength={150}
            headerRight={
              <button onClick={() => remove(q.id)} style={{
                background: 'transparent', color: 'var(--text2)', fontSize: 12,
                border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6,
              }}>
                제거
              </button>
            }
          >
            {q.memo && (
              <div style={{
                marginTop: 12, padding: '8px 12px', background: 'var(--bg3)',
                borderRadius: 6, fontSize: 13, color: 'var(--text2)',
              }}>
                📝 {q.memo}
              </div>
            )}
          </QuestionCard>
        ))}
      </div>
    </div>
  )
}
