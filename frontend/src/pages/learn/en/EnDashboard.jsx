import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSubject } from "../SubjectContext"
import API from "../../../api"

export default function EnDashboard() {
  const subject = useSubject()
  const navigate = useNavigate()
  const [meta, setMeta] = useState(null)
  const [paradigm, setParadigm] = useState(null)
  const [topAreas, setTopAreas] = useState([])
  const [mindset, setMindset] = useState([])
  const [dist, setDist] = useState([])

  const q = `?subject=${encodeURIComponent(subject)}`

  useEffect(() => {
    setMeta(null)
    Promise.all([
      fetch(`${API}/api/learn/meta${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/paradigm${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/mindset${q}`).then(r => r.json()),
    ]).then(([m, p, ms]) => {
      setMeta(m); setParadigm(p); setMindset(ms)
    }).catch(() => setMeta({}))

    fetch(`${API}/api/learn/meta${q}`).then(r => r.json()).then(m => {
      fetch(`${API}/api/learn/top-areas${q}`).then(r => r.json()).then(setTopAreas).catch(() => {})
    })

    // 분포 예측 데이터는 subjects 목록과 함께 얻기
    fetch(`${API}/api/learn/paradigm${q}`)
      .then(r => r.json())
      .then(p => {
        // predicted_distribution은 paradigm 엔드포인트가 아닌 별도 접근 필요
      })
  }, [subject])

  // 분포 예측 별도 fetch
  useEffect(() => {
    fetch(`${API}/api/learn/subjects`)
      .then(r => r.json())
      .then(() => {
        // 백엔드에서 직접 가져오기
        fetch(`${API}/api/learn/paradigm${q}`)
          .then(r => r.json())
          .then(data => {
            if (data.predicted_distribution_2026_local) {
              setDist(data.predicted_distribution_2026_local)
            }
          })
      })
  }, [subject])

  if (!meta) return <div className="lp-empty">로딩 중...</div>
  if (!meta.title && !meta.target_exam) return <div className="lp-empty">{subject} 학습자료가 없어요.</div>

  const title = meta.title || meta.target_exam || subject

  return (
    <div className="lp-page">

      {/* 제목 */}
      <div>
        <h1 className="lp-title">{title}</h1>
        <p className="lp-subtitle">{meta.analysis_basis || meta.analysis_scope}</p>
      </div>

      {/* 패러다임 전환 */}
      {paradigm?.summary && (
        <div>
          <p className="lp-section-label">2025년 출제 패러다임 전환</p>
          <div className="lp-card-accent" style={{marginBottom:12}}>
            <p className="lp-text2" style={{lineHeight:1.7}}>{paradigm.summary}</p>
          </div>
          <div className="lp-grid-2" style={{gap:12}}>
            {/* 사라진 영역 */}
            {paradigm.dead_zones?.length > 0 && (
              <div className="lp-card-danger">
                <p style={{fontSize:11, fontWeight:700, color:"var(--wrong)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12}}>소멸 영역</p>
                {paradigm.dead_zones.map((z, i) => (
                  <div key={i} style={{padding:"8px 0", borderBottom:"1px solid rgba(248,113,113,0.15)"}}>
                    <p style={{fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:2}}>{z.area}</p>
                    <p style={{fontSize:11, color:"var(--text2)"}}>이전: {z.before_2025} → 현재: <span style={{color:"var(--wrong)", fontWeight:700}}>{z.after_2025}</span></p>
                  </div>
                ))}
              </div>
            )}
            {/* 급증 영역 */}
            {paradigm.power_zones?.length > 0 && (
              <div className="lp-card-success">
                <p style={{fontSize:11, fontWeight:700, color:"var(--correct)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12}}>급증 영역</p>
                {paradigm.power_zones.map((z, i) => (
                  <div key={i} style={{padding:"8px 0", borderBottom:"1px solid rgba(74,222,128,0.15)"}}>
                    <p style={{fontSize:13, fontWeight:700, color:"var(--text)", marginBottom:2}}>{z.area}</p>
                    <p style={{fontSize:11, color:"var(--text2)"}}>이전: {z.before_2025} → 현재: <span style={{color:"var(--correct)", fontWeight:700}}>{z.after_2025}</span></p>
                    <span style={{fontSize:10, color:"var(--correct)", fontWeight:700}}>{z.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 빠른 이동 */}
      <div>
        <p className="lp-section-label">영어 전용 학습 메뉴</p>
        <div className="lp-grid-2">
          {[
            { path: "/learn/en/vocabulary", label: "어휘 학습", desc: "시사 빈출 어휘 50선 · 분야별", icon: "A" },
            { path: "/learn/en/grammar",    label: "문법 패턴", desc: "핵심 패턴 10개 · 기출 연결",  icon: "Ω" },
            { path: "/learn/en/idioms",     label: "관용구",    desc: "4분야 관용구 · 직역/의역",   icon: "✦" },
            { path: "/learn/en/business",   label: "실무 영어", desc: "이메일·회의·행정 표현",      icon: "✉" },
            { path: "/learn/traps",         label: "함정 모음", desc: "빈출 함정 15개 · 회피법",    icon: "⚠" },
            { path: "/learn/en/time-strategy", label: "시간 전략", desc: "20분·20문제 배분 전략",   icon: "◷" },
          ].map(item => (
            <button key={item.path} className="lp-row" style={{flexDirection:"column", alignItems:"flex-start"}}
              onClick={() => navigate(item.path)}>
              <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:4}}>
                <span style={{fontSize:18, color:"var(--accent)", width:24, textAlign:"center"}}>{item.icon}</span>
                <span style={{fontWeight:700, fontSize:14, color:"var(--text)"}}>{item.label}</span>
              </div>
              <p className="lp-muted" style={{fontSize:12, paddingLeft:34}}>{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 합격 마인드셋 */}
      {mindset.length > 0 && (
        <div>
          <p className="lp-section-label">합격 마인드셋</p>
          <div style={{display:"flex", flexDirection:"column", gap:10}}>
            {mindset.map((m, i) => (
              <div key={i} className="lp-card">
                <p style={{fontWeight:700, fontSize:14, color:"var(--accent)", marginBottom:6}}>{m.title}</p>
                <p className="lp-text2" style={{lineHeight:1.7, fontSize:13}}>{m.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
