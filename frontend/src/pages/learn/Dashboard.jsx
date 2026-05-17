import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSubject } from "./SubjectContext"
import API from "../../api"

export default function Dashboard() {
  const subject = useSubject()
  const [meta, setMeta] = useState(null)
  const [topAreas, setTopAreas] = useState([])
  const [paradigm, setParadigm] = useState(null)
  const [motto, setMotto] = useState("")
  const [progress, setProgress] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const q = `?subject=${encodeURIComponent(subject)}`
    setMeta(null)
    Promise.all([
      fetch(`${API}/api/learn/meta${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/top-areas${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/paradigm-shift${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/motto${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/progress${q}`).then(r => r.json()),
    ]).then(([m, t, p, mo, pr]) => {
      setMeta(m); setTopAreas(t); setParadigm(p)
      setMotto(mo.motto); setProgress(pr)
    }).catch(() => setMeta({}))
  }, [subject])

  if (!meta) return <div className="lp-empty">로딩 중...</div>
  if (!meta.title) return <div className="lp-empty">{subject} 학습자료가 없어요.</div>

  const checklistPct = progress?.checklist_total
    ? Math.round((progress.checklist_done / progress.checklist_total) * 100)
    : 0

  return (
    <div className="lp-page">

      {/* 제목 */}
      <div>
        <h1 className="lp-title">{meta.title}</h1>
        <p className="lp-subtitle">{meta.analysis_scope}</p>
      </div>

      {/* 진행 현황 */}
      {progress && (
        <div>
          <p className="lp-section-label">학습 현황</p>
          <div className="lp-grid-3">
            <div className="lp-card">
              <p className="lp-stat-label">열람한 영역</p>
              <p className="lp-stat-num lp-accent">{progress.viewed_areas?.length ?? 0}</p>
            </div>
            <div className="lp-card">
              <p className="lp-stat-label">체크리스트</p>
              <p className="lp-stat-num lp-success">{checklistPct}%</p>
              <p className="lp-text-sm">{progress.checklist_done}/{progress.checklist_total} 완료</p>
            </div>
            <button className="lp-row" style={{flexDirection:"column", alignItems:"flex-start"}} onClick={() => navigate("/learn/checklist")}>
              <p className="lp-stat-label">D-day 준비</p>
              <p className="lp-text" style={{fontWeight:700, marginTop:6}}>체크리스트 →</p>
            </button>
          </div>
        </div>
      )}

      {/* 패러다임 변화 */}
      {paradigm?.title && (
        <div>
          <p className="lp-section-label">출제 경향 변화</p>
          <div className="lp-card-accent">
            <p style={{fontWeight:700, color:"var(--accent)", marginBottom:8}}>{paradigm.title}</p>
            <p className="lp-text2" style={{marginBottom:16}}>{paradigm.description}</p>
            {(paradigm.disappeared_areas?.length > 0 || paradigm.increased_areas?.length > 0) && (
              <div className="lp-grid-2" style={{gap:20}}>
                <div>
                  <p className="lp-section-label" style={{marginBottom:10}}>사라진 영역</p>
                  {paradigm.disappeared_areas?.map(a => (
                    <div key={a.area} style={{display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)"}}>
                      <span className="lp-text2" style={{fontSize:12}}>{a.area}</span>
                      <span className="lp-muted" style={{fontSize:11, textDecoration:"line-through"}}>{a.prev_frequency}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="lp-section-label" style={{marginBottom:10}}>급증한 영역</p>
                  {paradigm.increased_areas?.map(a => (
                    <div key={a.area} style={{display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)"}}>
                      <span className="lp-text2" style={{fontSize:12}}>{a.area}</span>
                      <span className="lp-accent" style={{fontSize:11, fontWeight:700}}>{a.current_frequency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 빈출 TOP 영역 */}
      {topAreas.length > 0 && (
        <div>
          <p className="lp-section-label">빈출 TOP {topAreas.length} 영역</p>
          <div className="lp-grid-2">
            {topAreas.map(area => (
              <button
                key={area.rank}
                onClick={() => area.area_key && navigate(`/learn/areas/${area.area_key}`)}
                disabled={!area.area_key}
                className="lp-row"
                style={{flexDirection:"column", alignItems:"flex-start", opacity: area.area_key ? 1 : 0.5, cursor: area.area_key ? "pointer" : "default"}}
              >
                <div style={{display:"flex", justifyContent:"space-between", width:"100%", marginBottom:6}}>
                  <span style={{fontSize:11, fontWeight:700, color:"var(--text2)"}}>#{area.rank}</span>
                  {area.study_weight != null && (
                    <span className="lp-accent" style={{fontSize:18, fontWeight:900, lineHeight:1}}>{area.study_weight}%</span>
                  )}
                </div>
                <p style={{fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:4}}>{area.name}</p>
                {area.frequency_per_round && (
                  <p className="lp-muted" style={{fontSize:12}}>회차당 {area.frequency_per_round}</p>
                )}
                {area.study_weight != null && (
                  <div className="lp-progress-track" style={{width:"100%", marginTop:10}}>
                    <div className="lp-progress-fill" style={{width:`${Math.min(area.study_weight * 4, 100)}%`}} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 모토 */}
      {motto && (
        <div className="lp-card-accent" style={{textAlign:"center"}}>
          <p style={{fontSize:14, fontWeight:700, color:"var(--accent)"}}>"{motto}"</p>
        </div>
      )}
    </div>
  )
}
