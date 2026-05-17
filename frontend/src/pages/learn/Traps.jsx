import { useEffect, useState } from "react"
import { useSubject } from "./SubjectContext"
import API from "../../api"

const FREQ_CLASS = {
  "매우 높음": "lp-badge-danger",
  "높음": "lp-badge-warn",
}

export default function Traps() {
  const subject = useSubject()
  const [traps, setTraps] = useState([])
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    setTraps([])
    fetch(`${API}/api/learn/traps?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setTraps)
  }, [subject])

  const filtered = traps.filter(t =>
    !query || t.trap?.includes(query) || t.countermeasure?.includes(query)
  )

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">함정 모음</h1>
        <p className="lp-subtitle">{subject} · 클릭하면 대처법을 볼 수 있어요</p>
      </div>

      <input
        className="lp-input"
        placeholder="함정 키워드 검색..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {filtered.length === 0 && <div className="lp-empty">함정 데이터가 없어요.</div>}

      <div>
        {filtered.length > 0 && <p className="lp-section-label">{filtered.length}개 함정 패턴</p>}
        <div className="lp-list">
          {filtered.map((trap, i) => (
            <button
              key={trap.rank ?? i}
              className="lp-row"
              style={{flexDirection:"column", alignItems:"flex-start"}}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div style={{display:"flex", alignItems:"center", gap:12, width:"100%"}}>
                <span style={{fontSize:14, fontWeight:900, color:"var(--accent)", opacity:0.45, width:30, textAlign:"center", flexShrink:0}}>
                  {String((trap.rank ?? i + 1)).padStart(2, "0")}
                </span>
                <div style={{flex:1, minWidth:0}}>
                  {trap.frequency && (
                    <span className={`lp-badge ${FREQ_CLASS[trap.frequency] || "lp-badge-muted"}`} style={{marginBottom:6, display:"inline-block"}}>
                      {trap.frequency}
                    </span>
                  )}
                  <p style={{fontWeight:700, fontSize:14, color:"var(--text)", textAlign:"left"}}>{trap.trap}</p>
                </div>
                <span className="lp-muted" style={{fontSize:11, flexShrink:0}}>{expanded === i ? "▲" : "▼"}</span>
              </div>

              {expanded === i && trap.countermeasure && (
                <div style={{width:"100%", marginTop:12, paddingTop:12, borderTop:"1px solid var(--border)", paddingLeft:42}}>
                  <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6}}>대처법</p>
                  <p style={{fontSize:13, color:"var(--correct)", lineHeight:1.7}}>{trap.countermeasure}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
