import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import API from "../../api"

function Section({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-bg2 border border-lborder rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-bg3 transition-colors"
      >
        <span className="font-semibold text-sm text-[var(--text)]">{title}</span>
        <span className="text-muted text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-5 pb-4 pt-1">{children}</div>}
    </div>
  )
}

function ExampleList({ examples }) {
  if (!examples?.length) return null
  return (
    <ul className="mt-2 space-y-1">
      {examples.map((ex, i) => (
        <li key={i} className="text-xs text-muted pl-3 border-l-2 border-accent/30">
          {ex}
        </li>
      ))}
    </ul>
  )
}

function RuleCard({ item, type }) {
  const title = item.rule || item.tool || item.step
    ? `${item.step ? `Step ${item.step}. ` : ""}${item.rule || item.tool || item.action || item.principle || item.type || item.clue || ""}`
    : item.trap || item.pattern || ""
  const desc = item.description || item.tip || item.example || ""

  return (
    <div className="py-3 border-b border-lborder last:border-0">
      {title && <p className="text-sm font-semibold text-[var(--text)] mb-1">{title}</p>}
      {desc && <p className="text-xs text-muted">{desc}</p>}
      {item.examples && <ExampleList examples={item.examples} />}
      {item.words && (
        <div className="flex flex-wrap gap-1 mt-1">
          {item.words.map(w => (
            <span key={w} className="text-xs px-2 py-0.5 bg-bg3 rounded text-accent">{w}</span>
          ))}
        </div>
      )}
      {item.patterns && <ExampleList examples={item.patterns} />}
    </div>
  )
}

