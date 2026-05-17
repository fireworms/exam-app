import { useEffect, useState } from "react"
import { useSubject } from "../SubjectContext"
import API from "../../../api"

const CAT_LABEL = {
  email_openings:       "이메일 시작",
  email_body:           "이메일 본문",
  email_closings:       "이메일 마무리",
  meeting_negotiation:  "회의·협의",
  government_policy:    "정부·정책",
}

const CAT_ICON = {
  email_openings:      "📧",
  email_body:          "📝",
  email_closings:      "✅",
  meeting_negotiation: "🤝",
  government_policy:   "🏛️",
}

function PhraseCard({ phrase, korean }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard?.writeText(phrase).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="lp-card" style={{display:"flex", flexDirection:"column", gap:8}}>
      <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8}}>
        <p style={{fontSize:13, color:"var(--text)", fontStyle:"italic", lineHeight:1.6, flex:1}}>{phrase}</p>
        <button
          onClick={copy}
          style={{
            flexShrink:0, fontSize:11, padding:"3px 8px",
            background:"var(--bg3)", border:"1px solid var(--border)",
            borderRadius:6, cursor:"pointer", color:"var(--text2)",
            fontFamily:"inherit", transition:"all 0.15s",
          }}
        >
          {copied ? "✓" : "복사"}
        </button>
      </div>
      <p style={{fontSize:12, color:"var(--text2)", paddingTop:6, borderTop:"1px solid var(--border)"}}>{korean}</p>
    </div>
  )
}

export default function EnBusiness() {
  const subject = useSubject()
  const [data, setData] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)

  useEffect(() => {
    setData(null)
    fetch(`${API}/api/learn/business-english?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(d => { setData(d); setActiveCategory(Object.keys(d)[0] || null) })
  }, [subject])

  if (!data) return <div className="lp-empty">로딩 중...</div>

  const categories = Object.keys(data)
  const phrases = data[activeCategory] || []

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">실무 영어</h1>
        <p className="lp-subtitle">{subject} · 이메일·회의·행정 표현 · 복사 버튼으로 바로 활용</p>
      </div>

      {/* 카테고리 탭 */}
      <div>
        <p className="lp-section-label">카테고리 선택</p>
        <div className="lp-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`lp-tab-btn${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CAT_ICON[cat]} {CAT_LABEL[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* 표현 카드 목록 */}
      <div>
        <p className="lp-section-label">
          {CAT_ICON[activeCategory]} {CAT_LABEL[activeCategory] || activeCategory} — {phrases.length}개 표현
        </p>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {phrases.map((item, i) => (
            <PhraseCard key={i} phrase={item.phrase} korean={item.korean} />
          ))}
        </div>
      </div>
    </div>
  )
}
