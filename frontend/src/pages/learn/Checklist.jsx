import { useEffect, useState } from "react"
import { useSubject } from "./SubjectContext"
import API from "../../api"

function CheckItem({ id, text, checked, onToggle }) {
  return (
    <label style={{
      display:"flex", alignItems:"flex-start", gap:12,
      cursor:"pointer",
      padding:"11px 0",
      borderBottom:"1px solid var(--border)",
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id, !checked)}
        style={{marginTop:2, width:16, height:16, flexShrink:0, cursor:"pointer", accentColor:"var(--accent)"}}
      />
      <span style={{
        fontSize:13, lineHeight:1.6,
        color: checked ? "var(--text2)" : "var(--text)",
        textDecoration: checked ? "line-through" : "none",
        opacity: checked ? 0.6 : 1,
        transition: "all 0.15s",
      }}>
        {text}
      </span>
    </label>
  )
}

export default function Checklist() {
  const subject = useSubject()
  const [checklist, setChecklist] = useState(null)
  const [progress, setProgress] = useState({})

  useEffect(() => {
    setChecklist(null)
    fetch(`${API}/api/learn/checklist?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(d => { setChecklist(d.checklist); setProgress(d.progress) })
  }, [subject])

  const toggle = async (itemId, checked) => {
    setProgress(prev => ({ ...prev, [itemId]: checked }))
    await fetch(`${API}/api/learn/progress/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, checked, subject }),
    })
  }

  const reset = async () => {
    if (!confirm("모든 체크를 초기화할까요?")) return
    await fetch(`${API}/api/learn/progress/checklist/reset?subject=${encodeURIComponent(subject)}`, { method: "POST" })
    setProgress({})
  }

  if (!checklist) return <div className="lp-empty">로딩 중...</div>

  const dynamicGroups = []

  if (checklist.독해 || checklist.문법 || checklist.어휘) {
    Object.entries(checklist).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        dynamicGroups.push({ id: k, title: k, items: v })
      }
    })
  } else {
    const fixedGroups = [
      { id: "one_week", title: "시험 1주 전", items: checklist.one_week_before || [] },
      { id: "must", title: "전날 — 절대 잊지 말 것", items: checklist.day_before?.must_remember || [], danger: true },
      { id: "strategy", title: "시험 당일 전략", items: checklist.day_before?.exam_strategy || [], accent: true },
    ]
    fixedGroups.forEach(g => dynamicGroups.push(g))
  }

  const allItems = dynamicGroups.flatMap(g => g.items.map((_, i) => `${g.id}_${i}`))
  const total = allItems.length
  const done = allItems.filter(id => progress[id]).length
  const pct = total ? Math.round((done / total) * 100) : 0

  if (!total) return <div className="lp-empty">체크리스트 데이터가 없어요.</div>

  return (
    <div className="lp-page">

      {/* 헤더 */}
      <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16}}>
        <div>
          <h1 className="lp-title">시험 직전 체크리스트</h1>
          <p className="lp-subtitle">{subject} · 체크하면 자동 저장</p>
        </div>
        <button className="lp-btn lp-btn-danger" onClick={reset} style={{flexShrink:0}}>
          초기화
        </button>
      </div>

      {/* 진행률 */}
      <div className="lp-card">
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
          <span style={{fontSize:13, fontWeight:600, color:"var(--text)"}}>전체 진행률</span>
          <span className="lp-muted" style={{fontSize:12}}>{done}/{total} ({pct}%)</span>
        </div>
        <div className="lp-progress-track">
          <div className="lp-progress-fill" style={{width:`${pct}%`}} />
        </div>
      </div>

      {/* 그룹별 체크리스트 */}
      {dynamicGroups.map(g => g.items.length > 0 && (
        <div key={g.id}>
          <p className="lp-section-label" style={{
            color: g.danger ? "var(--wrong)" : g.accent ? "var(--accent)" : undefined
          }}>
            {g.title}
          </p>
          <div className="lp-card">
            {g.items.map((text, i) => (
              <CheckItem
                key={i}
                id={`${g.id}_${i}`}
                text={text}
                checked={!!progress[`${g.id}_${i}`]}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
