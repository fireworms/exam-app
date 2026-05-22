import { useState, useEffect } from 'react'
import axios from '../axios'

import API from '../api'

function formatDuration(seconds) {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

function formatTime(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function accColor(acc) {
  return acc >= 70 ? 'var(--correct)' : acc >= 50 ? 'var(--scrap)' : 'var(--wrong)'
}

function SessionRow({ session }) {
  const answered = (session.total_count - session.skipped_count) || 1
  const acc = Math.round(session.correct_count / answered * 100)
  const label = session.subject || (session.mode === 'exam' ? '시험모드' : '전체랜덤')
  const examDate = session.exam_year
    ? `${session.exam_year}년 ${session.exam_month ? session.exam_month + '월' : ''}${session.exam_day ? ' ' + session.exam_day + '일' : ''}`
    : null
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '60px 1fr 80px 60px 70px',
      padding: '10px 16px', borderBottom: '1px solid var(--border)',
      fontSize: 13, alignItems: 'center', gap: 8,
    }}>
      <span style={{ color: 'var(--text2)', fontSize: 12 }}>{formatTime(session.started_at)}</span>
      <span style={{ fontWeight: 500 }}>
        {label}
        {examDate && <span style={{ display: 'block', fontSize: 11, color: 'var(--text2)', fontWeight: 400 }}>{examDate}</span>}
      </span>
      <span style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 12 }}>
        {session.correct_count}/{session.total_count}
        {session.skipped_count > 0 && <span style={{ fontSize: 10, display: 'block' }}>{session.skipped_count}건너뜀</span>}
      </span>
      <span style={{
        textAlign: 'center', fontWeight: 700, fontFamily: 'JetBrains Mono',
        color: accColor(acc),
      }}>{acc}%</span>
      <span style={{ textAlign: 'right', color: 'var(--text2)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
        {formatDuration(session.duration)}
      </span>
    </div>
  )
}

