import { useState, useEffect } from 'react'
import axios from 'axios'

import API from '../api'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    axios.get(`${API}/settings`).then(r => setSettings(r.data))
  }, [])

  const save = async () => {
    await axios.put(`${API}/settings`, { auto_remove_wrong: settings.auto_remove_wrong === 1 })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!settings) return <div style={{ color: 'var(--text2)', padding: 40 }}>불러오는 중...</div>

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>설정</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 32 }}>앱 동작 방식을 설정해요</p>

      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '24px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>오답 자동 제거</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              오답노트 문제를 맞추면 자동으로 오답노트에서 제거해요
            </div>
          </div>
          <button
            onClick={() => setSettings(prev => ({ ...prev, auto_remove_wrong: prev.auto_remove_wrong ? 0 : 1 }))}
            style={{
              width: 48, height: 26, borderRadius: 13,
              background: settings.auto_remove_wrong ? 'var(--accent)' : 'var(--bg3)',
              border: '1px solid var(--border)',
              position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: 'white',
              position: 'absolute', top: 3,
              left: settings.auto_remove_wrong ? 26 : 4,
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      <button onClick={save} style={{
        background: saved ? 'var(--correct)' : 'var(--accent)',
        color: 'white', padding: '12px 28px', borderRadius: 8,
        fontWeight: 600, fontSize: 14, transition: 'background 0.2s',
      }}>
        {saved ? '✓ 저장됨' : '저장'}
      </button>
    </div>
  )
}
