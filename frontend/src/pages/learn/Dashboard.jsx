import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import API from "../../api"

const DIFFICULTY_COLOR = { "상": "text-danger", "중": "text-warn", "하": "text-success" }
const PRIORITY_COLOR = { "최상": "bg-danger/20 text-danger", "상": "bg-warn/20 text-warn", "중": "bg-muted/20 text-muted" }

export default function Dashboard() {
  const [meta, setMeta] = useState(null)
  const [topAreas, setTopAreas] = useState([])
  const [paradigm, setParadigm] = useState(null)
  const [motto, setMotto] = useState("")
  const [progress, setProgress] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/learn/meta`).then(r => r.json()),
      fetch(`${API}/api/learn/top-areas`).then(r => r.json()),
      fetch(`${API}/api/learn/paradigm-shift`).then(r => r.json()),
      fetch(`${API}/api/learn/motto`).then(r => r.json()),
      fetch(`${API}/api/learn/progress`).then(r => r.json()),
    ]).then(([m, t, p, mo, pr]) => {
      setMeta(m); setTopAreas(t); setParadigm(p)
      setMotto(mo.motto); setProgress(pr)
    })
  }, [])

  if (!meta) return <div className="text-muted text-sm">로딩 중...</div>

  const checklistPct = progress?.checklist_total
    ? Math.round((progress.checklist_done / progress.checklist_total) * 100)
    : 0

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">{meta.title}</h1>
        <p className="text-muted text-sm mt-1">{meta.analysis_scope}</p>
      </div>

      {/* 2025 대전환 배너 */}
      {paradigm && (
        <div className="rounded-xl bg-accent/10 border border-accent/30 p-5">
          <h2 className="font-bold text-accent text-base mb-2">🔁 {paradigm.title}</h2>
          <p className="text-sm text-[var(--text2)]">{paradigm.description}</p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-xs text-muted font-semibold mb-2 uppercase tracking-wider">사라진 영역</p>
              {paradigm.disappeared_areas?.map(a => (
                <div key={a.area} className="flex justify-between items-center py-1 border-b border-lborder text-xs">
                  <span className="text-[var(--text2)]">{a.area}</span>
                  <span className="text-muted line-through">{a.prev_frequency}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted font-semibold mb-2 uppercase tracking-wider">급증한 영역</p>
              {paradigm.increased_areas?.map(a => (
                <div key={a.area} className="flex justify-between items-center py-1 border-b border-lborder text-xs">
                  <span className="text-[var(--text2)]">{a.area}</span>
                  <span className="text-accent font-semibold">{a.current_frequency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 진도 요약 */}
      {progress && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-bg2 rounded-xl p-4 border border-lborder">
            <p className="text-xs text-muted mb-1">열람한 영역</p>
            <p className="text-2xl font-bold text-accent">{progress.viewed_areas?.length ?? 0}</p>
            <p className="text-xs text-muted">/ 11개</p>
          </div>
          <div className="bg-bg2 rounded-xl p-4 border border-lborder">
            <p className="text-xs text-muted mb-1">체크리스트</p>
            <p className="text-2xl font-bold text-success">{checklistPct}%</p>
            <p className="text-xs text-muted">{progress.checklist_done}/{progress.checklist_total}</p>
          </div>
          <div className="bg-bg2 rounded-xl p-4 border border-lborder cursor-pointer hover:border-accent/40 transition-colors"
            onClick={() => navigate("/learn/checklist")}>
            <p className="text-xs text-muted mb-1">D-day 준비</p>
            <p className="text-sm font-semibold text-[var(--text)]">체크리스트 →</p>
          </div>
        </div>
      )}

      {/* 빈출 TOP 10 */}
      <div>
        <h2 className="text-base font-bold mb-4 text-[var(--text)]">빈출 TOP 10 영역</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {topAreas.map(area => (
            <button
              key={area.rank}
              onClick={() => area.area_key && !Array.isArray(area.area_key) && navigate(`/learn/areas/${area.area_key}`)}
              disabled={!area.area_key || Array.isArray(area.area_key)}
              className="text-left bg-bg2 border border-lborder rounded-xl p-4 hover:border-accent/50 transition-all disabled:opacity-50 disabled:cursor-default"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-muted">#{area.rank}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLOR["최상"] || ""}`}>
                      {area.difficulty === "상" ? "난이도 상" : area.difficulty === "중" ? "난이도 중" : "난이도 하"}
                    </span>
                  </div>
                  <p className="font-semibold text-sm text-[var(--text)]">{area.name}</p>
                  <p className="text-xs text-muted mt-1">회차당 {area.frequency_per_round}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black text-accent">{area.study_weight}%</div>
                  <div className="text-xs text-muted">학습 비중</div>
                </div>
              </div>
              <div className="mt-3 h-1 bg-bg3 rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full" style={{ width: `${area.study_weight * 4}%` }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 최종 모토 */}
      {motto && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 text-center">
          <p className="text-sm font-bold text-accent">"{motto}"</p>
        </div>
      )}
    </div>
  )
}
