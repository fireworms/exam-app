import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import API from '../api'

export default function Quiz() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const mode = searchParams.get('mode') || 'all'
  const examId = searchParams.get('exam_id')
  const subject = searchParams.get('subject')
  const examIds = searchParams.get('exam_ids')
  const examSubjectsParam = searchParams.get('subjects')
  const examQuestionModeParam = searchParams.get('question_mode') || 'random'
  const startIndex = parseInt(searchParams.get('q') || '0')
  const timeLimitParam = parseInt(searchParams.get('time_limit') || '0') // 분 단위, 0=무제한
  const isExamMode = timeLimitParam > 0

  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(startIndex)
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [answers, setAnswers] = useState({}) // examMode: question_id → selected_choice
  const [showExplanation, setShowExplanation] = useState(false)
  const [scraps, setScraps] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [examResults, setExamResults] = useState([]) // examMode 채점 결과
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [imageUrls, setImageUrls] = useState({})
  const [sessionId, setSessionId] = useState(null)
  const [sessionStart, setSessionStart] = useState(null)
  const [skippedCount, setSkippedCount] = useState(0)
  const [skippedIds, setSkippedIds] = useState([]) // 건너뛴 문제 ID 목록
  const [elapsed, setElapsed] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  // 시험 모드: 남은 시간(초)
  const [timeLeft, setTimeLeft] = useState(timeLimitParam * 60)
  const timerRef = React.useRef(null)
  const totalAnswerTimeRef = React.useRef(0)
  const correctCountRef = React.useRef(0) // stale closure 방지

  useEffect(() => {
    loadQuestions()
  }, [])

  // 문제별 타이머 (일반 모드)
  useEffect(() => {
    if (isExamMode) return
    if (timerActive) {
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerActive, isExamMode])

  // 시험 모드 카운트다운
  useEffect(() => {
    if (!isExamMode || !timerActive) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          submitExam()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [timerActive, isExamMode])

  // 키보드 단축키
  useEffect(() => {
    const handler = (e) => {
      // 텍스트 입력 중이면 무시
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (done || loading) return

      const q = questions[current]
      if (!q) return

      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const num = parseInt(e.key)
        const choice = q.choices.find(c => c.number === num)
        if (choice) {
          if (isExamMode) {
            handleExamSelect(num)
          } else if (!result) {
            handleSelect(num)
          }
        }
      }

      if ((e.key === 'Enter' || e.key === ' ') && !isExamMode) {
        e.preventDefault()
        if (result) {
          handleNext()
        } else if (!result) {
          handleNext(true) // 건너뛰기
        }
      }

      if (e.key === 'ArrowRight' && isExamMode) {
        handleExamNext()
      }
      if (e.key === 'ArrowLeft' && isExamMode) {
        handleExamPrev()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [questions, current, result, done, loading, isExamMode, answers])

  // 편집 후 돌아왔을 때 복원
  useEffect(() => {
    if (startIndex > 0 && questions.length > 0) {
      setCurrent(Math.min(startIndex, questions.length - 1))
    }
  }, [questions.length])

  const loadQuestions = async () => {
    setLoading(true)
    try {
      const savedKey = sessionStorage.getItem('quiz_key')
      const currentKey = `${mode}_${examId}_${subject}_${examIds}_${examSubjectsParam}_${examQuestionModeParam}`
      const savedQuestions = sessionStorage.getItem('quiz_questions')
      if (startIndex > 0 && savedKey === currentKey && savedQuestions) {
        const parsed = JSON.parse(savedQuestions)
        setQuestions(parsed)
        const scrapRes = await axios.get(`${API}/scraps`)
        setScraps(new Set(scrapRes.data.map(s => s.id)))
        const imageMap = {}
        await Promise.all(parsed.map(async (q) => {
          try {
            await axios.get(`${API}/questions/${q.id}/image`, { responseType: 'blob' })
            imageMap[q.id] = `${API}/questions/${q.id}/image`
          } catch { imageMap[q.id] = null }
        }))
        setImageUrls(imageMap)
        setLoading(false)
        return
      }

      // 건너뛴 문제 이어풀기
      const skippedMode = searchParams.get('skipped_ids')
      let res
      if (skippedMode) {
        res = await axios.get(`${API}/questions/by_ids`, { params: { ids: skippedMode } })
      } else if (examSubjectsParam) {
        res = await axios.get(`${API}/questions/exam-mode`, {
          params: { subjects: examSubjectsParam, question_mode: examQuestionModeParam }
        })
      } else if (examId) {
        res = await axios.get(`${API}/questions`, { params: { exam_id: examId } })
      } else {
        res = await axios.get(`${API}/questions/random`, {
          params: { count: 20, source: mode, subject: subject || undefined, exam_ids: examIds || undefined }
        })
      }
      setQuestions(res.data)
      sessionStorage.setItem('quiz_questions', JSON.stringify(res.data))
      sessionStorage.setItem('quiz_key', currentKey)

      const scrapRes = await axios.get(`${API}/scraps`)
      setScraps(new Set(scrapRes.data.map(s => s.id)))

      const imageMap = {}
      await Promise.all(res.data.map(async (q) => {
        try {
          await axios.get(`${API}/questions/${q.id}/image`, { responseType: 'blob' })
          imageMap[q.id] = `${API}/questions/${q.id}/image`
        } catch { imageMap[q.id] = null }
      }))
      setImageUrls(imageMap)
      await startSession(res.data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const startSession = async (qs) => {
    const now = Date.now()
    setSessionStart(now)
    setElapsed(0)
    setTimerActive(true)
    totalAnswerTimeRef.current = 0
    correctCountRef.current = 0
    try {
      const res = await axios.post(`${API}/sessions`, {
        mode, subject: subject || null,
        exam_id: examId ? parseInt(examId) : null,
        total_count: qs.length,
      })
      setSessionId(res.data.session_id)
    } catch (e) { console.error(e) }
  }

  // ── 일반 모드 ──────────────────────────────────────

  const handleSelect = async (choiceNum) => {
    if (result) return
    setSelected(choiceNum)
    setTimerActive(false)
    try {
      const timeTaken = elapsed
      totalAnswerTimeRef.current += timeTaken
      const res = await axios.post(`${API}/solve`, {
        question_id: questions[current].id,
        selected_choice: choiceNum,
        time_taken: timeTaken,
        session_id: sessionId,
      })
      setResult(res.data)
      if (res.data.is_correct) {
        correctCountRef.current += 1
        setScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }))
      } else {
        setScore(prev => ({ ...prev, total: prev.total + 1 }))
      }
    } catch (e) { console.error(e) }
  }

  const handleNext = (skipped = false) => {
    if (skipped) {
      setSkippedCount(prev => prev + 1)
      setSkippedIds(prev => [...prev, questions[current].id])
    }
    setElapsed(0)
    setTimerActive(true)
    if (current + 1 >= questions.length) {
      setTimerActive(false)
      setDone(true)
      endSession()
    } else {
      setCurrent(prev => prev + 1)
      setSelected(null)
      setResult(null)
      setShowExplanation(false)
    }
  }

  // ── 시험 모드 ──────────────────────────────────────

  const handleExamSelect = (choiceNum) => {
    setAnswers(prev => ({ ...prev, [questions[current].id]: choiceNum }))
    setSelected(choiceNum)
  }

  const handleExamNext = () => {
    if (current + 1 < questions.length) {
      setCurrent(prev => prev + 1)
      setSelected(answers[questions[current + 1]?.id] ?? null)
    }
  }

  const handleExamPrev = () => {
    if (current > 0) {
      setCurrent(prev => prev - 1)
      setSelected(answers[questions[current - 1]?.id] ?? null)
    }
  }

  const submitExam = async () => {
    setTimerActive(false)
    const currentAnswers = answers
    let correct = 0
    const results = []
    for (const q of questions) {
      const selectedChoice = currentAnswers[q.id]
      if (selectedChoice == null) continue
      try {
        const res = await axios.post(`${API}/solve`, {
          question_id: q.id,
          selected_choice: selectedChoice,
          time_taken: 0,
          session_id: sessionId,
        })
        if (res.data.is_correct) correct++
        results.push({ question: q, selectedChoice, is_correct: res.data.is_correct })
      } catch (e) { console.error(e) }
    }
    correctCountRef.current = correct
    setExamResults(results)
    setScore({ correct, total: questions.length })
    setDone(true)
    const answered = Object.keys(currentAnswers).length
    const skipped = questions.length - answered
    try {
      if (sessionId && sessionStart) {
        await axios.put(`${API}/sessions/${sessionId}/end`, {
          correct_count: correct,
          skipped_count: skipped,
          duration: timeLimitParam * 60 - timeLeft,
        })
      }
    } catch (e) { console.error(e) }
  }

  // ── 공통 ──────────────────────────────────────────

  const endSession = async () => {
    if (!sessionId || !sessionStart) return
    try {
      await axios.put(`${API}/sessions/${sessionId}/end`, {
        correct_count: correctCountRef.current,
        skipped_count: skippedCount,
        duration: totalAnswerTimeRef.current,
      })
    } catch (e) { console.error(e) }
  }

  const toggleScrap = async () => {
    const qid = questions[current].id
    if (scraps.has(qid)) {
      await axios.delete(`${API}/scraps/${qid}`)
      setScraps(prev => { const s = new Set(prev); s.delete(qid); return s })
    } else {
      await axios.post(`${API}/scraps/${qid}`, { memo: '' })
      setScraps(prev => new Set([...prev, qid]))
    }
  }

  // ── 렌더 ──────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text2)' }}>
      문제 불러오는 중...
    </div>
  )

  if (questions.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
      <div style={{ fontSize: 18, marginBottom: 8 }}>문제가 없어요</div>
      <button onClick={() => navigate('/')} style={{
        marginTop: 16, background: 'var(--accent)', color: 'white',
        padding: '10px 24px', borderRadius: 8, fontSize: 14,
      }}>홈으로</button>
    </div>
  )

  // 완료 화면
  if (done) {
    const accuracy = score.total > 0 ? Math.round(score.correct / score.total * 100) : 0
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{accuracy >= 70 ? '🎉' : accuracy >= 50 ? '🙂' : '😅'}</div>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>완료!</h2>
        <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--accent)', fontFamily: 'JetBrains Mono', margin: '16px 0' }}>
          {score.correct} / {score.total}
        </div>
        <p style={{ color: 'var(--text2)', marginBottom: 32 }}>
          정답률 {accuracy}%
          {skippedCount > 0 && !isExamMode && <span style={{ marginLeft: 12, fontSize: 14 }}>({skippedCount}문제 건너뜀)</span>}
        </p>

        {/* 시험 모드: 채점 결과 */}
        {isExamMode && examResults.length > 0 && (
          <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>채점 결과</h3>
            {examResults.map(({ question: q, selectedChoice, is_correct }) => (
              <div key={q.id} style={{
                background: 'var(--bg2)', border: `1px solid ${is_correct ? 'var(--correct)' : 'var(--wrong)'}`,
                borderRadius: 8, padding: '12px 16px',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                  {q.subject} · Q{q.number} · {is_correct ? '✓ 정답' : '✗ 오답'}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {q.question_text.length > 80 ? q.question_text.slice(0, 80) + '...' : q.question_text}
                </div>
                {!is_correct && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text2)' }}>
                    선택: {selectedChoice}번 / 정답: {q.choices.find(c => c.is_correct)?.number}번
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => {
            setCurrent(0); setSelected(null); setResult(null)
            setShowExplanation(false); setDone(false)
            setScore({ correct: 0, total: 0 })
            setSkippedIds([]); setSkippedCount(0)
            setAnswers({}); setExamResults([])
            setTimeLeft(timeLimitParam * 60)
            loadQuestions()
          }} style={{ background: 'var(--accent)', color: 'white', padding: '12px 24px', borderRadius: 8 }}>
            다시 풀기
          </button>
          {/* 건너뛴 문제 이어풀기 */}
          {skippedIds.length > 0 && !isExamMode && (
            <button onClick={() => navigate(`/quiz?mode=all&skipped_ids=${skippedIds.join(',')}`)}
              style={{ background: 'var(--bg3)', color: 'var(--text)', padding: '12px 24px', borderRadius: 8, border: '1px solid var(--border)' }}>
              건너뛴 {skippedIds.length}문제 풀기 →
            </button>
          )}
          <button onClick={() => navigate('/')}
            style={{ background: 'var(--bg3)', color: 'var(--text)', padding: '12px 24px', borderRadius: 8, border: '1px solid var(--border)' }}>
            홈으로
          </button>
        </div>
      </div>
    )
  }

  const q = questions[current]
  const isScraped = scraps.has(q.id)
  const imageUrl = imageUrls[q.id]
  const returnUrl = encodeURIComponent(
    `/quiz?mode=${mode}${examId ? `&exam_id=${examId}` : ''}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}${examIds ? `&exam_ids=${encodeURIComponent(examIds)}` : ''}&q=${current}`
  )

  // 시험 모드 카운트다운 표시
  const formatTimeLeft = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const answeredCount = Object.keys(answers).length

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent)', fontWeight: 600 }}>
            {current + 1}
          </span>
          <span style={{ color: 'var(--text2)' }}>/ {questions.length}</span>
          <div style={{ height: 4, width: 120, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(isExamMode ? answeredCount : (current + 1)) / questions.length * 100}%`,
              background: 'var(--accent)', transition: 'width 0.3s'
            }} />
          </div>
          {isExamMode && (
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              {answeredCount}/{questions.length} 답변
            </span>
          )}
        </div>

        {/* 타이머 */}
        {isExamMode ? (
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 15, fontWeight: 700,
            color: timeLeft <= 60 ? 'var(--wrong)' : timeLeft <= 300 ? 'var(--scrap)' : 'var(--text2)',
            minWidth: 50, textAlign: 'center',
          }}>
            ⏱ {formatTimeLeft(timeLeft)}
          </span>
        ) : (
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 13,
            color: elapsed >= 60 ? 'var(--wrong)' : 'var(--text2)',
            minWidth: 36, textAlign: 'center',
          }}>
            {Math.floor(elapsed / 60) > 0
              ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
              : `${elapsed}s`}
          </span>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {!isExamMode && (
            <button onClick={() => navigate(`/edit/${q.id}?return=${returnUrl}`)}
              style={{ background: 'var(--bg3)', color: 'var(--text2)', padding: '6px 12px', borderRadius: 6, fontSize: 13, border: '1px solid var(--border)' }}>
              ✏️ 편집
            </button>
          )}
          <button onClick={toggleScrap} style={{
            background: isScraped ? 'var(--scrap)' : 'var(--bg3)',
            color: isScraped ? '#000' : 'var(--text2)',
            padding: '6px 14px', borderRadius: 6, fontSize: 13,
            border: '1px solid var(--border)', transition: 'all 0.15s'
          }}>
            {isScraped ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* 키보드 힌트 */}
      {!isExamMode && (
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, opacity: 0.6 }}>
          1~{q.choices.length} 선택 · Enter 다음/건너뛰기
        </div>
      )}
      {isExamMode && (
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, opacity: 0.6 }}>
          1~{q.choices.length} 선택 · ←→ 이동
        </div>
      )}

      {/* 문제 */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '24px', marginBottom: 20
      }}>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
          {q.subject} · {q.year}년 {q.month}월
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          <strong>Q{q.number}.</strong> {q.question_text}
        </div>
        {imageUrl && (
          <div style={{ marginTop: 16 }}>
            <img src={imageUrl} alt="문제 이미지"
              style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
          </div>
        )}
      </div>

      {/* 선지 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {q.choices.map(choice => {
          let bg = 'var(--bg2)', border = 'var(--border)', color = 'var(--text)'
          if (!isExamMode && result) {
            if (choice.is_correct) { bg = 'rgba(74,222,128,0.1)'; border = 'var(--correct)'; color = 'var(--correct)' }
            else if (choice.number === selected && !choice.is_correct) { bg = 'rgba(248,113,113,0.1)'; border = 'var(--wrong)'; color = 'var(--wrong)' }
          } else if (selected === choice.number || answers[q.id] === choice.number) {
            border = 'var(--accent)'; color = 'var(--accent)'
          }
          return (
            <button key={choice.id}
              onClick={() => isExamMode ? handleExamSelect(choice.number) : handleSelect(choice.number)}
              style={{
                background: bg, border: `1px solid ${border}`, borderRadius: 8,
                padding: '14px 18px', textAlign: 'left', color, fontSize: 14,
                transition: 'all 0.15s', lineHeight: 1.6,
              }}>
              <span style={{ fontFamily: 'JetBrains Mono', marginRight: 10, opacity: 0.6 }}>
                {choice.number}.
              </span>
              {choice.text}
            </button>
          )
        })}
      </div>

      {/* 결과 & 해설 (일반 모드) */}
      {!isExamMode && result && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            padding: '12px 18px', borderRadius: 8, marginBottom: 12,
            background: result.is_correct ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${result.is_correct ? 'var(--correct)' : 'var(--wrong)'}`,
            color: result.is_correct ? 'var(--correct)' : 'var(--wrong)',
            fontWeight: 600,
          }}>
            {result.is_correct ? '✓ 정답!' : '✗ 오답'}
          </div>
          <button onClick={() => setShowExplanation(p => !p)} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 16px', color: 'var(--text2)', fontSize: 13,
            marginBottom: showExplanation ? 12 : 0,
          }}>
            {showExplanation ? '▲ 해설 닫기' : '▼ 해설 보기'}
          </button>
          {showExplanation && (
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '18px', fontSize: 14, lineHeight: 1.8,
              whiteSpace: 'pre-wrap', color: 'var(--text)',
            }}>
              {q.explanation}
            </div>
          )}
        </div>
      )}

      {/* 시험 모드 이동 버튼 */}
      {isExamMode && (
        <div style={{ display: 'flex', gap: 8 }}>
          {current > 0 && (
            <button onClick={handleExamPrev} style={{
              flex: 1, background: 'var(--bg3)', color: 'var(--text)',
              padding: '14px', borderRadius: 8, fontSize: 14, border: '1px solid var(--border)',
            }}>
              ← 이전
            </button>
          )}
          {current + 1 < questions.length ? (
            <button onClick={handleExamNext} style={{
              flex: 1, background: 'var(--accent)', color: 'white',
              padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 600,
            }}>
              다음 →
            </button>
          ) : (
            <button onClick={submitExam} style={{
              flex: 1,
              background: answeredCount === questions.length ? 'var(--correct)' : 'var(--accent)',
              color: 'white', padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 600,
            }}>
              {answeredCount < questions.length
                ? `제출 (${questions.length - answeredCount}문제 미답변)`
                : '제출 →'}
            </button>
          )}
        </div>
      )}

      {/* 일반 모드 버튼 */}
      {!isExamMode && !result && (
        <button onClick={() => handleNext(true)} style={{
          width: '100%', background: 'transparent', color: 'var(--text2)',
          padding: '12px', borderRadius: 8, fontSize: 14,
          border: '1px dashed var(--border)', cursor: 'pointer', marginTop: 8,
        }}>
          건너뛰기 →
        </button>
      )}
      {!isExamMode && result && (
        <button onClick={() => handleNext()} style={{
          width: '100%', background: 'var(--accent)', color: 'white',
          padding: '14px', borderRadius: 8, fontSize: 15, fontWeight: 600,
          transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {current + 1 >= questions.length ? '결과 보기' : '다음 문제 →'}
        </button>
      )}
    </div>
  )
}
