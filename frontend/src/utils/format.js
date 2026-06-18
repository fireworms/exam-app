// 세션·통계 공용 포맷 헬퍼

export function formatDuration(seconds) {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

export function formatTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`
}

export function accColor(acc) {
  return acc >= 70 ? 'var(--correct)' : acc >= 50 ? 'var(--scrap)' : 'var(--wrong)'
}

// 세션의 표시 라벨 (과목 또는 모드명)
export function sessionLabel(session) {
  return session.subject || (session.mode === 'exam' ? '시험모드' : '전체랜덤')
}

// 시험 회차 날짜 라벨: "2024년 6월 15일" (+옵션: grade·region)
export function examDateLabel(exam, { day = true, grade = false, region = false } = {}) {
  if (!exam) return ''
  const parts = [`${exam.year}년`, `${exam.month}월`]
  if (day && exam.day) parts.push(`${exam.day}일`)
  if (grade && exam.grade) parts.push(exam.grade)
  if (region && exam.region) parts.push(exam.region)
  return parts.join(' ')
}

// 세션이 특정 회차 풀이인 경우 시험 날짜 라벨
export function sessionExamDate(session) {
  if (!session.exam_year) return null
  return `${session.exam_year}년 ${session.exam_month ? session.exam_month + '월' : ''}${session.exam_day ? ' ' + session.exam_day + '일' : ''}`
}
