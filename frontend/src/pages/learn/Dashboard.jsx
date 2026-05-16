import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSubject } from "./SubjectContext"
import API from "../../api"

export default function Dashboard() {
  const subject = useSubject()
  const [meta, setMeta] = useState(null)
  const [topAreas, setTopAreas] = useState([])
  const [paradigm, setParadigm] = useState(null)
  const [motto, setMotto] = useState("")
  const [progress, setProgress] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const q = `?subject=${encodeURIComponent(subject)}`
    setMeta(null)
    Promise.all([
      fetch(`${API}/api/learn/meta${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/top-areas${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/paradigm-shift${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/motto${q}`).then(r => r.json()),
      fetch(`${API}/api/learn/progress${q}`).then(r => r.json()),
    ]).then(([m, t, p, mo, pr]) => {
      setMeta(m); setTopAreas(t); setParadigm(p)
      setMotto(mo.motto); setProgress(pr)
    }).catch(() => setMeta({}))
  }, [subject])

  if (!meta) return <div className="text-muted text-sm">로딩 중...</div>
  if (!meta.title) return <div className="text-muted text-sm">{subject} 학습자료가 없어요.</div>

  const checklistPct = progress?.checklist_total
    ? Math.round((progress.checklist_done / progress.checklist_total) * 100)
    : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">{meta.title}</h1>
        <p className="text-muted text-sm mt-1">{meta.analysis_scope}</p>
      </div>

      {paradigm?.title && (
        <div className="rounded-xl bg-accent/10 border border-accent/30 p-5">
          <h2 className="font-bold text-accent text-base mb-2">🔁 {paradigm.title}</h2>
          <p className="text-sm text-[var(--text2)]">{paradigm.description}</p>
          {(paradigm.disappeared_areas?.length > 0 || paradigm.increased_areas?.length > 0) && (
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
          )}
        </div>
      )}

      {progress && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-bg2 rounded-xl p-4 border border-lborder">
            <p className="text-xs text-muted mb-1">열람한 영역</p>
            <p className="text-2xl font-bold text-accent">{progress.viewed_areas?.length ?? 0}</p>
          </div>
          <div className="bg-bg2 rounded-xl p-4 border border-lborder">
            <p className="text-xs text-muted mb-1">체크리스트</p>
            <p className="text-2xl font-bold text-success">{checklistPct}%</p>
            <p className="text-xs text-muted">{progress.checklist_done}/{progress.checklist_total}</p>
          </div>
          <div
            className="bg-bg2 rounded-xl p-4 border border-lborder cursor-pointer hover:border-accent/40 transition-colors"
            onClick={() => navigate("/learn/checklist")}
          >
            <p className="text-xs text-muted mb-1">D-day 준비</p>
            <p className="text-sm font-semibold text-[var(--text)]">체크리스트 →</p>
          </div>
        </div>
      )}

      {topAreas.length > 0 && (
        <div>
          <h2 className="text-base font-bold mb-4 text-[var(--text)]">빈출 TOP {topAreas.length} 영역</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topAreas.map(area => (
              <button
                key={area.rank}
                onClick={() => area.area_key && navigate(`/learn/areas/${area.area_key}`)}
                disabled={!area.area_key}
                className="text-left bg-bg2 border border-lborder rounded-xl p-4 hover:border-accent/50 transition-all disabled:opacity-50 disabled:cursor-default"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-muted">#{area.rank}</span>
                      <span className="text-xs text-muted">{area.difficulty && `난이도 ${area.difficulty}`}</span>
                    </div>
                    <p className="font-semibold text-sm text-[var(--text)]">{area.name}</p>
                    {area.frequency_per_round && (
                      <p className="text-xs text-muted mt-1">회차당 {area.frequency_per_round}</p>
                    )}
                  </div>
                  {area.study_weight != null && (
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-accent">{area.study_weight}%</div>
                      <div className="text-xs text-muted">학습 비중</div>
                    </div>
                  )}
                </div>
                {area.study_weight != null && (
                  <div className="mt-3 h-1 bg-bg3 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(area.study_weight * 4, 100)}%` }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {motto && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 text-center">
          <p className="text-sm font-bold text-accent">"{motto}"</p>
        </div>
      )}
    </div>
  )
}
