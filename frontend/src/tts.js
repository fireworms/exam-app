import { useState, useEffect } from 'react'

let current = null

// 검증된 여성 음성 이름만 매칭 — 실패 시 utt.voice 미지정으로 기기 기본 음성 사용
const PREFERRED_VOICES = {
  'ko-KR': ['Yuna', '유나', 'Google 한국의', 'SunHi', 'Heami'],
  'en-US': ['Samantha', 'Google US English', 'Aria', 'Jenny', 'Zira'],
}

let voices = []
function loadVoices() {
  voices = window.speechSynthesis.getVoices() || []
}
if (window.speechSynthesis) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

function pickVoice(lang) {
  const candidates = voices.filter(v => v.lang?.replace('_', '-').startsWith(lang.slice(0, 2)))
  for (const name of PREFERRED_VOICES[lang] || []) {
    const v = candidates.find(v => v.name.includes(name))
    if (v) return v
  }
  return null
}

function dispatch(text) {
  current = text
  window.dispatchEvent(new CustomEvent('tts_change', { detail: text }))
}

function clean(text) {
  return text
    .replace(/__(.+?)__/gs, '$1')
    .replace(/_{3,}/g, '_')
    .replace(/[①-⑳㊀-㊿]/g, '')
    .trim()
}

function splitByLang(text) {
  const isKo = c => /[가-힣ᄀ-ᇿ㄰-㆏]/.test(c)
  const segments = []
  let cur = ''
  let curKo = null

  for (const ch of text) {
    if (/\s/.test(ch)) { cur += ch; continue }
    const ko = isKo(ch)
    if (curKo === null) curKo = ko
    if (ko !== curKo) {
      const t = cur.trim()
      if (t) segments.push({ text: t, lang: curKo ? 'ko-KR' : 'en-US' })
      cur = ch
      curKo = ko
    } else {
      cur += ch
    }
  }
  const t = cur.trim()
  if (t) segments.push({ text: t, lang: curKo ? 'ko-KR' : 'en-US' })
  return segments
}

export function speak(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  if (current === text) { dispatch(null); return }

  const segments = splitByLang(clean(text))
  if (!segments.length) return

  dispatch(text)
  segments.forEach((seg, i) => {
    const utt = new SpeechSynthesisUtterance(seg.text)
    utt.lang = seg.lang
    utt.rate = 0.9
    const voice = pickVoice(seg.lang)
    if (voice) utt.voice = voice
    if (i === segments.length - 1) utt.onend = () => dispatch(null)
    window.speechSynthesis.speak(utt)
  })
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
