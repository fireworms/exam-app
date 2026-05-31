import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from '../axios'
import API from '../api'
import { speak, useSpeaking } from '../tts'

const POS_LABELS = {
  'n.': '명사',
  'v.': '동사',
  'adj.': '형용사',
  'adv.': '부사',
  'prep.': '전치사',
  'conj.': '접속사',
  'phrase': '구',
}

const POS_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.entries(POS_LABELS).map(([v, l]) => ({ value: v, label: `${v} ${l}` })),
]

export default function Vocab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const posFilter = searchParams.get('pos') || ''
  const highFreqOnly = searchParams.get('hf') === '1'
  const sort = searchParams.get('sort') || 'created_desc'

  const speaking = useSpeaking()
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasNew, setHasNew] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const fetchedAtRef = useRef(null)

  const updateParams = (updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v); else next.delete(k)
      })
      return next
    }, { replace: true })
  }

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${API}/vocab`)
        setAllItems(res.data)
        fetchedAtRef.current = new Date().toISOString()
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    })()
  }, [])

  // 다른 탭에서 단어 저장 시 신호 감지
  useEffect(() => {
    const channel = new BroadcastChannel('vocab_update')
    channel.onmessage = () => setHasNew(true)
    return () => channel.close()
  }, [])

  const handleRefresh = async () => {
    if (!fetchedAtRef.current) return
    try {
      const res = await axios.get(`${API}/vocab`, { params: { after: fetchedAtRef.current } })
      if (res.data.length > 0) {
        setAllItems(prev => [...res.data, ...prev])
      }
      fetchedAtRef.current = new Date().toISOString()
    } catch (e) {
      console.error(e)
    }
    setHasNew(false)
  }

  const items = useMemo(() => {
    let result = allItems
    if (posFilter) result = result.filter(i => i.pos === posFilter)
    if (highFreqOnly) result = result.filter(i => i.is_high_freq)
    if (sort === 'alpha') return [...result].sort((a, b) => a.word.localeCompare(b.word))
    return [...result].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [allItems, posFilter, highFreqOnly, sort])

  const handleDelete = async (id) => {
    if (!confirm('단어를 삭제할까요?')) return
    await axios.delete(`${API}/vocab/${id}`)
    setAllItems(prev => prev.filter(i => i.id !== id))
  }

  const selStyle = {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '5px 10px', fontSize: 13,
    color: 'var(--text)', outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>단어장</h1>
        <button
          onClick={handleRefresh}
          title="새로 등록된 단어 가져오기"
          style={{
            position: 'relative',
            background: hasNew ? 'rgba(99,102,241,0.1)' : 'var(--bg3)',
            border: `1px solid ${hasNew ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
            color: hasNew ? 'var(--accent)' : 'var(--text2)', fontSize: 15,
            transition: 'all 0.2s',
          }}
        >
          ↻
          {hasNew && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--wrong)',
            }} />
          )}
        </button>
      </div>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
        문제 풀기 중 등록한 단어 · 숙어{' '}
        {allItems.length > 0 && <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono' }}>{items.length}개</span>}
      </p>

      {/* 필터 / 정렬 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24, alignItems: 'center' }}>
        <select value={posFilter} onChange={e => updateParams({ pos: e.target.value })} style={selStyle}>
          {POS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          onClick={() => updateParams({ hf: highFreqOnly ? '' : '1' })}
          style={{
            ...selStyle,
            background: highFreqOnly ? 'rgba(234,179,8,0.15)' : 'var(--bg3)',
            border: `1px solid ${highFreqOnly ? '#ca8a04' : 'var(--border)'}`,
            color: highFreqOnly ? '#ca8a04' : 'var(--text2)',
          }}
        >
          ★ 고빈도만
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[
            { val: 'created_desc', label: '최신순' },
            { val: 'alpha', label: '알파벳순' },
          ].map(o => (
            <button key={o.val} onClick={() => updateParams({ sort: o.val === 'created_desc' ? '' : o.val })} style={{
              ...selStyle,
              background: sort === o.val ? 'var(--accent)' : 'var(--bg3)',
              color: sort === o.val ? 'white' : 'var(--text2)',
              border: `1px solid ${sort === o.val ? 'var(--accent)' : 'var(--border)'}`,
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ color: 'var(--text2)', textAlign: 'center', padding: '60px 0' }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📖</div>
          <div>등록된 단어가 없어요</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>문제 풀기 중 텍스트를 드래그해서 단어를 등록해보세요</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => {
            const isOpen = expanded === item.id
            return (
              <div key={item.id} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', overflow: 'hidden',
              }}>
                <div
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{item.word}</span>
                    <button onClick={e => { e.stopPropagation(); speak(item.word) }} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, padding: '0 2px', color: 'var(--text2)', lineHeight: 1,
                    }}>{speaking === item.word ? '🟥' : '🔊'}</button>
                    {item.pos && (
                      <span style={{ fontSize: 12, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '2px 7px', borderRadius: 4 }}>
                        {item.pos}
                      </span>
                    )}
                    {item.is_high_freq && (
                      <span style={{ fontSize: 11, color: '#ca8a04', background: 'rgba(234,179,8,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                        ★ 고빈도
                      </span>
                    )}
                    <span style={{ fontSize: 14, color: 'var(--text2)' }}>{item.meaning}</span>
                  </div>
                  <span style={{ color: 'var(--text2)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {item.example && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>예문</div>
                        <div style={{ fontSize: 14, fontStyle: 'italic', lineHeight: 1.6 }}>{item.example}</div>
                        {item.example_translation && (
                          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{item.example_translation}</div>
                        )}
                      </div>
                    )}

                    {item.synonyms && item.synonyms.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>동의어</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {item.synonyms.map((s, i) => (
                            <span key={i} style={{
                              fontSize: 13, fontFamily: 'JetBrains Mono',
                              background: 'var(--bg3)', border: '1px solid var(--border)',
                              padding: '3px 10px', borderRadius: 6,
                            }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.source_text && item.source_text !== item.word && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        원문: <span style={{ fontStyle: 'italic' }}>{item.source_text}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {new Date(item.created_at).toLocaleDateString('ko-KR')}
                      </span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          fontSize: 12, padding: '4px 12px', borderRadius: 6,
                          background: 'transparent', border: '1px solid var(--border)',
                          color: 'var(--wrong)', cursor: 'pointer',
                        }}
                      >삭제</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
