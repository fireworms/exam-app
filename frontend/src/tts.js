import { useState, useEffect } from 'react'

let current = null

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
