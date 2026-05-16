import { useEffect, useState } from "react"
import API from "../../api"

const TAB_MAP = {
  antonyms: "방향 반의어",
  causative_passive: "사동·피동",
  honorifics: "높임법",
  tense_modality: "시제·양태",
}

function ValueDisplay({ val }) {
  if (!val) return null
  if (typeof val === "string") return <p className="text-sm text-[var(--text2)]">{val}</p>
  if (Array.isArray(val)) return (
    <ul className="space-y-1.5 mt-1">
      {val.map((item, i) => (
        <li key={i} className="pl-3 border-l-2 border-accent/30 text-sm text-[var(--text2)]">
          {typeof item === "string" ? item : (
            <div>
              {item.type && <span className="font-semibold text-accent2 mr-2">{item.type}</span>}
              {item.morpheme && <span className="font-semibold text-accent2 mr-2">{item.morpheme}</span>}
              {item.position && <span className="font-semibold text-accent2 mr-2">{item.position}</span>}
              {(item.definition || item.basic || item.modality || item.description || item.rule) && (
                <span className="text-muted mr-2">
                  {item.definition || item.basic || item.description || item.rule}
                </span>
              )}
              {item.markers && (
                <span className="text-xs">
                  {item.markers.map(m => (
                    <span key={m} className="inline-block bg-bg3 px-1.5 py-0.5 rounded mr-1 text-accent">{m}</span>
                  ))}
                </span>
              )}
              {item.examples && (
                <ul className="mt-1 space-y-0.5">
                  {item.examples.map((ex, j) => (
                    <li key={j} className="text-xs text-muted pl-2 border-l border-accent/20">{ex}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
  if (typeof val === "object") return (
    <div className="space-y-2 mt-1">
      {Object.entries(val).map(([k, v]) => (
        <div key={k}>
          <p className="text-xs text-muted font-semibold mb-0.5">{k.replace(/_/g, " ")}</p>
          <ValueDisplay val={v} />
        </div>
      ))}
    </div>
  )
  return <p className="text-sm text-[var(--text2)]">{String(val)}</p>
}

export default function Grammar() {
  const [grammar, setGrammar] = useState(null)
  const [active, setActive] = useState("antonyms")

  useEffect(() => {
    fetch(`${API}/api/learn/grammar`).then(r => r.json()).then(setGrammar)
  }, [])

  if (!grammar) return <div className="text-muted text-sm">로딩 중...</div>

  const section = grammar[active]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">문법 기초</h1>
        <p className="text-muted text-sm mt-1">시험 자주 나오는 문법 개념 정리</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.keys(TAB_MAP).map(key => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              active === key
                ? "bg-accent text-white"
                : "bg-bg2 border border-lborder text-muted hover:text-[var(--text)]"
            }`}
          >
            {TAB_MAP[key]}
          </button>
        ))}
      </div>

      {section && (
        <div className="bg-bg2 border border-lborder rounded-xl p-5 space-y-4">
          {section.name && (
            <h2 className="text-base font-bold text-[var(--text)]">{section.name}</h2>
          )}
          {Object.entries(section)
            .filter(([k]) => k !== "name")
            .map(([k, v]) => (
              <div key={k} className="border-t border-lborder pt-4 first:border-0 first:pt-0">
                <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">
                  {k.replace(/_/g, " ")}
                </p>
                <ValueDisplay val={v} />
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
