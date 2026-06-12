import QuestionText from './QuestionText'

/**
 * 문제 카드 — 메타 헤더 + 지문 + 선지(정답/내 선택 하이라이트).
 * 오답노트·스크랩·세션 리뷰에서 공용.
 */
export default function QuestionCard({
  q,
  selectedChoice = null, // 유저가 고른 선지 번호 (오답이면 빨강 표시)
  maxLength = null,      // 지문 미리보기 길이 (null이면 전문)
  showImage = false,
  showExplanation = false,
  headerRight = null,
  children = null,
}) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          {q.subject} · {q.year}년 {q.month}월 · Q{q.number}
        </div>
        {headerRight}
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
        <QuestionText text={q.question_text} maxLength={maxLength || undefined} />
      </div>

      {showImage && q.question_image && (
        <img src={q.question_image} alt="문제 이미지"
          style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block', marginBottom: 12 }} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {q.choices.map(c => {
          const isMyPick = selectedChoice != null && c.number === selectedChoice
          const isWrongPick = isMyPick && !c.is_correct
          return (
            <div key={c.id} style={{
              fontSize: 13, padding: '6px 10px', borderRadius: 6,
              background: c.is_correct ? 'rgba(74,222,128,0.1)' : isWrongPick ? 'rgba(248,113,113,0.1)' : 'transparent',
              color: c.is_correct ? 'var(--correct)' : isWrongPick ? 'var(--wrong)' : 'var(--text2)',
              border: c.is_correct ? '1px solid rgba(74,222,128,0.3)' : isWrongPick ? '1px solid rgba(248,113,113,0.3)' : '1px solid transparent',
            }}>
              {c.number}. {c.text}
              {isMyPick && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>← 내 선택</span>}
            </div>
          )
        })}
      </div>

      {showExplanation && q.explanation && (
        <div style={{
          marginTop: 12, padding: '12px 14px', background: 'var(--bg3)',
          borderRadius: 8, fontSize: 13, lineHeight: 1.8, color: 'var(--text)',
        }}>
          <QuestionText text={q.explanation} />
        </div>
      )}

      {children}
    </div>
  )
}
