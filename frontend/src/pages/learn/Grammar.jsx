import { useEffect, useState } from "react"
import { useSubject } from "./SubjectContext"
import API from "../../api"

function ValueDisplay({ val }) {
  if (!val) return null
  if (typeof val === "string") return <p style={{fontSize:13, color:"var(--text2)", lineHeight:1.7}}>{val}</p>
  if (Array.isArray(val)) return (
    <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:4}}>
      {val.map((item, i) => (
        <div key={i} style={{paddingLeft:12, borderLeft:"2px solid rgba(124,106,247,0.3)"}}>
          {typeof item === "string" ? (
            <p style={{fontSize:13, color:"var(--text2)", lineHeight:1.6}}>{item}</p>
          ) : (
            <div>
              {(item.type || item.morpheme || item.position) && (
                <span style={{fontSize:13, fontWeight:700, color:"var(--accent2)", marginRight:8}}>
                  {item.type || item.morpheme || item.position}
                </span>
              )}
              {(item.definition || item.basic || item.description || item.rule) && (
                <span style={{fontSize:12, color:"var(--text2)"}}>
                  {item.definition || item.basic || item.description || item.rule}
                </span>
              )}
              {item.markers?.length > 0 && (
                <div style={{display:"flex", flexWrap:"wrap", gap:4, marginTop:4}}>
                  {item.markers.map(m => (
                    <span key={m} style={{fontSize:11, padding:"2px 8px", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:20, color:"var(--accent)"}}>{m}</span>
                  ))}
                </div>
              )}
              {item.examples?.length > 0 && (
                <div style={{marginTop:6}}>
                  {item.examples.map((ex, j) => (
                    <p key={j} style={{fontSize:12, color:"var(--text2)", paddingLeft:8, borderLeft:"1px solid var(--border)", marginTop:2}}>{ex}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
  if (typeof val === "object") return (
    <div style={{display:"flex", flexDirection:"column", gap:12, marginTop:4}}>
      {Object.entries(val).map(([k, v]) => (
        <div key={k}>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6}}>{k.replace(/_/g, " ")}</p>
          <ValueDisplay val={v} />
        </div>
      ))}
    </div>
  )
  return <p style={{fontSize:13, color:"var(--text2)"}}>{String(val)}</p>
}

export default function Grammar() {
  const subject = useSubject()
  const [grammar, setGrammar] = useState(null)
  const [active, setActive] = useState(null)

  useEffect(() => {
    setGrammar(null)
    fetch(`${API}/api/learn/grammar?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(data => {
        setGrammar(data)
        const keys = Object.keys(data)
        if (keys.length) setActive(keys[0])
      })
  }, [subject])

  if (!grammar) return <div className="lp-empty">로딩 중...</div>

  const keys = Object.keys(grammar)
  if (!keys.length) return <div className="lp-empty">문법 데이터가 없어요.</div>

  const section = active ? grammar[active] : null

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">문법 기초</h1>
        <p className="lp-subtitle">{subject} · 자주 나오는 문법 개념 정리</p>
      </div>

      {/* 탭 */}
      <div>
        <p className="lp-section-label">카테고리 선택</p>
        <div className="lp-tabs">
          {keys.map(key => (
            <button
              key={key}
              className={`lp-tab-btn${active === key ? " active" : ""}`}
              onClick={() => setActive(key)}
            >
              {grammar[key]?.name || key.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* 내용 */}
      {section && (
        <div>
          {section.name && <p className="lp-section-label">{section.name}</p>}
          <div style={{display:"flex", flexDirection:"column", gap:16}}>
            {Object.entries(section)
              .filter(([k]) => k !== "name")
              .map(([k, v]) => (
                <div key={k} className="lp-card">
                  <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12, paddingBottom:8, borderBottom:"1px solid var(--border)"}}>
                    {k.replace(/_/g, " ")}
                  </p>
                  <ValueDisplay val={v} />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
