import { useEffect, useState } from "react"
import { useSubject } from "./SubjectContext"
import API from "../../api"

const PRIORITY_BADGE = {
  "최상": "lp-badge-danger",
  "상":   "lp-badge-warn",
  "중":   "lp-badge-muted",
}

export default function Priority() {
  const subject = useSubject()
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    fetch(`${API}/api/learn/priority?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setData)
  }, [subject])

  if (!data) return <div className="lp-empty">로딩 중...</div>
  if (!data.title && !data.absolutely_required && !Object.values(data).some(v => v)) {
    return <div className="lp-empty">학습 우선순위 데이터가 없어요.</div>
  }

  const priorities = [
    { key: "1순위", label: "1순위 — 반드시 정복" },
    { key: "2순위", label: "2순위 — 시간 대비 효율" },
    { key: "3순위", label: "3순위 — 여유 있을 때" },
  ]

  const hasPriorities = priorities.some(p => data[p.key])

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">학습 우선순위</h1>
        {data.title && <p className="lp-subtitle">{subject} · {data.title}</p>}
      </div>

      {data.total_target_questions && (
        <div className="lp-card-accent">
          <p style={{fontSize:14, fontWeight:600, color:"var(--accent)"}}>{data.total_target_questions}</p>
        </div>
      )}

      {/* 우선순위 그룹 (새 JSON 포맷) */}
      {hasPriorities && priorities.map(({ key, label }) => {
        const group = data[key]
        if (!group) return null
        return (
          <div key={key}>
            <p className="lp-section-label">{label}</p>
            <div className="lp-card">
              <div style={{display:"flex", flexDirection:"column", gap:6, marginBottom:12}}>
                {group.areas?.map((area, i) => (
                  <div key={i} style={{padding:"8px 0", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:10}}>
                    <span style={{fontSize:13, color:"var(--text)", fontWeight:600}}>{area}</span>
                  </div>
                ))}
              </div>
              {group.reason && (
                <p className="lp-muted" style={{fontSize:12, marginBottom:6}}><b>이유:</b> {group.reason}</p>
              )}
              {group.method && (
                <p className="lp-muted" style={{fontSize:12}}><b>방법:</b> {group.method}</p>
              )}
              {group.daily_time && (
                <p className="lp-muted" style={{fontSize:12, marginTop:4}}><b>권장 시간:</b> {group.daily_time}</p>
              )}
            </div>
          </div>
        )
      })}

      {/* 반드시 학습할 영역 (구 포맷) */}
      {data.absolutely_required?.length > 0 && (
        <div>
          <p className="lp-section-label">반드시 학습할 영역</p>
          <div className="lp-list">
            {data.absolutely_required.map((item, i) => (
              <div key={i} className="lp-card" style={{display:"flex", alignItems:"center", gap:14}}>
                <span className={`lp-badge ${PRIORITY_BADGE[item.priority] || "lp-badge-muted"}`}>
                  {item.priority}
                </span>
                <span style={{flex:1, fontSize:14, fontWeight:600, color:"var(--text)"}}>{item.area}</span>
                {item.expected_questions != null && (
                  <span className="lp-muted" style={{fontSize:12, flexShrink:0}}>예상 {item.expected_questions}문제</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시간 낭비 영역 */}
      {data.do_not_study?.length > 0 && (
        <div>
          <p className="lp-section-label">시간 낭비 영역 — 공부하지 말 것</p>
          <div className="lp-card-danger">
            {data.do_not_study.map((item, i) => (
              <div key={i} style={{display:"flex", gap:10, alignItems:"flex-start", padding:"6px 0", borderBottom:"1px solid rgba(248,113,113,0.15)"}}>
                <span className="lp-danger" style={{flexShrink:0, fontSize:12, marginTop:2}}>✗</span>
                <span style={{fontSize:13, color:"var(--text2)", lineHeight:1.6}}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
