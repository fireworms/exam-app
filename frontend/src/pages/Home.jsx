import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from '../axios'
import API from '../api'
import { examDateLabel } from '../utils/format'

const EXAM_TEMPLATES = ['국어', '영어', '한국사', '컴퓨터일반', '정보보호론']

export default function Home() {
  const [exams, setExams] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [selectedRegions, setSelectedRegions] = useState([])
  const [stats, setStats] = useState({ total: 0, wrong: 0, scrap: 0 })
  const [showExamOptions, setShowExamOptions] = useState(false)
  const [examSubjects, setExamSubjects] = useState([...EXAM_TEMPLATES])
  // 과목별 선택값: 'random'(완전 랜덤) | 'by_exam'(회차 랜덤) | String(exam_id)(회차 지정), examSubjects와 평행
  const [examSelections, setExamSelections] = useState(EXAM_TEMPLATES.map(() => 'random'))
  const [examTimeLimit, setExamTimeLimit] = useState(100)
  const [examTimeLimitEdited, setExamTimeLimitEdited] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    axios.get(`${API}/exams`).then(r => setExams(r.data))
    axios.get(`${API}/subjects`).then(r => setSubjects(r.data))
    axios.get(`${API}/stats/counts`).then(r => setStats({
      total: r.data.total,
      wrong: r.data.wrong,
      scrap: r.data.scrap,
    }))
  }, [])

  useEffect(() => {
    if (!examTimeLimitEdited) setExamTimeLimit(examSubjects.length * 20)
  }, [examSubjects.length, examTimeLimitEdited])

  const examsForSubject = (sub) => exams
    .filter(e => e.subject === sub)
    .sort((a, b) => (b.year - a.year) || (b.month - a.month) || (b.day - a.day))

  // examSubjects/exams 변화 시 과목별 선택값 동기화 (과목에 없는 회차 지정은 완전 랜덤으로 복귀)
  useEffect(() => {
    setExamSelections(prev => examSubjects.map((sub, i) => {
      const cur = prev[i] || 'random'
      if (cur === 'random' || cur === 'by_exam') return cur
      return examsForSubject(sub).some(e => String(e.id) === cur) ? cur : 'random'
    }))
  }, [examSubjects, exams])

  const startQuiz = (mode) => navigate(`/quiz?mode=${mode}`)

  const allYears = [...new Set(exams.map(e => e.year))].sort()
  const allRegions = [...new Set(exams.map(e => e.region).filter(Boolean))]

  const filteredExams = exams.filter(e => {
    if (e.subject !== selectedSubject) return false
    if (yearFrom && e.year < parseInt(yearFrom)) return false
    if (yearTo && e.year > parseInt(yearTo)) return false
    if (selectedRegions.length > 0 && !selectedRegions.includes(e.region)) return false
    return true
  })

  const toggleRegion = (region) => {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    )
  }

  const handleSubjectClick = (subject) => {
    setSelectedSubject(prev => {
      if (prev === subject) return null
      setYearFrom('')
      setYearTo('')
      setSelectedRegions([])
      return subject
    })
  }

  const selStyle = {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '5px 8px', fontSize: 13,
    color: 'var(--text)', outline: 'none',
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>홈</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 32 }}>문제를 선택하거나 랜덤으로 풀어보세요</p>

      {/* 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 40 }}>
        {[
          { label: '전체 문제', value: stats.total, color: 'var(--accent)' },
          { label: '오답노트', value: stats.wrong, color: 'var(--wrong)' },
          { label: '스크랩', value: stats.scrap, color: 'var(--scrap)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '20px 24px'
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono' }}>
              {s.value}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 빠른 시작 */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text2)' }}>빠른 시작</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { mode: 'all', label: '전체 랜덤풀기', desc: '모든 문제 중 랜덤', icon: '🎲' },
          { mode: 'wrong', label: '오답만 풀기', desc: '틀린 문제만 모아서', icon: '🔁' },
          { mode: 'scrap', label: '스크랩만 풀기', desc: '스크랩한 문제만', icon: '⭐' },
        ].map(b => (
          <button key={b.mode} onClick={() => startQuiz(b.mode)} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '20px',
            textAlign: 'left', transition: 'all 0.15s', color: 'var(--text)',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{b.icon}</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{b.label}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{b.desc}</div>
          </button>
        ))}
      </div>

      {/* 단어장 */}
      <Link to="/vocab" style={{ display: 'block', marginBottom: 40, textDecoration: 'none' }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '20px',
          display: 'flex', alignItems: 'center', gap: 14,
          transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <span style={{ fontSize: 24 }}>📖</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>단어장</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>등록한 단어·숙어 복습</div>
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 18 }}>→</span>
        </div>
      </Link>

      {/* 시험 모드 */}
      <div style={{ marginBottom: 40 }}>
        <button onClick={() => setShowExamOptions(p => !p)} style={{
          width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '16px 20px',
          textAlign: 'left', color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = showExamOptions ? 'var(--accent)' : 'var(--border)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>📝</span>
            <div>
              <div style={{ fontWeight: 600 }}>시험 모드</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>제한시간 설정 후 한번에 채점</div>
            </div>
          </div>
          <span style={{ color: 'var(--text2)' }}>{showExamOptions ? '▲' : '▼'}</span>
        </button>
        {showExamOptions && (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: 'none',
            borderRadius: '0 0 var(--radius) var(--radius)', padding: '20px',
          }}>
            {/* 과목 선택 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                과목 선택 ({examSubjects.length}/5)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {examSubjects.map((sub, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <select
                      value={sub}
                      onChange={e => {
                        const next = [...examSubjects]
                        next[idx] = e.target.value
                        setExamSubjects(next)
                      }}
                      style={{ ...selStyle, minWidth: 110 }}
                    >
                      {[...new Set([...EXAM_TEMPLATES, ...subjects.map(s => s.subject)])].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={examSelections[idx] || 'random'}
                      onChange={e => {
                        const next = [...examSelections]
                        next[idx] = e.target.value
                        setExamSelections(next)
                      }}
                      style={{ ...selStyle, flex: 1, minWidth: 140 }}
                    >
                      <optgroup label="랜덤">
                        <option value="random">완전 랜덤 (20문제)</option>
                        <option value="by_exam">회차 랜덤</option>
                      </optgroup>
                      {examsForSubject(sub).length > 0 && (
                        <optgroup label="회차 지정">
                          {examsForSubject(sub).map(e => (
                            <option key={e.id} value={String(e.id)}>{examDateLabel(e, { region: true })}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      onClick={() => setExamSubjects(prev => prev.filter((_, i) => i !== idx))}
                      disabled={examSubjects.length <= 1}
                      style={{
                        width: 26, height: 26, borderRadius: 6, fontSize: 14, lineHeight: 1,
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        color: examSubjects.length <= 1 ? 'var(--border)' : 'var(--text2)',
                        cursor: examSubjects.length <= 1 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >−</button>
                  </div>
                ))}
                {examSubjects.length < 5 && (
                  <button
                    onClick={() => {
                      const available = [...new Set([...EXAM_TEMPLATES, ...subjects.map(s => s.subject)])]
                      setExamSubjects(prev => [...prev, available[0] || '국어'])
                    }}
                    style={{
                      padding: '7px 12px', borderRadius: 6, fontSize: 13, alignSelf: 'flex-start',
                      background: 'var(--bg3)', border: '1px dashed var(--border)',
                      color: 'var(--text2)', cursor: 'pointer',
                    }}
                  >+ 과목 추가</button>
                )}
              </div>
            </div>

            {/* 제한시간 + 시작 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>제한시간</span>
                <input
                  type="number"
                  min={1}
                  value={examTimeLimit}
                  onChange={e => {
                    setExamTimeLimitEdited(true)
                    setExamTimeLimit(Math.max(1, parseInt(e.target.value) || 1))
                  }}
                  style={{ ...selStyle, width: 64, textAlign: 'center' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>분</span>
                {examTimeLimitEdited && (
                  <button
                    onClick={() => {
                      setExamTimeLimitEdited(false)
                      setExamTimeLimit(examSubjects.length * 20)
                    }}
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 5,
                      background: 'var(--bg3)', border: '1px solid var(--border)',
                      color: 'var(--text2)', cursor: 'pointer',
                    }}
                  >자동</button>
                )}
              </div>
              <button
                onClick={() => navigate(
                  `/quiz?mode=exam&time_limit=${examTimeLimit}` +
                  `&subjects=${encodeURIComponent(examSubjects.join(','))}` +
                  `&selections=${encodeURIComponent(examSelections.join(','))}`
                )}
                style={{
                  background: 'var(--accent)', color: 'white',
                  padding: '9px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                }}
              >
                시작 →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 과목별 풀기 */}
      {subjects.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text2)' }}>과목별 풀기</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: selectedSubject ? 20 : 40 }}>
            {subjects.map(s => {
              const isSelected = selectedSubject === s.subject
              return (
                <button key={s.subject} onClick={() => handleSubjectClick(s.subject)} style={{
                  background: isSelected ? 'var(--accent)' : 'var(--bg2)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  padding: '10px 18px',
                  color: isSelected ? 'white' : 'var(--text)',
                  fontWeight: isSelected ? 700 : 400,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  {s.subject}
                  <span style={{
                    fontSize: 12,
                    color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text2)',
                    fontFamily: 'JetBrains Mono',
                  }}>
                    {s.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 선택된 과목의 시험 목록 */}
          {selectedSubject && (
            <div style={{ marginBottom: 40 }}>
                {/* 필터 */}
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>필터</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select value={yearFrom} onChange={e => setYearFrom(e.target.value)} style={selStyle}>
                      <option value="">전체</option>
                      {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span style={{ color: 'var(--text2)', fontSize: 13 }}>~</span>
                    <select value={yearTo} onChange={e => setYearTo(e.target.value)} style={selStyle}>
                      <option value="">전체</option>
                      {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span style={{ color: 'var(--text2)', fontSize: 12 }}>년도</span>
                  </div>
                  {allRegions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {allRegions.map(r => {
                        const on = selectedRegions.includes(r)
                        return (
                          <button key={r} onClick={() => toggleRegion(r)} style={{
                            padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                            background: on ? 'var(--accent)' : 'var(--bg3)',
                            color: on ? 'white' : 'var(--text2)',
                            border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                            transition: 'all 0.15s',
                          }}>{r}</button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 랜덤풀기 버튼 */}
              <button
                onClick={() => {
                  const examIds = filteredExams.map(e => e.id).join(',')
                  navigate(`/quiz?mode=all&subject=${encodeURIComponent(selectedSubject)}&exam_ids=${examIds}`)
                }}
                disabled={filteredExams.length === 0}
                style={{
                  width: '100%',
                  background: filteredExams.length ? 'var(--accent)' : 'var(--bg3)',
                  color: filteredExams.length ? 'white' : 'var(--text2)',
                  border: 'none', borderRadius: 'var(--radius)', padding: '14px 20px',
                  fontWeight: 700, fontSize: 15, cursor: filteredExams.length ? 'pointer' : 'not-allowed',
                  marginBottom: 10, textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>🎲 {selectedSubject} 랜덤풀기</span>
                <span style={{ opacity: 0.8, fontSize: 13 }}>{filteredExams.length}개 시험 →</span>
              </button>

              {/* 시험별 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredExams.map(exam => (
                  <button key={exam.id} onClick={() => navigate(`/quiz?exam_id=${exam.id}&subject=${encodeURIComponent(selectedSubject)}`)}
                    style={{
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '14px 20px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      color: 'var(--text)', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{examDateLabel(exam)}</span>
                      <span style={{ color: 'var(--text2)', marginLeft: 10, fontSize: 13 }}>
                        {[exam.grade, exam.region].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <span style={{ color: 'var(--accent)', fontSize: 18 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
