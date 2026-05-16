import { useEffect, useState } from "react"
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
  const [checklist, setChecklist] = useState(null)
  const [progress, setProgress] = useState({})

  useEffect(() => {
    fetch(`${API}/api/learn/checklist`).then(r => r.json()).then(d => {
      setChecklist(d.checklist)
      setProgress(d.progress)
    })
  }, [])

  const toggle = async (itemId, checked) => {
    setProgress(prev => ({ ...prev, [itemId]: checked }))
    await fetch(`${API}/api/learn/progress/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, checked }),
    })
  }

  const reset = async () => {
    if (!confirm("모든 체크를 초기화할까요?")) return
    await fetch(`${API}/api/learn/progress/checklist/reset?subject=국어`, { method: "POST" })
    setProgress({})
  }

  if (!checklist) return <div className="text-muted text-sm">로딩 중...</div>

  const allItems = [
    ...(checklist.one_week_before || []).map((t, i) => ({ id: `one_week_${i}`, text: t })),
    ...(checklist.day_before?.must_remember || []).map((t, i) => ({ id: `must_${i}`, text: t })),
    ...(checklist.day_before?.exam_strategy || []).map((t, i) => ({ id: `strategy_${i}`, text: t })),
  ]
  const total = allItems.length
  const done = allItems.filter(i => progress[i.id]).length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">시험 직전 체크리스트</h1>
          <p className="text-muted text-sm mt-1">체크하면 자동으로 저장돼요</p>
        </div>
        <button
          onClick={reset}
          className="text-xs text-muted border border-lborder rounded-lg px-3 py-1.5 hover:border-danger/50 hover:text-danger transition-all"
        >
          초기화
        </button>
      </div>

      {/* 진행률 */}
      <div>
        <div className="flex justify-between text-xs text-muted mb-2">
          <span>전체 진행률</span>
          <span>{done}/{total} ({pct}%)</span>
        </div>
        <div className="h-2 bg-bg3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 1주 전 */}
      <div className="bg-bg2 border border-lborder rounded-xl p-5">
        <h2 className="text-sm font-bold text-[var(--text)] mb-3">📅 시험 1주 전</h2>
        {(checklist.one_week_before || []).map((text, i) => (
          <CheckItem
            key={i}
            id={`one_week_${i}`}
            text={text}
            checked={!!progress[`one_week_${i}`]}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* 전날 - 절대 잊지 말 것 */}
      <div className="bg-bg2 border border-lborder rounded-xl p-5">
        <h2 className="text-sm font-bold text-danger mb-3">🔴 시험 전날 — 절대 잊지 말 것</h2>
        {(checklist.day_before?.must_remember || []).map((text, i) => (
          <CheckItem
            key={i}
            id={`must_${i}`}
            text={text}
            checked={!!progress[`must_${i}`]}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* 전날 - 시험 전략 */}
      <div className="bg-bg2 border border-lborder rounded-xl p-5">
        <h2 className="text-sm font-bold text-accent mb-3">⚡ 시험 당일 전략</h2>
        {(checklist.day_before?.exam_strategy || []).map((text, i) => (
          <CheckItem
            key={i}
            id={`strategy_${i}`}
            text={text}
            checked={!!progress[`strategy_${i}`]}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  )
}
