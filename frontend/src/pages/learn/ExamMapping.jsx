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
        const m = d.mapping || d || {}
        setMapping(m)
        const ys = new Set(), rs = new Set()
        Object.values(m).forEach(roundMap => {
          if (typeof roundMap !== "object") return
          Object.keys(roundMap).forEach(rk => {
            const parts = rk.split("_")
            const y = parts[0], r = parts.slice(1).join("_")
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
    const roundMap = mapping[areaKey]
    if (!roundMap || typeof roundMap !== "object") return []
    return Object.entries(roundMap)
      .filter(([rk]) => {
        const parts = rk.split("_")
        const y = Number(parts[0]), r = parts.slice(1).join("_")
        if (selectedYears.length && !selectedYears.includes(y)) return false
        if (selectedRegions.length && !selectedRegions.includes(r)) return false
        return true
      })
      .map(([rk, qnums]) => {
        const parts = rk.split("_")
        return { rk, year: parts[0], region: parts.slice(1).join(" "), qnums }
      })
  }

  const hasAnyData = areaKeys.length > 0

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">회차 매핑</h1>
        <p className="lp-subtitle">{subject} · 영역별 출제 회차 및 번호 확인</p>
      </div>

      {/* 필터 */}
      <div>
        <p className="lp-section-label">필터</p>
        <div style={{display:"flex", flexDirection:"column", gap:14}}>
          <input
            className="lp-input"
            placeholder="영역 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {years.length > 0 && (
            <div>
              <p style={{fontSize:12, fontWeight:600, color:"var(--text2)", marginBottom:8}}>연도</p>
              <div className="lp-chips">
                {years.map(y => (
                  <button key={y} className={`lp-chip${selectedYears.includes(y) ? " active" : ""}`}
                    onClick={() => toggle(selectedYears, setSelectedYears, y)}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}
          {regions.length > 0 && (
            <div>
              <p style={{fontSize:12, fontWeight:600, color:"var(--text2)", marginBottom:8}}>시험 종류</p>
              <div className="lp-chips">
                {regions.map(r => (
                  <button key={r} className={`lp-chip${selectedRegions.includes(r) ? " active" : ""}`}
                    onClick={() => toggle(selectedRegions, setSelectedRegions, r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 결과 */}
      {!hasAnyData && <div className="lp-empty">회차 매핑 데이터가 없어요.</div>}

      {hasAnyData && (
        <div>
          <p className="lp-section-label">영역별 출제 현황</p>
          <div className="lp-list">
            {areaKeys.map(areaKey => {
              const results = getResults(areaKey)
              if (!results.length && (selectedYears.length || selectedRegions.length)) return null
              return (
                <div key={areaKey} className="lp-card">
                  <p style={{fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:12}}>{normalizeKey(areaKey)}</p>
                  {results.length === 0 ? (
                    <p className="lp-muted" style={{fontSize:12}}>해당 필터에 결과 없음</p>
                  ) : (
                    <div style={{display:"flex", flexDirection:"column", gap:8}}>
                      {results.map(({ rk, year, region, qnums }) => (
                        <div key={rk} style={{display:"flex", alignItems:"center", gap:12}}>
                          <span className="lp-muted" style={{fontSize:12, minWidth:80, flexShrink:0}}>{year} {region}</span>
                          <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
                            {qnums.map(n => (
                              <span key={n} className="lp-badge lp-badge-accent">{n}번</span>
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
      )}
    </div>
  )
}
