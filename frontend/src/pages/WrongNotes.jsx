import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from '../axios'
import API from '../api'
import QuestionCard from '../components/QuestionCard'

function NoteCard({ q, onRemove }) {
  const [memo, setMemo] = useState(q.memo || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const saveMemo = async () => {
    setSaving(true)
    await axios.put(`${API}/wrong-notes/${q.id}/memo`, { memo })
    setSaving(false)
    setEditing(false)
  }

  return (
    <QuestionCard q={q} maxLength={150}
      headerRight={
        <button onClick={() => onRemove(q.id)} style={{
          background: 'transparent', color: 'var(--text2)', fontSize: 12,
          border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6,
        }}>
          제거
        </button>
      }
    >
      {/* 메모 */}
      {editing ? (
        <div style={{ marginTop: 14 }}>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="왜 틀렸는지, 기억할 내용..."
            rows={3}
            autoFocus
            style={{
              width: '100%', background: 'var(--bg3)', border: '1px solid var(--accent)',
              borderRadius: 6, padding: '8px 10px', fontSize: 13, color: 'var(--text)',
              resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={saveMemo} disabled={saving} style={{
              background: 'var(--accent)', color: 'white',
              padding: '6px 14px', borderRadius: 6, fontSize: 13,
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => { setEditing(false); setMemo(q.memo || '') }} style={{
              background: 'var(--bg3)', color: 'var(--text2)',
              padding: '6px 14px', borderRadius: 6, fontSize: 13,
              border: '1px solid var(--border)',
            }}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            marginTop: 14,
            fontSize: 13, padding: '8px 10px', borderRadius: 6,
            background: 'var(--bg3)', border: '1px dashed var(--border)',
            color: memo ? 'var(--text)' : 'var(--text2)',
            cursor: 'pointer', minHeight: 36, lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {memo || '메모 추가... (클릭)'}
        </div>
      )}
    </QuestionCard>
  )
}

export default function WrongNotes() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const res = await axios.get(`${API}/wrong-notes`)
    setNotes(res.data)
    setLoading(false)
  }

  const remove = async (questionId) => {
    await axios.delete(`${API}/wrong-notes/${questionId}`)
    setNotes(prev => prev.filter(n => n.id !== questionId))
  }

  if (loading) return <div style={{ color: 'var(--text2)', padding: 40 }}>불러오는 중...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>오답노트</h1>
        {notes.length > 0 && (
          <button onClick={() => navigate('/quiz?mode=wrong')} style={{
            background: 'var(--accent)', color: 'white',
            padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          }}>
            오답만 풀기 →
          </button>
        )}
      </div>
      <p style={{ color: 'var(--text2)', marginBottom: 32 }}>
        {notes.length > 0 ? `${notes.length}개의 오답 문제가 있어요` : '오답 문제가 없어요 🎉'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notes.map(q => (
          <NoteCard key={q.id} q={q} onRemove={remove} />
        ))}
      </div>
    </div>
  )
}
