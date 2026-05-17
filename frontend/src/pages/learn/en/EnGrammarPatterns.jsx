import { useEffect, useState } from "react"
import { useSubject } from "../SubjectContext"
import API from "../../../api"

function PatternDetail({ p }) {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>

      {/* 형태 */}
      {p.form && (
        <div>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6}}>형태</p>
          <div style={{background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:8, padding:"10px 14px"}}>
            <code style={{fontSize:13, color:"var(--accent)", fontFamily:"'JetBrains Mono', monospace"}}>{p.form}</code>
          </div>
        </div>
      )}

      {/* 동등 표현 */}
      {p.equivalent && (
        <div>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6}}>동등 표현</p>
          <p style={{fontSize:13, color:"var(--text2)", paddingLeft:12, borderLeft:"2px solid var(--border)"}}>= {p.equivalent}</p>
        </div>
      )}

      {/* 예시 */}
      {p.example && (
        <div>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6}}>예시</p>
          <div className="lp-card-accent">
            <p style={{fontSize:13, color:"var(--text)", fontStyle:"italic", marginBottom:p.korean ? 8 : 0}}>{p.example}</p>
            {p.korean && <p style={{fontSize:12, color:"var(--text2)"}}>→ {p.korean}</p>}
          </div>
        </div>
      )}

      {/* 복수 예시 */}
      {p.examples?.length > 0 && (
        <div>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6}}>예시</p>
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            {p.examples.map((ex, i) => (
              <p key={i} style={{fontSize:13, color:"var(--text2)", paddingLeft:12, borderLeft:"2px solid rgba(124,106,247,0.3)", fontStyle:"italic"}}>{ex}</p>
            ))}
          </div>
        </div>
      )}

      {/* 복수 패턴 */}
      {p.patterns?.length > 0 && (
        <div>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6}}>패턴 목록</p>
          <div style={{display:"flex", flexDirection:"column", gap:4}}>
            {p.patterns.map((pt, i) => (
              <div key={i} style={{background:"var(--bg3)", borderRadius:6, padding:"7px 12px"}}>
                <code style={{fontSize:12, color:"var(--accent2)", fontFamily:"'JetBrains Mono', monospace"}}>{pt}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 관련 동사 */}
      {p.verbs?.length > 0 && (
        <div>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6}}>관련 동사</p>
          <div className="lp-tags">
            {p.verbs.map(v => <span key={v} className="lp-tag lp-tag-accent">{v}</span>)}
          </div>
        </div>
      )}

      {/* 형용사 목록 */}
      {p.adjectives?.length > 0 && (
        <div>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6}}>관련 형용사</p>
          <div className="lp-tags">
            {p.adjectives.map(a => <span key={a} className="lp-tag lp-tag-accent">{a}</span>)}
          </div>
        </div>
      )}

      {/* 핵심 포인트 */}
      {p.key_point && (
        <div className="lp-card-warn">
          <p style={{fontSize:11, fontWeight:700, color:"var(--scrap)", marginBottom:4}}>핵심 포인트</p>
          <p style={{fontSize:13, color:"var(--text2)"}}>{p.key_point}</p>
        </div>
      )}

      {/* rule 오브젝트 */}
      {p.rule && typeof p.rule === "object" && (
        <div>
          <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8}}>규칙</p>
          <div className="lp-card">
            {Object.entries(p.rule).map(([k, v]) => (
              <div key={k} style={{padding:"6px 0", borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:13, fontWeight:700, color:"var(--accent)", marginRight:8}}>{k}</span>
                <span style={{fontSize:12, color:"var(--text2)"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기출 */}
      {p.appeared_in && (
        <p style={{fontSize:12, color:"var(--text2)"}}>📚 기출: {p.appeared_in}</p>
      )}
      {p.exam_trick && (
        <div className="lp-card-danger">
          <p style={{fontSize:11, fontWeight:700, color:"var(--wrong)", marginBottom:4}}>시험 함정</p>
          <p style={{fontSize:13, color:"var(--text2)"}}>{p.exam_trick}</p>
        </div>
      )}
    </div>
  )
}

export default function EnGrammarPatterns() {
  const subject = useSubject()
  const [patterns, setPatterns] = useState([])
  const [active, setActive] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/learn/grammar-patterns?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(data => { setPatterns(data); setActive(null) })
  }, [subject])

  if (!patterns.length) return <div className="lp-empty">로딩 중...</div>

  const current = active !== null ? patterns[active] : null

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">문법 패턴</h1>
        <p className="lp-subtitle">{subject} · 핵심 문법 패턴 {patterns.length}개 · 항목을 클릭하면 상세 내용을 볼 수 있어요</p>
      </div>

      <div className="lp-grid-2" style={{gap:16, alignItems:"flex-start"}}>

        {/* 패턴 목록 */}
        <div>
          <p className="lp-section-label">패턴 목록</p>
          <div className="lp-list">
            {patterns.map((p, i) => (
              <button
                key={i}
                className="lp-row"
                style={{
                  borderColor: active === i ? "var(--accent)" : undefined,
                  background: active === i ? "var(--bg3)" : undefined,
                }}
                onClick={() => setActive(active === i ? null : i)}
              >
                <span style={{
                  fontSize:14, fontWeight:900, color:"var(--accent)", opacity:0.5,
                  width:28, flexShrink:0, textAlign:"center",
                }}>
                  {String(p.id || i+1).padStart(2,"0")}
                </span>
                <span style={{fontSize:13, fontWeight:600, color:"var(--text)", textAlign:"left", flex:1}}>
                  {p.name}
                </span>
                <span className="lp-muted" style={{fontSize:11}}>{active === i ? "▲" : "▼"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 상세 */}
        <div>
          {current ? (
            <>
              <p className="lp-section-label">패턴 {current.id || active+1} 상세</p>
              <div className="lp-card">
                <p style={{fontSize:16, fontWeight:800, color:"var(--text)", marginBottom:16}}>{current.name}</p>
                <PatternDetail p={current} />
              </div>
            </>
          ) : (
            <div className="lp-card" style={{textAlign:"center", padding:"40px 20px"}}>
              <p className="lp-muted" style={{fontSize:13}}>왼쪽에서 패턴을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