function SubcategoryTabs({ subcategories }) {
  const keys = Object.keys(subcategories)
  const [active, setActive] = useState(keys[0])
  const sub = subcategories[active]

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {keys.map(k => (
          <button
            key={k}
            onClick={() => setActive(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active === k ? "bg-accent text-white" : "bg-bg3 text-muted hover:text-[var(--text)]"
            }`}
          >
            {sub?.name || k}
          </button>
        ))}
      </div>
      {sub && (
        <div className="space-y-2 text-xs text-muted">
          {Object.entries(sub).filter(([k]) => k !== "name").map(([k, v]) => (
            <div key={k}>
              <p className="font-semibold text-[var(--text2)] mb-1">{k}</p>
              {Array.isArray(v) ? (
                <ul className="space-y-1 pl-3">
                  {v.map((item, i) => (
                    <li key={i} className="border-l-2 border-accent/20 pl-2">
                      {typeof item === "string" ? item : JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              ) : typeof v === "object" ? (
                <pre className="text-xs bg-bg3 p-2 rounded overflow-x-auto">{JSON.stringify(v, null, 2)}</pre>
              ) : (
                <p>{String(v)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AreaDetail() {
  const { areaKey } = useParams()
  const [area, setArea] = useState(null)
  const [bookmarked, setBookmarked] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setArea(null)
    fetch(`${API}/api/learn/areas/${areaKey}`).then(r => r.json()).then(data => {
      setArea(data)
      setBookmarked(data.bookmarked)
    })
  }, [areaKey])

  const toggleBookmark = async () => {
    if (bookmarked) {
      await fetch(`${API}/api/learn/bookmarks/by-key/area/${areaKey}?subject=국어`, { method: "DELETE" })
    } else {
      await fetch(`${API}/api/learn/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "area", key: areaKey, label: area?.name || areaKey }),
      })
    }
    setBookmarked(b => !b)
  }

  if (!area) return <div className="text-muted text-sm">로딩 중...</div>

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted mb-1">{area["出題_position"]}</p>
          <h1 className="text-2xl font-bold text-[var(--text)]">{area.name}</h1>
        </div>
        <button
          onClick={toggleBookmark}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-sm transition-all border ${
            bookmarked
              ? "border-warn text-warn bg-warn/10"
              : "border-lborder text-muted hover:border-warn/50"
          }`}
        >
          {bookmarked ? "★ 저장됨" : "☆ 북마크"}
        </button>
      </div>

      {/* 출제 형식 */}
      {area.format && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-5 py-4">
          <p className="text-xs text-accent font-semibold mb-1">출제 형식</p>
          <p className="text-sm text-[var(--text2)]">{area.format}</p>
        </div>
      )}

      {/* 핵심 규칙 */}
      {area.core_rules?.length > 0 && (
        <Section title="핵심 규칙">
          {area.core_rules.map((r, i) => <RuleCard key={i} item={r} type="rule" />)}
        </Section>
      )}

      {/* 풀이 도구 */}
      {area.tools?.length > 0 && (
        <Section title="풀이 도구">
          {area.tools.map((t, i) => <RuleCard key={i} item={t} type="tool" />)}
        </Section>
      )}

      {/* 풀이 원칙 */}
      {area.principles?.length > 0 && (
        <Section title="풀이 원칙">
          {area.principles.map((p, i) => <RuleCard key={i} item={p} type="principle" />)}
        </Section>
      )}

      {/* 풀이 단계 */}
      {area.solving_steps?.length > 0 && (
        <Section title="풀이 단계">
          {area.solving_steps.map((s, i) => <RuleCard key={i} item={s} type="step" />)}
        </Section>
      )}

      {/* 배열 단서 */}
      {area.clues?.length > 0 && (
        <Section title="배열 단서">
          {area.clues.map((c, i) => <RuleCard key={i} item={c} type="clue" />)}
        </Section>
      )}

      {/* 유형 */}
      {area.formats?.length > 0 && (
        <Section title="출제 유형">
          <ul className="space-y-1.5">
            {area.formats.map((f, i) => (
              <li key={i} className="text-sm text-[var(--text2)] pl-3 border-l-2 border-accent/30">{f}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* 문제 유형 */}
      {area.question_types?.length > 0 && (
        <Section title="문제 유형">
          <ul className="space-y-1.5">
            {area.question_types.map((q, i) => (
              <li key={i} className="text-sm text-[var(--text2)] pl-3 border-l-2 border-accent/30">{q}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* 팁 */}
      {area.tip && (
        <div className="bg-success/10 border border-success/30 rounded-xl px-5 py-3">
          <p className="text-xs text-success font-semibold mb-1">TIP</p>
          <p className="text-sm text-[var(--text2)]">{area.tip}</p>
        </div>
      )}

      {/* 함정 */}
      {area.traps?.length > 0 && (
        <Section title="⚠ 자주 나오는 함정">
          <ul className="space-y-2">
            {area.traps.map((trap, i) => (
              <li key={i} className="text-sm text-danger pl-3 border-l-2 border-danger/40">
                {typeof trap === "string" ? trap : JSON.stringify(trap)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 함정 (biggest_trap) */}
      {area.biggest_trap && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl px-5 py-3">
          <p className="text-xs text-danger font-semibold mb-1">가장 큰 함정</p>
          <p className="text-sm text-[var(--text2)]">{area.biggest_trap}</p>
        </div>
      )}

      {/* 하위 카테고리 (문법) */}
      {area.subcategories && (
        <Section title="하위 카테고리">
          <SubcategoryTabs subcategories={area.subcategories} />
        </Section>
      )}

      {/* 공통 패턴 */}
      {area.common_traps?.length > 0 && (
        <Section title="자주 나오는 함정 유형">
          {area.common_traps.map((t, i) => <RuleCard key={i} item={t} type="trap" />)}
        </Section>
      )}

      {/* 관련 기출 */}
      {area.related_questions?.length > 0 && (
        <div>
          <p className="text-xs text-muted font-semibold mb-2 uppercase tracking-wider">관련 기출</p>
          <div className="flex flex-wrap gap-2">
            {area.related_questions.map((q, i) => (
              <span key={i} className="text-xs px-3 py-1 bg-bg3 border border-lborder rounded-full text-[var(--text2)]">
                {q}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 이전/다음 내비게이션 */}
      <div className="flex items-center justify-between pt-4 border-t border-lborder">
        {area.prev_key ? (
          <button
            onClick={() => navigate(`/learn/areas/${area.prev_key}`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg2 border border-lborder rounded-xl text-sm hover:border-accent/50 transition-all"
          >
            <span className="text-accent">←</span>
            <span className="text-[var(--text2)]">{area.prev_name}</span>
          </button>
        ) : <div />}

        <button
          onClick={() => navigate("/learn/areas")}
          className="text-xs text-muted hover:text-accent transition-colors"
        >
          목록
        </button>

        {area.next_key ? (
          <button
            onClick={() => navigate(`/learn/areas/${area.next_key}`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg2 border border-lborder rounded-xl text-sm hover:border-accent/50 transition-all"
          >
            <span className="text-[var(--text2)]">{area.next_name}</span>
            <span className="text-accent">→</span>
          </button>
        ) : <div />}
      </div>
    </div>
  )
}
