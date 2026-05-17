import { useEffect, useState } from "react"
import { useSubject } from "../SubjectContext"
import API from "../../../api"

const CAT_LABEL = {
  workplace:       "직장·업무",
  decision_making: "의사결정",
  emotions_states: "감정·상태",
  time_schedule:   "시간·일정",
}

export default function EnIdioms() {
  const subject = useSubject()
  const [data, setData] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    setData(null)
    fetch(`${API}/api/learn/idioms?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(d => { setData(d); setActiveCategory(Object.keys(d)[0] || null) })
  }, [subject])

  if (!data) return <div className="lp-empty">로딩 중...</div>

  const categories = Object.keys(data)
  const idioms = data[activeCategory] || []

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">관용구</h1>
        <p className="lp-subtitle">{subject} · 직역/의역 비교 · 클릭하면 예문 확인</p>
      </div>

      {/* 카테고리 탭 */}
      <div>
        <p className="lp-section-label">분야 선택</p>
        <div className="lp-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`lp-tab-btn${activeCategory === cat ? " active" : ""}`}
              onClick={() => { setActiveCategory(cat); setExpanded(null) }}
            >
              {CAT_LABEL[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* 관용구 목록 */}
      <div>
        <p className="lp-section-label">{CAT_LABEL[activeCategory] || activeCategory} — {idioms.length}개</p>
        <div className="lp-list">
          {idioms.map((item, i) => (
            <button
              key={i}
              className="lp-row"
              style={{flexDirection:"column", alignItems:"flex-start"}}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div style={{display:"flex", alignItems:"center", gap:12, width:"100%"}}>
                <div style={{flex:1, textAlign:"left"}}>
                  <p style={{fontSize:14, fontWeight:700, color:"var(--accent)", marginBottom:2, fontStyle:"italic"}}>{item.phrase}</p>
                  <p style={{fontSize:13, color:"var(--text)"}}>{item.meaning}</p>
                </div>
                {item.appeared_in && (
                  <span className="lp-badge lp-badge-accent" style={{flexShrink:0}}>기출</span>
                )}
                <span className="lp-muted" style={{fontSize:11, flexShrink:0}}>{expanded === i ? "▲" : "▼"}</span>
              </div>

              {expanded === i && (
                <div style={{width:"100%", marginTop:12, paddingTop:12, borderTop:"1px solid var(--border)"}}>
                  <div className="lp-grid-2" style={{gap:8}}>
                    <div style={{background:"var(--bg3)", borderRadius:8, padding:"10px 12px"}}>
                      <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", marginBottom:4}}>직역</p>
                      <p style={{fontSize:12, color:"var(--text2)", fontStyle:"italic"}}>"{item.phrase}"을 글자 그대로 번역</p>
                    </div>
                    <div style={{background:"rgba(124,106,247,0.07)", border:"1px solid rgba(124,106,247,0.2)", borderRadius:8, padding:"10px 12px"}}>
                      <p style={{fontSize:11, fontWeight:700, color:"var(--accent)", marginBottom:4}}>실제 의미</p>
                      <p style={{fontSize:12, color:"var(--text)", fontWeight:600}}>{item.meaning}</p>
                    </div>
                  </div>
                  {item.appeared_in && (
                    <p style={{fontSize:11, color:"var(--text2)", marginTop:8}}>📚 기출: {item.appeared_in}</p>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
