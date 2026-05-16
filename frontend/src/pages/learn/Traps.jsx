import { useEffect, useState } from "react"
import API from "../../api"

const FREQ_STYLE = {
  "매우 높음": "bg-danger/20 text-danger border-danger/30",
  "높음": "bg-warn/20 text-warn border-warn/30",
  "중간": "bg-muted/10 text-muted border-lborder",
}

export default function Traps() {
  const [traps, setTraps] = useState([])
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/learn/traps`).then(r => r.json()).then(setTraps)
  }, [])

  const filtered = traps.filter(t =>
    !query || t.trap.includes(query) || t.countermeasure.includes(query)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">함정 모음</h1>
        <p className="text-muted text-sm mt-1">출제자가 자주 쓰는 함정 패턴 TOP 15</p>
      </div>

      <input
        className="w-full bg-bg2 border border-lborder rounded-xl px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-accent/50 placeholder:text-muted"
        placeholder="함정 키워드 검색..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      <div className="space-y-2">
        {filtered.map(trap => (
          <button
            key={trap.rank}
            onClick={() => setExpanded(expanded === trap.rank ? null : trap.rank)}
            className="w-full text-left bg-bg2 border border-lborder rounded-xl p-4 hover:border-accent/30 transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="text-lg font-black text-accent/40 shrink-0 w-8 text-center">
                {String(trap.rank).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${FREQ_STYLE[trap.frequency] || FREQ_STYLE["중간"]}`}>
                    {trap.frequency}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">{trap.trap}</p>
                {expanded === trap.rank && (
                  <div className="mt-3 pt-3 border-t border-lborder">
                    <p className="text-xs text-muted font-semibold mb-1">대처법</p>
                    <p className="text-sm text-success">{trap.countermeasure}</p>
                  </div>
                )}
              </div>
              <span className="text-muted text-xs shrink-0">{expanded === trap.rank ? "▲" : "▼"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
