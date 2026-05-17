import { useEffect, useState } from "react"
import { useSubject } from "../SubjectContext"
import API from "../../../api"

export default function EnTimeStrategy() {
  const subject = useSubject()
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/learn/time-strategy?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setData)
  }, [subject])

  if (!data) return <div className="lp-empty">로딩 중...</div>
  if (!data.phases) return <div className="lp-empty">시간 전략 데이터가 없어요.</div>

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">시간 전략</h1>
        <p className="lp-subtitle">{subject} · {data.total_minutes}분 · {data.phases?.reduce((s, p) => s + p.count, 0) || 20}문제</p>
      </div>

      {/* 페이즈별 시간 배분 */}
      <div>
        <p className="lp-section-label">단계별 시간 배분</p>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {data.phases?.map((phase, i) => {
            const pct = Math.round((phase.minutes / data.total_minutes) * 100)
            return (
              <div key={i} className="lp-card">
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                  <div>
                    <span style={{fontSize:11, fontWeight:700, color:"var(--accent)", marginRight:8}}>
                      {typeof phase.questions === "number" ? `${phase.questions}번` : `${phase.questions}번`}
                    </span>
                    <span style={{fontSize:13, fontWeight:600, color:"var(--text)"}}>{phase.area}</span>
                  </div>
                  <span style={{fontSize:16, fontWeight:800, color:"var(--accent)"}}>{phase.minutes}분</span>
                </div>
                <div className="lp-progress-track">
                  <div className="lp-progress-fill" style={{width:`${pct}%`}} />
                </div>
                <p className="lp-muted" style={{fontSize:11, marginTop:4, textAlign:"right"}}>누적 {phase.cumulative}분</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 시간 부족 시 우선순위 */}
      {data.priority_when_time_short?.length > 0 && (
        <div>
          <p className="lp-section-label">시간 부족 시 이 순서로</p>
          <div className="lp-card">
            {data.priority_when_time_short.map((item, i) => (
              <div key={i} style={{display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:12, fontWeight:800, color:"var(--accent)", opacity:0.5, width:20, textAlign:"center", flexShrink:0}}>
                  {i+1}
                </span>
                <span style={{fontSize:13, color:"var(--text2)"}}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
