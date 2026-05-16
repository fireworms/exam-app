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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">북마크</h1>
        <p className="text-muted text-sm mt-1">{subject} · 저장한 항목</p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">
          아직 북마크한 항목이 없어요.<br />
          영역 상세 페이지에서 ☆ 북마크 버튼을 눌러 저장해 보세요.
        </div>
      ) : (
        <div className="space-y-2">
          {bookmarks.map(b => (
            <div key={b.id} className="flex items-center gap-3 bg-bg2 border border-lborder rounded-xl px-5 py-4">
              <span className="text-xs px-2 py-0.5 bg-bg3 text-muted rounded-full shrink-0">
                {TYPE_LABEL[b.type] || b.type}
              </span>
              <button
                onClick={() => go(b)}
                className="flex-1 text-left text-sm font-semibold text-[var(--text)] hover:text-accent transition-colors"
              >
                {b.label || b.key}
              </button>
              <button onClick={() => remove(b.id)} className="text-muted hover:text-danger transition-colors text-sm shrink-0">
                ✗
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
