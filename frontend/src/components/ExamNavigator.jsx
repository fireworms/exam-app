import { useMemo } from 'react'

// 시험 모드 문제 네비게이터 — 과목별로 묶어 문제 이동·미답변 확인·제출
// props: questions, answers(question_id→choice), current, onJump(idx), onSubmit
export default function ExamNavigator({ questions, answers, current, onJump, onSubmit }) {
  // 과목별로 묶어 표시 (등장 순서 유지)
  const subjectGroups = useMemo(() => {
    const groups = []
    questions.forEach((q, idx) => {
      const last = groups[groups.length - 1]
      if (last && last.subject === q.subject) last.items.push({ q, idx })
      else groups.push({ subject: q.subject, items: [{ q, idx }] })
    })
    return groups
  }, [questions])

  const answeredCount = questions.filter(q => answers[q.id] != null).length
  const allAnswered = answeredCount === questions.length

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 16, marginBottom: 20,
    }}>
      {subjectGroups.map((g, gi) => {
        const answeredInGroup = g.items.filter(it => answers[it.q.id] != null).length
        return (
          <div key={gi} style={{ marginBottom: gi < subjectGroups.length - 1 ? 14 : 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, fontWeight: 600 }}>
              {g.subject}
              <span style={{ marginLeft: 6, opacity: 0.7, fontFamily: 'JetBrains Mono' }}>
                {answeredInGroup}/{g.items.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.items.map(it => {
                const answered = answers[it.q.id] != null
                const isCur = it.idx === current
                return (
                  <button key={it.idx}
                    onClick={() => onJump(it.idx)}
                    style={{
                      width: 34, height: 34, borderRadius: 6, fontSize: 13, cursor: 'pointer',
                      fontFamily: 'JetBrains Mono',
                      border: isCur ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: answered ? 'var(--accent)' : 'var(--bg3)',
                      color: answered ? 'white' : 'var(--text2)',
                    }}>
                    {it.q.number}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 13, color: allAnswered ? 'var(--correct)' : 'var(--scrap)' }}>
          {allAnswered ? '모든 문제 답변 완료' : `미답변 ${questions.length - answeredCount}문제`}
        </span>
        <button onClick={onSubmit} style={{
          background: 'var(--correct)', color: 'white',
          padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          제출 →
        </button>
      </div>
    </div>
  )
}
