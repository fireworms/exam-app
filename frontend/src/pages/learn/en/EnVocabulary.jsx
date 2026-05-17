import { useEffect, useState } from "react"
import { useSubject } from "../SubjectContext"
import API from "../../../api"

const CAT_LABEL = {
  environment_climate:    "환경·기후",
  ai_digital:            "AI·디지털",
  administration_policy: "행정·정책",
  health_welfare:        "보건·복지",
  economy_labor:         "경제·노동",
  multi_meaning_words_for_passage_questions: "다의어",
}

function speak(word) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(word)
  u.lang = "en-US"
  window.speechSynthesis.speak(u)
}

function WordCard({ word, meaning, appeared_in, exam_synonym, common_meaning }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      onClick={() => setFlipped(f => !f)}
      style={{cursor:"pointer", perspective:1000}}
    >
      <div style={{
        position:"relative", height:140,
        transition:"transform 0.45s",
        transformStyle:"preserve-3d",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        {/* 앞면 */}
        <div style={{
          position:"absolute", inset:0,
          backfaceVisibility:"hidden",
          background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8,
          padding:16,
        }}>
          <p style={{fontSize:22, fontWeight:800, color:"var(--text)", letterSpacing:0.5}}>{word || meaning}</p>
          <button
            onClick={e => { e.stopPropagation(); speak(word || meaning) }}
            style={{
              background:"rgba(124,106,247,0.12)", border:"1px solid rgba(124,106,247,0.28)",
              borderRadius:20, padding:"4px 12px", fontSize:12, color:"var(--accent)",
              cursor:"pointer", fontFamily:"inherit",
            }}
          >
            🔊 발음
          </button>
          <p style={{fontSize:11, color:"var(--text2)"}}>탭하면 뜻 보기</p>
        </div>

        {/* 뒷면 */}
        <div style={{
          position:"absolute", inset:0,
          backfaceVisibility:"hidden",
          transform:"rotateY(180deg)",
          background:"rgba(124,106,247,0.07)", border:"1px solid rgba(124,106,247,0.28)", borderRadius:12,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6,
          padding:16, textAlign:"center",
        }}>
          <p style={{fontSize:18, fontWeight:700, color:"var(--text)"}}>{meaning || common_meaning}</p>
          {exam_synonym && (
            <p style={{fontSize:12, color:"var(--accent)"}}>= {exam_synonym}</p>
          )}
          {appeared_in && (
            <p style={{fontSize:11, color:"var(--text2)", marginTop:4}}>📚 {appeared_in}</p>
          )}
          <p style={{fontSize:11, color:"var(--text2)", opacity:0.6}}>탭하면 단어로</p>
        </div>
      </div>
    </div>
  )
}

export default function EnVocabulary() {
  const subject = useSubject()
  const [data, setData] = useState(null)
  const [activeCategory, setActiveCategory] = useState(null)

  useEffect(() => {
    setData(null)
    fetch(`${API}/api/learn/vocabulary?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setActiveCategory(Object.keys(d)[0] || null)
      })
  }, [subject])

  if (!data) return <div className="lp-empty">로딩 중...</div>

  const categories = Object.keys(data)
  const words = data[activeCategory] || []

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">어휘 학습</h1>
        <p className="lp-subtitle">{subject} · 시사 빈출 어휘 50선 · 카드를 클릭하면 뜻이 나와요</p>
      </div>

      {/* 카테고리 탭 */}
      <div>
        <p className="lp-section-label">분야 선택</p>
        <div className="lp-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`lp-tab-btn${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CAT_LABEL[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* 단어 카드 그리드 */}
      <div>
        <p className="lp-section-label">{CAT_LABEL[activeCategory] || activeCategory} — {words.length}개</p>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:12}}>
          {words.map((w, i) => (
            <WordCard key={i} {...w} />
          ))}
        </div>
      </div>
    </div>
  )
}
