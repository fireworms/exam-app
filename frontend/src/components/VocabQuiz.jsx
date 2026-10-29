import { useState, useEffect, useRef, useCallback } from 'react'
import { speak, useSpeaking } from '../tts'
import { makeQuestion, quizTotal } from '../utils/vocabQuiz'
import { accColor } from '../utils/format'

// 단어 뜻 4지선다 — 중단할 때까지 무한 출제
export default function VocabQuiz({ pool, allItems, onRecord, onClose }) {
  const speaking = useSpeaking()
  const poolRef = useRef(pool)
  const allRef = useRef(allItems)
  poolRef.current = pool
  allRef.current = allItems

  const [q, setQ] = useState(() => makeQuestion(pool, allItems))
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const timerRef = useRef(null)

  const next = useCallback(() => {
    clearTimeout(timerRef.current)
    setQ(prev => makeQuestion(poolRef.current, allRef.current, prev.target.id))
    setPicked(null)
  }, [])

  const choose = useCallback((choice) => {
    if (picked !== null) return
    const correct = choice === q.target.meaning
    setPicked(choice)
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
    onRecord(q.target.id, correct)
    if (correct) timerRef.current = setTimeout(next, 700)
  }, [picked, q, onRecord, next])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose()
      if (picked === null) {
        const n = Number(e.key)
        if (n >= 1 && n <= q.choices.length) choose(q.choices[n - 1])
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, q, choose, next, onClose])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const { target, choices } = q
  const live = pool.find(i => i.id === target.id) || target
  const acc = score.total ? Math.round(score.correct / score.total * 100) : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text2)' }}>
          <span>
            {score.total}문제 · 정답 {score.correct}
            {acc !== null && <> · <span style={{ color: accColor(acc), fontWeight: 600 }}>{acc}%</span></>}
          </span>
          <button onClick={onClose} style={{
            marginLeft: 'auto', fontSize: 13, padding: '4px 12px', borderRadius: 6,
            background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer',
          }}>그만하기</button>
        </div>

        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono', wordBreak: 'break-word' }}>{target.word}</span>
            <button onClick={() => speak(target.word)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)',
            }}>{speaking === target.word ? '🟥' : '🔊'}</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
            {target.pos && <span style={{ color: 'var(--accent)' }}>{target.pos}</span>}
            {quizTotal(live) > 0 && <span> · 누적 {live.quiz_correct}/{quizTotal(live)}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {choices.map((c, idx) => {
            const isAnswer = c === target.meaning
            const reveal = picked !== null
            const color = reveal && isAnswer ? 'var(--correct)' : reveal && c === picked ? 'var(--wrong)' : null
            return (
              <button key={c} onClick={() => choose(c)} disabled={reveal} style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 8, fontSize: 14,
                background: color ? `color-mix(in srgb, ${color} 15%, transparent)` : 'var(--bg3)',
                border: `1px solid ${color || 'var(--border)'}`,
                color: 'var(--text)', cursor: reveal ? 'default' : 'pointer', lineHeight: 1.4,
              }}>
                <span style={{ color: 'var(--text2)', marginRight: 8, fontFamily: 'JetBrains Mono' }}>{idx + 1}</span>{c}
              </button>
            )
          })}
        </div>

        {picked !== null && picked !== target.meaning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {target.example && (
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ fontStyle: 'italic' }}>{target.example}</div>
                {target.example_translation && <div style={{ color: 'var(--text2)' }}>{target.example_translation}</div>}
              </div>
            )}
            <button onClick={next} style={{
              padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
            }}>다음 →</button>
          </div>
        )}
      </div>
    </div>
  )
}
