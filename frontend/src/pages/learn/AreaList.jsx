import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSubject } from "./SubjectContext"
import API from "../../api"

export default function AreaList() {
  const subject = useSubject()
  const [areas, setAreas] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API}/api/learn/areas?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setAreas)
  }, [subject])

  if (!areas.length) return <div className="lp-empty">로딩 중...</div>

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">영역별 학습</h1>
        <p className="lp-subtitle">{subject} · 항목을 클릭하면 상세 내용을 볼 수 있어요</p>
      </div>

      <div>
        <p className="lp-section-label">전체 {areas.length}개 영역</p>
        <div className="lp-list">
          {areas.map((area, idx) => (
            <button
              key={area.key}
              className="lp-row"
              onClick={() => navigate(`/learn/areas/${area.key}`)}
            >
              <span style={{fontSize:15, fontWeight:900, color:"var(--accent)", opacity:0.5, width:32, textAlign:"center", flexShrink:0}}>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div style={{flex:1, minWidth:0, textAlign:"left"}}>
                <p style={{fontWeight:700, fontSize:14, color:"var(--text)"}}>{area.name}</p>
                {area.position && <p className="lp-muted" style={{fontSize:12, marginTop:2}}>{area.position}</p>}
              </div>
              {area.viewed && <span className="lp-badge lp-badge-success">열람</span>}
              <span className="lp-accent" style={{flexShrink:0, fontSize:14}}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
