import { useState, useEffect } from 'react'
import axios from '../axios'
import API from '../api'

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
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [posFilter, setPosFilter] = useState('')
  const [highFreqOnly, setHighFreqOnly] = useState(false)
  const [sort, setSort] = useState('created_desc')
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = { sort }
      if (posFilter) params.pos = posFilter
      if (highFreqOnly) params.high_freq = true
      const res = await axios.get(`${API}/vocab`, { params })
      setItems(res.data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [posFilter, highFreqOnly, sort])

  const handleDelete = async (id) => {
    if (!confirm('단어를 삭제할까요?')) return
    await axios.delete(`${API}/vocab/${id}`)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const selStyle = {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '5px 10px', fontSize: 13,
    color: 'var(--text)', outline: 'none', cursor: 'pointer',
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>단어장</h1>
      <p style={{ color: 'var(--text2)', marginBottom: 24 }}>
        문제 풀기 중 등록한 단어 · 숙어 {items.length > 0 && <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono' }}>{items.length}개</span>}
      </p>

      {/* 필터 / 정렬 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24, alignItems: 'center' }}>
        <select value={posFilter} onChange={e => setPosFilter(e.target.value)} style={selStyle}>
          {POS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          onClick={() => setHighFreqOnly(p => !p)}
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
            <button key={o.val} onClick={() => setSort(o.val)} style={{
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
                transition: 'border-color 0.15s',
              }}>
                {/* 헤더 */}
                <div
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  style={{
                    padding: '14px 18px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{item.word}</span>
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

                {/* 상세 */}
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
