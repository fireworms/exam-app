import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSubject } from "./SubjectContext"
import API from "../../api"

const TYPE_LABEL = { area: "영역", trap: "함정", grammar: "문법" }

export default function Bookmarks() {
  const subject = useSubject()
  const [bookmarks, setBookmarks] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API}/api/learn/bookmarks?subject=${encodeURIComponent(subject)}`)
      .then(r => r.json()).then(setBookmarks)
  }, [subject])

  const remove = async (id) => {
    await fetch(`${API}/api/learn/bookmarks/${id}`, { method: "DELETE" })
    setBookmarks(prev => prev.filter(b => b.id !== id))
  }

  const go = (b) => {
    if (b.type === "area") navigate(`/learn/areas/${b.key}`)
  }

  return (
    <div className="lp-page">
      <div>
        <h1 className="lp-title">북마크</h1>
        <p className="lp-subtitle">{subject} · 저장한 항목</p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="lp-empty">
          아직 북마크한 항목이 없어요.<br />
          영역 상세 페이지에서 ☆ 북마크 버튼을 눌러 저장해 보세요.
        </div>
      ) : (
        <div>
          <p className="lp-section-label">{bookmarks.length}개 저장됨</p>
          <div className="lp-list">
            {bookmarks.map(b => (
              <div key={b.id} className="lp-card" style={{display:"flex", alignItems:"center", gap:12}}>
                <span className="lp-badge lp-badge-muted" style={{flexShrink:0}}>
                  {TYPE_LABEL[b.type] || b.type}
                </span>
                <button
                  onClick={() => go(b)}
                  style={{
                    flex:1, textAlign:"left", fontSize:14, fontWeight:600,
                    color:"var(--text)", background:"none", border:"none",
                    cursor: b.type === "area" ? "pointer" : "default",
                    padding:0, fontFamily:"inherit",
                    transition:"color 0.15s",
                  }}
                  onMouseEnter={e => { if (b.type === "area") e.target.style.color = "var(--accent)" }}
                  onMouseLeave={e => { e.target.style.color = "var(--text)" }}
                >
                  {b.label || b.key}
                </button>
                <button
                  onClick={() => remove(b.id)}
                  style={{
                    flexShrink:0, background:"none", border:"none",
                    cursor:"pointer", fontSize:14, color:"var(--text2)",
                    padding:"4px 6px", borderRadius:6,
                    transition:"color 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--wrong)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text2)"}
                >
                  ✗
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
