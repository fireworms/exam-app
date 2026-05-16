import { useEffect, useState } from "react"
import { useSubject } from "./SubjectContext"
import API from "../../api"

function normalizeKey(key) { return key.replace(/_/g, " ") }

export default function ExamMapping() {
  const subject = useSubject()
  const [mapping, setMapping] = useState({})
  const [years, setYears] = useState([])
  const [regions, setRegions] = useState([])
  const [selectedYears, setSelectedYears] = useState([])
  const [selectedRegions, setSelectedRegions] = useState([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    setMapping({})
    fetch(`${API}/api/learn/exam-mapping?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(d => {
        const m = d.mapping || {}
        setMapping(m)
        // 연도·지역 동적 추출
        const ys = new Set(), rs = new Set()
        Object.values(m).forEach(roundMap => {
          Object.keys(roundMap).forEach(rk => {
            const [y, r] = rk.split("_")
            if (y) ys.add(Number(y))
            if (r) rs.add(r)
          })
        })
        setYears([...ys].sort())
        setRegions([...rs].sort())
        setSelectedYears([]); setSelectedRegions([])
      })
  }, [subject])

  const toggle = (arr, setArr, val) =>
    setArr(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const areaKeys = Object.keys(mapping).filter(k =>
    !query || normalizeKey(k).includes(query)
  )

  const getResults = (areaKey) => {
    return Object.entries(mapping[areaKey] || {})
      .filter(([rk]) => {
        const [y, r] = rk.split("_")
        if (selectedYears.length && !selectedYears.includes(Number(y))) return false
        if (selectedRegions.length && !selectedRegions.includes(r)) return false
        return true
      })
      .map(([rk, qnums]) => {
        const [year, region] = rk.split("_")
        return { rk, year, region, qnums }
      })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">회차 매핑</h1>
        <p className="text-muted text-sm mt-1">{subject} · 영역별 출제 회차 및 번호 확인</p>
      </div>

      <div className="bg-bg2 border border-lborder rounded-xl p-4 space-y-4">
        <input
          className="w-full bg-bg3 border border-lborder rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-accent/50 placeholder:text-muted"
          placeholder="영역 검색..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {years.length > 0 && (
          <div>
            <p className="text-xs text-muted mb-2 font-semibold">연도</p>
            <div className="flex gap-2 flex-wrap">
              {years.map(y => (
                <button key={y} onClick={() => toggle(selectedYears, setSelectedYears, y)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${selectedYears.includes(y) ? "bg-accent text-white" : "bg-bg3 text-muted hover:text-[var(--text)]"}`}>
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
        {regions.length > 0 && (
          <div>
            <p className="text-xs text-muted mb-2 font-semibold">시험 종류</p>
            <div className="flex gap-2 flex-wrap">
              {regions.map(r => (
                <button key={r} onClick={() => toggle(selectedRegions, setSelectedRegions, r)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${selectedRegions.includes(r) ? "bg-accent text-white" : "bg-bg3 text-muted hover:text-[var(--text)]"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {areaKeys.length === 0 && (
          <p className="text-muted text-sm text-center py-8">회차 매핑 데이터가 없어요.</p>
        )}
        {areaKeys.map(areaKey => {
          const results = getResults(areaKey)
          if (!results.length && (selectedYears.length || selectedRegions.length)) return null
          return (
            <div key={areaKey} className="bg-bg2 border border-lborder rounded-xl p-4">
              <p className="font-semibold text-sm text-[var(--text)] mb-3">{normalizeKey(areaKey)}</p>
              {results.length === 0 ? (
                <p className="text-xs text-muted">해당 필터에 결과 없음</p>
              ) : (
                <div className="space-y-2">
                  {results.map(({ rk, year, region, qnums }) => (
                    <div key={rk} className="flex items-center gap-3 text-xs">
                      <span className="text-muted w-24 shrink-0">{year} {region}</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {qnums.map(n => (
                          <span key={n} className="px-2 py-0.5 bg-accent/20 text-accent rounded font-semibold">{n}번</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
