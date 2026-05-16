import { useEffect, useState } from "react"
import { useSubject } from "./SubjectContext"
import API from "../../api"

function CheckItem({ id, text, checked, onToggle }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group py-2 border-b border-lborder last:border-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id, !checked)}
        className="mt-0.5 accent-[#7c6af7] w-4 h-4 shrink-0 cursor-pointer"
      />
      <span className={`text-sm transition-all ${checked ? "line-through text-muted" : "text-[var(--text2)] group-hover:text-[var(--text)]"}`}>
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

  if (!checklist) return <div className="text-muted text-sm">로딩 중...</div>

  const groups = [
    { id: "one_week", title: "📅 시험 1주 전", items: checklist.one_week_before || [] },
    { id: "must", title: "🔴 전날 — 절대 잊지 말 것", items: checklist.day_before?.must_remember || [], danger: true },
    { id: "strategy", title: "⚡ 시험 당일 전략", items: checklist.day_before?.exam_strategy || [], accent: true },
  ]

  const allItems = groups.flatMap(g => g.items.map((_, i) => `${g.id}_${i}`))
  const total = allItems.length
  const done = allItems.filter(id => progress[id]).length
  const pct = total ? Math.round((done / total) * 100) : 0

  if (!total) return <div className="text-muted text-sm text-center py-8">체크리스트 데이터가 없어요.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">시험 직전 체크리스트</h1>
          <p className="text-muted text-sm mt-1">{subject} · 체크하면 자동 저장</p>
        </div>
        <button
          onClick={reset}
          className="text-xs text-muted border border-lborder rounded-lg px-3 py-1.5 hover:border-danger/50 hover:text-danger transition-all"
        >
          초기화
        </button>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted mb-2">
          <span>전체 진행률</span>
          <span>{done}/{total} ({pct}%)</span>
        </div>
        <div className="h-2 bg-bg3 rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {groups.map(g => g.items.length > 0 && (
        <div key={g.id} className="bg-bg2 border border-lborder rounded-xl p-5">
          <h2 className={`text-sm font-bold mb-3 ${g.danger ? "text-danger" : g.accent ? "text-accent" : "text-[var(--text)]"}`}>
            {g.title}
          </h2>
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
      ))}
    </div>
  )
}
