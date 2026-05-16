import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSubject } from "./SubjectContext"
import API from "../../api"

export default function AreaList() {
  const subject = useSubject()
  const [areas, setAreas] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API}/api/learn/areas?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setAreas)
  }, [subject])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">영역별 학습</h1>
        <p className="text-muted text-sm mt-1">{subject} · 영역을 클릭하면 상세 내용을 볼 수 있어요</p>
      </div>

      <div className="flex flex-col gap-2">
        {areas.map((area, idx) => (
          <button
            key={area.key}
            onClick={() => navigate(`/learn/areas/${area.key}`)}
            className="flex items-center gap-4 bg-bg2 border border-lborder rounded-xl px-5 py-4 hover:border-accent/50 transition-all text-left group"
          >
            <span className="text-lg font-black text-accent/40 group-hover:text-accent w-8 shrink-0 text-center transition-colors">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--text)]">{area.name}</p>
              {area.position && <p className="text-xs text-muted mt-0.5">{area.position}</p>}
            </div>
            {area.viewed && (
              <span className="text-xs px-2 py-0.5 bg-success/20 text-success rounded-full shrink-0">열람</span>
            )}
            <span className="text-muted group-hover:text-accent transition-colors">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
