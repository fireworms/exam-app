import { useEffect, useState } from "react"
import { useSubject } from "./SubjectContext"
import API from "../../api"

const PRIORITY_STYLE = {
  "최상": "bg-danger/20 text-danger border-danger/30",
  "상": "bg-warn/20 text-warn border-warn/30",
  "중": "bg-muted/10 text-muted border-lborder",
}

export default function Priority() {
  const subject = useSubject()
  const [data, setData] = useState(null)

  useEffect(() => {
    setData(null)
    fetch(`${API}/api/learn/priority?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setData)
  }, [subject])

  if (!data) return <div className="text-muted text-sm">로딩 중...</div>
  if (!data.title && !data.absolutely_required) return (
    <div className="text-muted text-sm text-center py-8">학습 우선순위 데이터가 없어요.</div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">학습 우선순위</h1>
        <p className="text-muted text-sm mt-1">{subject} · {data.title}</p>
      </div>

      {data.total_target_questions && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-5 py-3">
          <p className="text-sm font-semibold text-accent">{data.total_target_questions}</p>
        </div>
      )}

      {data.absolutely_required?.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-[var(--text)] mb-3">✅ 반드시 학습할 영역</h2>
          <div className="space-y-2">
            {data.absolutely_required.map((item, i) => (
              <div key={i} className="flex items-center gap-4 bg-bg2 border border-lborder rounded-xl px-5 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold shrink-0 ${PRIORITY_STYLE[item.priority] || ""}`}>
                  {item.priority}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text)]">{item.area}</p>
                </div>
                {item.expected_questions != null && (
                  <span className="text-xs text-muted shrink-0">예상 {item.expected_questions}문제</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.do_not_study?.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-[var(--text)] mb-3">❌ 시간 낭비 영역</h2>
          <div className="bg-bg2 border border-lborder rounded-xl p-4 space-y-2">
            {data.do_not_study.map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-danger shrink-0 mt-0.5">✗</span>
                <span className="text-[var(--text2)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
