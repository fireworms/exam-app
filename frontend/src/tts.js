import { useState, useEffect } from 'react'

let current = null

function dispatch(text) {
  current = text
  window.dispatchEvent(new CustomEvent('tts_change', { detail: text }))
}

function clean(text) {
  return text.replace(/__(.+?)__/gs, '$1').trim()
}

function detectLang(text) {
  return /[가-힣ᄀ-ᇿ㄰-㆏]/.test(text) ? 'ko-KR' : 'en-US'
}

export function speak(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  if (current === text) { dispatch(null); return }
  const cleaned = clean(text)
  const utt = new SpeechSynthesisUtterance(cleaned)
  utt.lang = detectLang(cleaned)
  utt.rate = 0.9
  utt.onend = () => dispatch(null)
  dispatch(text)
  window.speechSynthesis.speak(utt)
}

export function useSpeaking() {
  const [cur, setCur] = useState(current)
  useEffect(() => {
    const h = (e) => setCur(e.detail)
    window.addEventListener('tts_change', h)
    return () => window.removeEventListener('tts_change', h)
  }, [])
  return cur
}
