import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useSubject } from "./SubjectContext"
import API from "../../api"

function Accordion({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="lp-accordion">
      <button className="lp-accordion-head" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <span className="lp-toggle">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="lp-accordion-body">{children}</div>}
    </div>
  )
}

function RuleItem({ item }) {
  const title = item.step
    ? `Step ${item.step}. ${item.action || ""}`
    : item.rule || item.tool || item.principle || item.type || item.clue || item.trap || ""
  const desc = item.description || item.tip || item.example || ""

  return (
    <div className="lp-rule-item">
      {title && <p className="lp-rule-title">{title}</p>}
      {desc && <p className="lp-rule-desc">{desc}</p>}
      {item.examples?.length > 0 && (
        <ul style={{marginTop:6}}>
          {item.examples.map((ex, i) => (
            <li key={i} style={{fontSize:12, color:"var(--text2)", paddingLeft:12, borderLeft:"2px solid rgba(124,106,247,0.3)", marginTop:3, lineHeight:1.6}}>{ex}</li>
          ))}
        </ul>
      )}
      {item.words?.length > 0 && (
        <div className="lp-tags" style={{marginTop:6}}>
          {item.words.map(w => <span key={w} className="lp-tag lp-tag-accent">{w}</span>)}
        </div>
      )}
    </div>
  )
}

