import { useEffect, useState } from "react"
import { useSubject } from "./SubjectContext"
import API from "../../api"

const FREQ_STYLE = {
  "매우 높음": "bg-danger/20 text-danger border-danger/30",
  "높음": "bg-warn/20 text-warn border-warn/30",
  "중간": "bg-muted/10 text-muted border-lborder",
}

export default function Traps() {
  const subject = useSubject()
  const [traps, setTraps] = useState([])
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    setTraps([])
    fetch(`${API}/api/learn/traps?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setTraps)
  }, [subject])

  const filtered = traps.filter(t =>
    !query || t.trap?.includes(query) || t.countermeasure?.includes(query)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">함정 모음</h1>
        <p className="text-muted text-sm mt-1">{subject} · 출제자가 자주 쓰는 함정 패턴</p>
      </div>

      <input
        className="w-full bg-bg2 border border-lborder rounded-xl px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-accent/50 placeholder:text-muted"
        placeholder="함정 키워드 검색..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {filtered.length === 0 && (
        <p className="text-muted text-sm text-center py-8">함정 데이터가 없어요.</p>
      )}

      <div className="space-y-2">
        {filtered.map((trap, i) => (
          <button
            key={trap.rank ?? i}
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full text-left bg-bg2 border border-lborder rounded-xl p-4 hover:border-accent/30 transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg font-black text-accent/40 shrink-0 w-8 text-center">
                {String((trap.rank ?? i + 1)).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                {trap.frequency && (
                  <div className="mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${FREQ_STYLE[trap.frequency] || FREQ_STYLE["중간"]}`}>
                      {trap.frequency}
                    </span>
                  </div>
                )}
                <p className="text-sm font-semibold text-[var(--text)]">{trap.trap}</p>
                {expanded === i && trap.countermeasure && (
                  <div className="mt-3 pt-3 border-t border-lborder">
                    <p className="text-xs text-muted font-semibold mb-1">대처법</p>
                    <p className="text-sm text-success">{trap.countermeasure}</p>
                  </div>
                )}
              </div>
              <span className="text-muted text-xs shrink-0">{expanded === i ? "▲" : "▼"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
