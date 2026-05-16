import { useEffect, useState } from "react"
import API from "../../api"

const YEARS = [2022, 2023, 2024, 2025, 2026]
const REGIONS = ["국가직", "지방직"]

function normalizeKey(key) {
  return key.replace(/_/g, " ")
}

export default function ExamMapping() {
  const [mapping, setMapping] = useState({})
  const [selectedAreas, setSelectedAreas] = useState([])
  const [selectedYears, setSelectedYears] = useState([])
  const [selectedRegions, setSelectedRegions] = useState([])
  const [query, setQuery] = useState("")

  useEffect(() => {
    fetch(`${API}/api/learn/exam-mapping`).then(r => r.json()).then(d => {
      setMapping(d.mapping || {})
    })
  }, [])

  const areaKeys = Object.keys(mapping)

  const toggleArea = key => setSelectedAreas(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
  )
  const toggleYear = y => setSelectedYears(prev =>
    prev.includes(y) ? prev.filter(v => v !== y) : [...prev, y]
  )
  const toggleRegion = r => setSelectedRegions(prev =>
    prev.includes(r) ? prev.filter(v => v !== r) : [...prev, r]
  )

  const filteredAreas = areaKeys.filter(k =>
    (!query || normalizeKey(k).includes(query)) &&
    (!selectedAreas.length || selectedAreas.includes(k))
  )

  const getResults = (areaKey) => {
    const areaData = mapping[areaKey] || {}
    const results = []
    Object.entries(areaData).forEach(([roundKey, qnums]) => {
      const [year, region] = roundKey.split("_")
      if (selectedYears.length && !selectedYears.includes(Number(year))) return
      if (selectedRegions.length && !selectedRegions.includes(region)) return
      results.push({ roundKey, year, region, qnums })
    })
    return results
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">회차 매핑</h1>
        <p className="text-muted text-sm mt-1">영역별로 어느 회차 어느 번호에 출제됐는지 확인</p>
      </div>

      {/* 필터 */}
      <div className="bg-bg2 border border-lborder rounded-xl p-4 space-y-4">
        <input
          className="w-full bg-bg3 border border-lborder rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-accent/50 placeholder:text-muted"
          placeholder="영역 검색..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div>
          <p className="text-xs text-muted mb-2 font-semibold">연도</p>
          <div className="flex gap-2 flex-wrap">
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => toggleYear(y)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedYears.includes(y) ? "bg-accent text-white" : "bg-bg3 text-muted hover:text-[var(--text)]"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-2 font-semibold">시험 종류</p>
          <div className="flex gap-2">
            {REGIONS.map(r => (
              <button
                key={r}
                onClick={() => toggleRegion(r)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedRegions.includes(r) ? "bg-accent text-white" : "bg-bg3 text-muted hover:text-[var(--text)]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 결과 */}
      <div className="space-y-3">
        {filteredAreas.map(areaKey => {
          const results = getResults(areaKey)
          if (!results.length && (selectedYears.length || selectedRegions.length)) return null
          return (
            <div key={areaKey} className="bg-bg2 border border-lborder rounded-xl p-4">
              <p className="font-semibold text-sm text-[var(--text)] mb-3">{normalizeKey(areaKey)}</p>
              {results.length === 0 ? (
                <p className="text-xs text-muted">해당 필터에 결과 없음</p>
              ) : (
                <div className="space-y-2">
                  {results.map(({ roundKey, year, region, qnums }) => (
                    <div key={roundKey} className="flex items-center gap-3 text-xs">
                      <span className="text-muted w-24 shrink-0">{year} {region}</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {qnums.map(n => (
                          <span key={n} className="px-2 py-0.5 bg-accent/20 text-accent rounded font-semibold">
                            {n}번
                          </span>
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
