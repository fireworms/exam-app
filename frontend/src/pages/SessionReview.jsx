import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import axios from '../axios'
import API from '../api'
import QuestionCard from '../components/QuestionCard'
import QuestionText from '../components/QuestionText'
import { formatDuration, formatDateTime, accColor, sessionLabel, sessionExamDate } from '../utils/format'

/**
 * 풀이 회차 리뷰 — 시험 직후 결과 화면과 통계의 회차 목록 양쪽에서 진입.
 * 시험 직후에는 location.state로 데이터를 받아 fetch 없이 즉시 표시.
 */
export default function SessionReview() {
  const { session_id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [data, setData] = useState(location.state?.review || null)
  const [loading, setLoading] = useState(!location.state?.review)
  const [error, setError] = useState(null)
  const [detailIdx, setDetailIdx] = useState(null) // null = 목록
  const [wrongOnly, setWrongOnly] = useState(false)

  const items = data?.items || []
  const filtered = wrongOnly ? items.filter(i => i.is_correct === false) : items

  const moveDetail = (delta) => {
    setDetailIdx(prev => {
      if (prev == null) return prev
      const next = prev + delta
      return next >= 0 && next < filtered.length ? next : prev
    })
  }

  useEffect(() => {
    if (data) return
    axios.get(`${API}/sessions/${session_id}/detail`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.status === 404 ? '풀이 기록을 찾을 수 없어요' : '불러오기 실패'))
      .finally(() => setLoading(false))
  }, [session_id])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [detailIdx])

  // 상세 보기 ←/→ 키보드 이동
  useEffect(() => {
    if (detailIdx == null) return
    const handler = (e) => {
      if (e.key === 'ArrowRight') moveDetail(1)
      if (e.key === 'ArrowLeft') moveDetail(-1)
      if (e.key === 'Escape') setDetailIdx(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>불러오는 중...</div>
  if (error || !data) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <div>{error || '데이터 없음'}</div>
      <button onClick={() => navigate('/stats')} style={{
        marginTop: 16, background: 'var(--bg3)', color: 'var(--text)',
        padding: '10px 24px', borderRadius: 8, fontSize: 14, border: '1px solid var(--border)',
      }}>통계로</button>
    </div>
  )

  const { session } = data
  const answered = items.filter(i => i.selected_choice != null).length
  const correct = items.filter(i => i.is_correct).length
  const acc = answered > 0 ? Math.round(correct / answered * 100) : 0
  const examDate = sessionExamDate(session)
  const wrongCount = items.filter(i => i.is_correct === false).length

  // ── 상세 보기 ──────────────────────────────────────
  if (detailIdx != null && filtered[detailIdx]) {
    const item = filtered[detailIdx]
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => setDetailIdx(null)} style={{
            background: 'var(--bg3)', color: 'var(--text2)', padding: '8px 16px',
            borderRadius: 8, fontSize: 13, border: '1px solid var(--border)',
          }}>← 목록으로</button>
          <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'JetBrains Mono' }}>
            {detailIdx + 1} / {filtered.length}
          </span>
          <span style={{
            fontWeight: 700, fontSize: 14,
            color: item.is_correct ? 'var(--correct)' : item.is_correct === false ? 'var(--wrong)' : 'var(--text2)',
          }}>
            {item.is_correct ? '✓ 정답' : item.is_correct === false ? '✗ 오답' : '— 미답변'}
          </span>
        </div>

        <QuestionCard q={item.question} selectedChoice={item.selected_choice}
          showImage showExplanation
          wrongCount={item.is_correct === false ? item.wrong_count : 0}
          headerRight={
            <button onClick={() => navigate(`/edit/${item.question.id}?return=${encodeURIComponent(location.pathname)}`)} style={{
              background: 'transparent', color: 'var(--text2)', fontSize: 12,
              border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6,
            }}>✏️ 편집</button>
          }
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => moveDetail(-1)} disabled={detailIdx === 0} style={{
            flex: 1, background: 'var(--bg3)', color: detailIdx === 0 ? 'var(--border)' : 'var(--text)',
            padding: '14px', borderRadius: 8, fontSize: 14, border: '1px solid var(--border)',
            cursor: detailIdx === 0 ? 'not-allowed' : 'pointer',
          }}>← 이전</button>
          <button onClick={() => moveDetail(1)} disabled={detailIdx >= filtered.length - 1} style={{
            flex: 1, background: detailIdx >= filtered.length - 1 ? 'var(--bg3)' : 'var(--accent)',
            color: detailIdx >= filtered.length - 1 ? 'var(--border)' : 'white',
            padding: '14px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            border: detailIdx >= filtered.length - 1 ? '1px solid var(--border)' : 'none',
            cursor: detailIdx >= filtered.length - 1 ? 'not-allowed' : 'pointer',
          }}>다음 →</button>
        </div>
      </div>
    )
  }

  // ── 목록 ──────────────────────────────────────────
  return (
    <div>
      <button onClick={() => navigate(-1)} style={{
        background: 'var(--bg3)', color: 'var(--text2)', padding: '8px 16px',
        borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', marginBottom: 20,
      }}>← 뒤로</button>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        {sessionLabel(session)} 리뷰
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
        {formatDateTime(session.started_at)}
        {examDate && ` · ${examDate}`}
        {session.duration > 0 && ` · ${formatDuration(session.duration)}`}
      </p>

      {/* 점수 요약 */}
      <div style={{
        display: 'flex', gap: 24, alignItems: 'baseline', flexWrap: 'wrap',
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '18px 24px', marginBottom: 24,
      }}>
        <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'var(--accent)' }}>
          {correct} / {session.total_count || items.length}
        </span>
        <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono', color: accColor(acc), fontSize: 16 }}>
          정답률 {acc}%
        </span>
        {wrongCount > 0 && <span style={{ fontSize: 13, color: 'var(--wrong)' }}>오답 {wrongCount}</span>}
        {answered < items.length && <span style={{ fontSize: 13, color: 'var(--text2)' }}>미답변 {items.length - answered}</span>}
      </div>

      {/* 오답만 토글 */}
      {wrongCount > 0 && (
        <button onClick={() => setWrongOnly(p => !p)} style={{
          background: wrongOnly ? 'rgba(248,113,113,0.1)' : 'var(--bg3)',
          border: `1px solid ${wrongOnly ? 'var(--wrong)' : 'var(--border)'}`,
          color: wrongOnly ? 'var(--wrong)' : 'var(--text2)',
          padding: '8px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16,
        }}>
          {wrongOnly ? `오답만 보는 중 (${wrongCount})` : `오답만 보기 (${wrongCount})`}
        </button>
      )}

      {/* 문제 리스트 */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: 'var(--bg2)', overflow: 'hidden',
      }}>
        {filtered.map((item, i) => {
          const q = item.question
          const correctNum = q.choices.find(c => c.is_correct)?.number
          return (
            <div key={q.id} onClick={() => setDetailIdx(i)} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 90px 20px',
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              fontSize: 13, alignItems: 'center', gap: 10, cursor: 'pointer',
            }}>
              <span style={{
                fontWeight: 700, textAlign: 'center',
                color: item.is_correct ? 'var(--correct)' : item.is_correct === false ? 'var(--wrong)' : 'var(--text2)',
              }}>
                {item.is_correct ? 'O' : item.is_correct === false ? 'X' : '—'}
                {item.is_correct === false && item.wrong_count >= 2 && (
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 700 }}>{item.wrong_count}회째</span>
                )}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>
                  {q.subject} · Q{q.number}
                </div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <QuestionText text={q.question_text} maxLength={60} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'JetBrains Mono', textAlign: 'center' }}>
                {item.selected_choice != null
                  ? (item.is_correct ? `${item.selected_choice}번 ✓` : `${item.selected_choice}→${correctNum}번`)
                  : `정답 ${correctNum}번`}
              </span>
              <span style={{ color: 'var(--accent)' }}>›</span>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>
            표시할 문제가 없어요
          </div>
        )}
      </div>
    </div>
  )
}
