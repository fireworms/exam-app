import { useEffect, useState } from "react"
import API from "../../api"

const PRIORITY_STYLE = {
  "최상": "bg-danger/20 text-danger border-danger/30",
  "상": "bg-warn/20 text-warn border-warn/30",
  "중": "bg-muted/10 text-muted border-lborder",
}

export default function Priority() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/learn/priority`).then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="text-muted text-sm">로딩 중...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">학습 우선순위</h1>
        <p className="text-muted text-sm mt-1">{data.title}</p>
      </div>

      <div className="bg-accent/10 border border-accent/30 rounded-xl px-5 py-3">
        <p className="text-sm font-semibold text-accent">{data.total_target_questions}</p>
      </div>

      {/* 반드시 학습 */}
      <div>
        <h2 className="text-base font-bold text-[var(--text)] mb-3">✅ 반드시 학습할 영역</h2>
        <div className="space-y-2">
          {data.absolutely_required?.map((item, i) => (
            <div key={i} className="flex items-center gap-4 bg-bg2 border border-lborder rounded-xl px-5 py-3">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold shrink-0 ${PRIORITY_STYLE[item.priority] || ""}`}>
                {item.priority}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--text)]">{item.area}</p>
              </div>
              <span className="text-xs text-muted shrink-0">예상 {item.expected_questions}문제</span>
            </div>
          ))}
        </div>
      </div>

      {/* 학습하지 말 것 */}
      <div>
        <h2 className="text-base font-bold text-[var(--text)] mb-3">❌ 시간 낭비 영역</h2>
        <div className="bg-bg2 border border-lborder rounded-xl p-4 space-y-2">
          {data.do_not_study?.map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="text-danger shrink-0 mt-0.5">✗</span>
              <span className="text-[var(--text2)]">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