export default function Stats() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    axios.get(`${API}/stats/overview`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>불러오는 중...</div>
  if (!data) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>데이터 없음</div>

  const chartDates = [...data.by_date].reverse().slice(-10)

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>통계</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 32 }}>풀이 현황을 한눈에 확인하세요</p>

      {/* 전체 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16, marginBottom: 40 }}>
        {[
          { label: '전체 문제', value: data.total_questions, color: 'var(--accent)', unit: '문제' },
          { label: '총 풀이 수', value: data.total_solved, color: 'var(--text)', unit: '회' },
          { label: '총 정답 수', value: data.total_correct, color: 'var(--correct)', unit: '개' },
          { label: '전체 정답률', value: data.overall_accuracy, color: data.overall_accuracy >= 70 ? 'var(--correct)' : 'var(--wrong)', unit: '%' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '20px 24px'
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono' }}>
              {s.value}<span style={{ fontSize: 14, marginLeft: 3 }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 날짜별 정답률 추이 */}
      {chartDates.length >= 1 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text2)' }}>날짜별 정답률 추이</h2>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', marginBottom: selectedDate ? 0 : 40,
            borderBottomLeftRadius: selectedDate ? 0 : undefined,
            borderBottomRightRadius: selectedDate ? 0 : undefined,
            borderBottom: selectedDate ? 'none' : undefined,
          }}>
            <div style={{ padding: '24px 20px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                {chartDates.map((d) => {
                  const acc = d.accuracy
                  const color = accColor(acc)
                  const isSelected = selectedDate === d.date
                  return (
                    <div
                      key={d.date}
                      onClick={() => setSelectedDate(prev => prev === d.date ? null : d.date)}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 10, color, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{acc}%</span>
                      <div style={{
                        width: '100%', height: `${(acc / 100) * 72}px`,
                        background: color, borderRadius: '3px 3px 0 0',
                        minHeight: 4, transition: 'height 0.4s ease, opacity 0.2s',
                        opacity: isSelected ? 1 : 0.55,
                        outline: isSelected ? `2px solid ${color}` : 'none',
                        outlineOffset: 2,
                      }} />
                      <span style={{ fontSize: 9, color: isSelected ? 'var(--text)' : 'var(--text2)', fontWeight: isSelected ? 700 : 400 }}>
                        {formatDate(d.date)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 10, opacity: 0.7 }}>
                날짜를 클릭하면 세부 기록을 볼 수 있어요
              </div>
            </div>

            {/* 선택된 날짜 세부 내역 */}
            {selectedDate && (() => {
              const dayData = data.by_date.find(d => d.date === selectedDate)
              if (!dayData) return null
              return (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  borderBottomLeftRadius: 'var(--radius)',
                  borderBottomRightRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '10px 16px', background: 'var(--bg3)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {selectedDate} · {dayData.session_count}세션
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono',
                      color: accColor(dayData.accuracy),
                    }}>
                      {dayData.accuracy}%
                    </span>
                  </div>
                  {/* 세션 헤더 */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr 80px 60px 70px',
                    padding: '8px 16px', background: 'var(--bg3)',
                    borderTop: '1px solid var(--border)',
                    fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', gap: 8,
                  }}>
                    <span>시각</span><span>과목/모드</span>
                    <span style={{ textAlign: 'center' }}>결과</span>
                    <span style={{ textAlign: 'center' }}>정답률</span>
                    <span style={{ textAlign: 'right' }}>소요시간</span>
                  </div>
                  {dayData.sessions.map(s => <SessionRow key={s.id} session={s} />)}
                </div>
              )
            })()}
          </div>
          {selectedDate && <div style={{ marginBottom: 40 }} />}
        </>
      )}

      {/* 과목별 통계 */}
      {data.by_subject.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text2)' }}>과목별 통계</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
            {data.by_subject.map(s => (
              <div key={s.subject} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 600 }}>{s.subject}</span>
                  <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text2)' }}>
                    <span>{s.solved}회 풀이</span>
                    <span>평균 {s.avg_time}초</span>
                    <span style={{
                      fontWeight: 700,
                      color: accColor(s.accuracy),
                      fontFamily: 'JetBrains Mono',
                    }}>
                      {s.accuracy}%
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${s.accuracy}%`,
                    background: accColor(s.accuracy),
                    borderRadius: 3, transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 최근 풀이 기록 */}
      {data.recent_sessions.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text2)' }}>최근 풀이 기록</h2>
          <div style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            overflowX: 'auto', background: 'var(--bg2)', marginBottom: 40,
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
              minWidth: 480, padding: '10px 20px', background: 'var(--bg3)',
              borderBottom: '1px solid var(--border)',
              fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase',
            }}>
              <span>일시</span>
              <span>과목/모드</span>
              <span style={{ textAlign: 'center' }}>결과</span>
              <span style={{ textAlign: 'center' }}>정답률</span>
              <span style={{ textAlign: 'right' }}>소요시간</span>
            </div>
            {data.recent_sessions.map(session => {
              const answered = (session.total_count - session.skipped_count) || 1
              const accuracy = Math.round(session.correct_count / answered * 100)
              const modeLabel = session.subject || (session.mode === 'exam' ? '시험모드' : '전체랜덤')
              const examDate = session.exam_year
                ? `${session.exam_year}년 ${session.exam_month ? session.exam_month + '월' : ''}${session.exam_day ? ' ' + session.exam_day + '일' : ''}`
                : null
              return (
                <div key={session.id} style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
                  minWidth: 480, padding: '13px 20px', borderBottom: '1px solid var(--border)',
                  fontSize: 13, alignItems: 'center',
                }}>
                  <span style={{ color: 'var(--text2)', fontSize: 12 }}>
                    {(() => {
                      const d = new Date(session.started_at)
                      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                    })()}
                  </span>
                  <span style={{ fontWeight: 500 }}>
                    {modeLabel}
                    {examDate && <span style={{ display: 'block', fontSize: 11, color: 'var(--text2)', fontWeight: 400 }}>{examDate}</span>}
                  </span>
                  <span style={{ textAlign: 'center', color: 'var(--text2)' }}>
                    {session.correct_count}/{session.total_count}
                    {session.skipped_count > 0 && <span style={{ fontSize: 11, marginLeft: 4 }}>({session.skipped_count}건너뜀)</span>}
                  </span>
                  <span style={{
                    textAlign: 'center', fontWeight: 700, fontFamily: 'JetBrains Mono',
                    color: accColor(accuracy),
                  }}>
                    {accuracy}%
                  </span>
                  <span style={{ textAlign: 'right', color: 'var(--text2)', fontFamily: 'JetBrains Mono', fontSize: 12 }}>
                    {formatDuration(session.duration)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {data.recent_sessions.length === 0 && data.total_solved === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div>아직 풀이 기록이 없어요. 문제를 풀어보세요!</div>
        </div>
      )}
    </div>
  )
}