function SubcategoryTabs({ subcategories }) {
  const keys = Object.keys(subcategories)
  const [active, setActive] = useState(keys[0])
  const sub = subcategories[active]
  return (
    <div>
      <div className="lp-tabs" style={{marginBottom:16}}>
        {keys.map(k => (
          <button key={k} className={`lp-tab-btn${active === k ? " active" : ""}`} onClick={() => setActive(k)}>
            {subcategories[k]?.name || k}
          </button>
        ))}
      </div>
      {sub && (
        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          {Object.entries(sub).filter(([k]) => k !== "name").map(([k, v]) => (
            <div key={k}>
              <p style={{fontSize:11, fontWeight:700, color:"var(--text2)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6}}>{k.replace(/_/g," ")}</p>
              {Array.isArray(v) ? (
                <ul style={{display:"flex", flexDirection:"column", gap:4}}>
                  {v.map((item, i) => (
                    <li key={i} style={{fontSize:12, color:"var(--text2)", paddingLeft:10, borderLeft:"2px solid rgba(124,106,247,0.3)", lineHeight:1.6}}>
                      {typeof item === "string" ? item : JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              ) : typeof v === "object" ? (
                <pre style={{fontSize:11, background:"var(--bg3)", padding:"10px 12px", borderRadius:8, overflow:"auto", color:"var(--text2)"}}>{JSON.stringify(v, null, 2)}</pre>
              ) : <p style={{fontSize:12, color:"var(--text2)"}}>{String(v)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AreaDetail() {
  const { areaKey } = useParams()
  const subject = useSubject()
  const [area, setArea] = useState(null)
  const [bookmarked, setBookmarked] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setArea(null)
    fetch(`${API}/api/learn/areas/${areaKey}?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(data => { setArea(data); setBookmarked(data.bookmarked) })
  }, [areaKey, subject])

  const toggleBookmark = async () => {
    if (bookmarked) {
      await fetch(`${API}/api/learn/bookmarks/by-key/area/${areaKey}?subject=${encodeURIComponent(subject)}`, { method: "DELETE" })
    } else {
      await fetch(`${API}/api/learn/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "area", key: areaKey, label: area?.name || areaKey, subject }),
      })
    }
    setBookmarked(b => !b)
  }

  if (!area) return <div className="lp-empty">로딩 중...</div>

  return (
    <div className="lp-page">

      {/* 헤더 */}
      <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16}}>
        <div>
          {area["出題_position"] && <p className="lp-muted" style={{fontSize:12, marginBottom:4}}>{area["出題_position"]}</p>}
          <h1 className="lp-title">{area.name}</h1>
        </div>
        <button
          className={`lp-btn${bookmarked ? " lp-btn-active" : " lp-btn-warn"}`}
          onClick={toggleBookmark}
          style={{flexShrink:0}}
        >
          {bookmarked ? "★ 저장됨" : "☆ 북마크"}
        </button>
      </div>

      {/* 출제 형식 */}
      {area.format && (
        <div>
          <p className="lp-section-label">출제 형식</p>
          <div className="lp-card-accent">
            <p className="lp-text2">{area.format}</p>
          </div>
        </div>
      )}

      {/* 핵심 전략 */}
      {area.core_strategy && (
        <div>
          <p className="lp-section-label">핵심 전략</p>
          <div className="lp-card-accent">
            <p className="lp-text2" style={{lineHeight:1.7}}>{area.core_strategy}</p>
          </div>
        </div>
      )}

      {/* 핵심 패턴 */}
      {area.key_patterns?.length > 0 && (
        <div>
          <p className="lp-section-label">핵심 패턴</p>
          <div className="lp-card">
            {area.key_patterns.map((p, i) => (
              <p key={i} style={{fontSize:13, color:"var(--text2)", paddingLeft:12, borderLeft:"2px solid var(--accent)", marginBottom:8, lineHeight:1.6}}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* 핵심 규칙 */}
      {area.core_rules?.length > 0 && (
        <div>
          <p className="lp-section-label">핵심 규칙</p>
          <Accordion title={`핵심 규칙 (${area.core_rules.length}개)`}>
            {area.core_rules.map((r, i) => <RuleItem key={i} item={r} />)}
          </Accordion>
        </div>
      )}

      {/* 풀이 단계 */}
      {area.solving_steps?.length > 0 && (
        <div>
          <p className="lp-section-label">풀이 단계</p>
          <Accordion title={`풀이 단계 (${area.solving_steps.length}단계)`}>
            {area.solving_steps.map((s, i) => <RuleItem key={i} item={s} />)}
          </Accordion>
        </div>
      )}

      {/* 풀이 도구 */}
      {area.tools?.length > 0 && (
        <div>
          <p className="lp-section-label">풀이 도구</p>
          <Accordion title={`풀이 도구 (${area.tools.length}개)`}>
            {area.tools.map((t, i) => <RuleItem key={i} item={t} />)}
          </Accordion>
        </div>
      )}

      {/* 풀이 원칙 */}
      {area.principles?.length > 0 && (
        <div>
          <p className="lp-section-label">풀이 원칙</p>
          <Accordion title={`풀이 원칙 (${area.principles.length}개)`}>
            {area.principles.map((p, i) => <RuleItem key={i} item={p} />)}
          </Accordion>
        </div>
      )}

      {/* 배열 단서 */}
      {area.clues?.length > 0 && (
        <div>
          <p className="lp-section-label">배열 단서</p>
          <Accordion title={`배열 단서 (${area.clues.length}개)`}>
            {area.clues.map((c, i) => <RuleItem key={i} item={c} />)}
          </Accordion>
        </div>
      )}

      {/* 출제 유형 */}
      {(area.formats?.length > 0 || area.question_types?.length > 0) && (
        <div>
          <p className="lp-section-label">출제 유형</p>
          <div className="lp-card">
            {(area.formats || area.question_types || []).map((item, i) => (
              <p key={i} style={{fontSize:13, color:"var(--text2)", paddingLeft:12, borderLeft:"2px solid var(--border)", marginBottom:8, lineHeight:1.6}}>
                {typeof item === "string" ? item : JSON.stringify(item)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* TIP */}
      {area.tip && (
        <div>
          <p className="lp-section-label">TIP</p>
          <div className="lp-card-success">
            <p className="lp-text2" style={{lineHeight:1.7}}>{area.tip}</p>
          </div>
        </div>
      )}

      {/* 자주 나오는 함정 */}
      {(area.traps?.length > 0 || area.common_traps?.length > 0) && (
        <div>
          <p className="lp-section-label">자주 나오는 함정</p>
          <Accordion title="함정 유형">
            {(area.traps || []).map((trap, i) => (
              <div key={i} className="lp-rule-item">
                <p style={{fontSize:13, color:"var(--wrong)", lineHeight:1.6}}>
                  {typeof trap === "string" ? trap : JSON.stringify(trap)}
                </p>
              </div>
            ))}
            {(area.common_traps || []).map((t, i) => <RuleItem key={`ct${i}`} item={t} />)}
          </Accordion>
        </div>
      )}

      {/* 가장 큰 함정 */}
      {area.biggest_trap && (
        <div>
          <p className="lp-section-label">가장 큰 함정</p>
          <div className="lp-card-danger">
            <p className="lp-text2" style={{lineHeight:1.7}}>{area.biggest_trap}</p>
          </div>
        </div>
      )}

      {/* 일반 함정 */}
      {area.common_mistakes?.length > 0 && (
        <div>
          <p className="lp-section-label">흔한 실수</p>
          <div className="lp-card">
            {area.common_mistakes.map((m, i) => (
              <p key={i} style={{fontSize:13, color:"var(--text2)", paddingLeft:12, borderLeft:"2px solid var(--wrong)", marginBottom:8}}>{typeof m === "string" ? m : m.error || JSON.stringify(m)}</p>
            ))}
          </div>
        </div>
      )}

      {/* 하위 카테고리 */}
      {area.subcategories && (
        <div>
          <p className="lp-section-label">하위 카테고리</p>
          <div className="lp-card">
            <SubcategoryTabs subcategories={area.subcategories} />
          </div>
        </div>
      )}

      {/* 관련 기출 */}
      {area.related_questions?.length > 0 && (
        <div>
          <p className="lp-section-label">관련 기출</p>
          <div className="lp-tags">
            {area.related_questions.map((q, i) => <span key={i} className="lp-tag">{q}</span>)}
          </div>
        </div>
      )}

      {/* 시험 예시 */}
      {area.exam_examples?.length > 0 && (
        <div>
          <p className="lp-section-label">기출 예시</p>
          <div className="lp-card">
            {area.exam_examples.map((ex, i) => (
              <p key={i} style={{fontSize:12, color:"var(--text2)", paddingLeft:10, borderLeft:"2px solid var(--border)", marginBottom:8}}>{ex}</p>
            ))}
          </div>
        </div>
      )}

      {/* 시간 팁 */}
      {area.time_tip && (
        <div className="lp-card-warn">
          <p style={{fontSize:12, fontWeight:700, color:"var(--scrap)", marginBottom:4}}>시간 관리</p>
          <p className="lp-text2">{area.time_tip}</p>
        </div>
      )}

      {/* 이전/다음 */}
      <div>
        <div className="lp-divider" style={{marginBottom:20}} />
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
          {area.prev_key ? (
            <button className="lp-row" style={{flex:1, maxWidth:240}} onClick={() => navigate(`/learn/areas/${area.prev_key}`)}>
              <span className="lp-accent">←</span>
              <span className="lp-text2" style={{fontSize:13}}>{area.prev_name}</span>
            </button>
          ) : <div />}
          <button onClick={() => navigate("/learn/areas")} className="lp-muted" style={{fontSize:12, background:"none", border:"none", cursor:"pointer", padding:"4px 8px"}}>
            목록
          </button>
          {area.next_key ? (
            <button className="lp-row" style={{flex:1, maxWidth:240, justifyContent:"flex-end"}} onClick={() => navigate(`/learn/areas/${area.next_key}`)}>
              <span className="lp-text2" style={{fontSize:13}}>{area.next_name}</span>
              <span className="lp-accent">→</span>
            </button>
          ) : <div />}
        </div>
      </div>
    </div>
  )
}
