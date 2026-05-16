import { useState, useEffect } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { SubjectContext } from "./SubjectContext"
import { LEARN_SECTIONS } from "../../utils/areaKeyMap"
import API from "../../api"

export default function LearnLayout() {
  const [subject, setSubject] = useState("국어")
  const [subjects, setSubjects] = useState([])

  useEffect(() => {
    fetch(`${API}/api/learn/subjects`)
      .then(r => r.json())
      .then(setSubjects)
      .catch(() => {})
  }, [])

  return (
    <SubjectContext.Provider value={subject}>
      <div className="flex min-h-screen bg-bg text-[var(--text)]">
        {/* 서브 사이드바 */}
        <aside className="hidden md:flex flex-col w-52 shrink-0 bg-bg2 border-r border-lborder py-6 px-3 gap-1">
          {/* 과목 선택 */}
          <div className="px-1 mb-4">
            <p className="text-xs text-muted font-semibold tracking-widest uppercase mb-2">과목</p>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-bg3 border border-lborder rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-accent/50 cursor-pointer"
            >
              {subjects.length === 0 ? (
                <option value="국어">국어</option>
              ) : (
                subjects.map(s => (
                  <option key={s.subject} value={s.subject}>{s.subject}</option>
                ))
              )}
            </select>
          </div>

          <div className="border-t border-lborder mb-3" />

          {LEARN_SECTIONS.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/learn"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-accent text-white font-semibold"
                    : "text-muted hover:bg-bg3 hover:text-[var(--text)]"
                }`
              }
            >
              <span className="text-base w-5 text-center">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </aside>

        {/* 모바일 상단 탭 */}
        <div className="md:hidden fixed top-[52px] left-0 right-0 z-50 bg-bg2 border-b border-lborder">
          {/* 과목 선택 */}
          <div className="flex items-center gap-2 px-3 pt-2 pb-1">
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="bg-bg3 border border-lborder rounded-lg px-2 py-1 text-xs text-[var(--text)] outline-none"
            >
              {subjects.length === 0 ? (
                <option value="국어">국어</option>
              ) : (
                subjects.map(s => (
                  <option key={s.subject} value={s.subject}>{s.subject}</option>
                ))
              )}
            </select>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-1 px-3 py-2 min-w-max">
              {LEARN_SECTIONS.map(({ path, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === "/learn"}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                      isActive ? "bg-accent text-white" : "text-muted hover:text-[var(--text)]"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>

        {/* 콘텐츠 */}
        <main className="flex-1 min-w-0 p-6 md:p-10 pb-20 md:pb-10 max-w-4xl">
          <Outlet />
        </main>
      </div>
    </SubjectContext.Provider>
  )
}
