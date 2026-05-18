import { useState, useEffect } from "react"
import { NavLink, Outlet, Link } from "react-router-dom"
import { SubjectContext, SubjectTypeContext } from "./SubjectContext"
import { LEARN_SECTIONS, LEARN_SECTIONS_EN } from "../../utils/areaKeyMap"
import API from "../../api"
import "./learn.css"

export default function LearnLayout() {
  const [subject, setSubject] = useState(() => localStorage.getItem("learn_subject") || "국어")
  const [subjects, setSubjects] = useState([])

  useEffect(() => {
    fetch(`${API}/api/learn/subjects`)
      .then(r => r.json())
      .then(list => {
        setSubjects(list)
        const stored = localStorage.getItem("learn_subject")
        const match = list.find(s => s.subject === stored)
        if (match) {
          localStorage.setItem("learn_type", match.type)
        } else if (list.length > 0) {
          setSubject(list[0].subject)
          localStorage.setItem("learn_subject", list[0].subject)
          localStorage.setItem("learn_type", list[0].type)
        }
      })
      .catch(() => {})
  }, [])

  const handleSubjectChange = (value) => {
    const type = subjects.find(s => s.subject === value)?.type || "korean"
    setSubject(value)
    localStorage.setItem("learn_subject", value)
    localStorage.setItem("learn_type", type)
  }

  const currentType = subjects.length > 0
    ? (subjects.find(s => s.subject === subject)?.type || "korean")
    : (localStorage.getItem("learn_type") || "korean")
  const sections = currentType === "english" ? LEARN_SECTIONS_EN : LEARN_SECTIONS

  return (
    <SubjectTypeContext.Provider value={currentType}>
    <SubjectContext.Provider value={subject}>
      <div className="lr-root">

        {/* ── 상단 헤더 ── */}
        <header className="lr-header">
          <Link to="/" className="lr-logo">
            <span className="lr-logo-icon">合</span>
            <span className="lr-logo-name">공시문제집</span>
          </Link>
          <div className="lr-sep" />
          <span className="lr-section-name">학습자료</span>
          <div className="lr-spacer" />
          <Link to="/" className="lr-btn-ghost">⌂ 홈으로</Link>
        </header>

        {/* ── 바디 ── */}
        <div className="lr-body">

          {/* 데스크탑 사이드바 */}
          <aside className="lr-sidebar">
            <div className="lr-subject-box">
              <p className="lr-subject-label">과목</p>
              <select
                value={subject}
                onChange={e => handleSubjectChange(e.target.value)}
                className="lr-select"
              >
                {subjects.length === 0
                  ? <option value="국어">국어</option>
                  : subjects.map(s => (
                      <option key={s.subject} value={s.subject}>{s.subject}</option>
                    ))
                }
              </select>
            </div>

            <div className="lr-divider" />

            {sections.map(({ path, label, icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/learn"}
                className={({ isActive }) => `lr-nav-item${isActive ? " active" : ""}`}
              >
                <span className="lr-nav-icon">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </aside>

          {/* 모바일 서브 탭 */}
          <div className="lr-mobile-tabs">
            <div className="lr-mobile-subject-row">
              <select
                value={subject}
                onChange={e => handleSubjectChange(e.target.value)}
                className="lr-select-sm"
              >
                {subjects.length === 0
                  ? <option value="국어">국어</option>
                  : subjects.map(s => (
                      <option key={s.subject} value={s.subject}>{s.subject}</option>
                    ))
                }
              </select>
            </div>
            <div className="lr-mobile-nav">
              {sections.map(({ path, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === "/learn"}
                  className={({ isActive }) => `lr-tab${isActive ? " active" : ""}`}
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* 콘텐츠 */}
          <main className="lr-content">
            <Outlet />
          </main>
        </div>

        <style>{`
          /* ── 루트 ── */
          .lr-root {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: var(--bg);
            color: var(--text);
          }

          /* ── 헤더 ── */
          .lr-header {
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 52px;
            background: var(--bg2);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            padding: 0 20px;
            gap: 12px;
            z-index: 100;
          }
          .lr-logo {
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
          }
          .lr-logo-icon {
            font-size: 22px;
            color: var(--accent);
            line-height: 1;
          }
          .lr-logo-name {
            font-size: 14px;
            font-weight: 700;
            color: var(--text);
          }
          .lr-sep {
            width: 1px;
            height: 16px;
            background: var(--border);
          }
          .lr-section-name {
            font-size: 13px;
            font-weight: 600;
            color: var(--accent);
          }
          .lr-spacer { flex: 1; }
          .lr-btn-primary {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 6px 14px;
            background: var(--accent);
            color: #fff;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
            transition: opacity 0.15s;
            white-space: nowrap;
          }
          .lr-btn-primary:hover { opacity: 0.82; }
          .lr-btn-ghost {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 6px 14px;
            background: var(--bg3);
            border: 1px solid var(--border);
            color: var(--text2);
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            text-decoration: none;
            transition: color 0.15s;
            white-space: nowrap;
          }
          .lr-btn-ghost:hover { color: var(--text); }

          /* ── 바디 ── */
          .lr-body {
            display: flex;
            flex: 1;
            padding-top: 52px;
          }

          /* ── 사이드바 ── */
          .lr-sidebar {
            position: fixed;
            top: 52px; bottom: 0; left: 0;
            width: 200px;
            background: var(--bg2);
            border-right: 1px solid var(--border);
            padding: 20px 10px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            overflow-y: auto;
          }
          .lr-subject-box {
            padding: 0 4px;
            margin-bottom: 16px;
          }
          .lr-subject-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--text2);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 7px;
          }
          .lr-select {
            width: 100%;
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 13px;
            color: var(--text);
            font-family: inherit;
            outline: none;
            cursor: pointer;
          }
          .lr-divider {
            height: 1px;
            background: var(--border);
            margin: 2px 0 10px;
          }
          .lr-nav-item {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 8px 10px;
            border-radius: 8px;
            font-size: 13px;
            color: var(--text2);
            text-decoration: none;
            transition: background 0.12s, color 0.12s;
          }
          .lr-nav-item:hover {
            background: var(--bg3);
            color: var(--text);
          }
          .lr-nav-item.active {
            background: var(--accent);
            color: #fff;
            font-weight: 600;
          }
          .lr-nav-icon {
            width: 18px;
            text-align: center;
            font-size: 14px;
          }

          /* ── 모바일 탭 (데스크탑에서 숨김) ── */
          .lr-mobile-tabs { display: none; }

          /* ── 콘텐츠 ── */
          .lr-content {
            flex: 1;
            margin-left: 200px;
            padding: 40px 48px;
            min-width: 0;
          }

          /* ── 모바일 ── */
          @media (max-width: 768px) {
            .lr-sidebar { display: none; }

            .lr-mobile-tabs {
              display: block;
              position: fixed;
              top: 52px; left: 0; right: 0;
              z-index: 90;
              background: var(--bg2);
              border-bottom: 1px solid var(--border);
            }
            .lr-mobile-subject-row {
              padding: 8px 14px 6px;
            }
            .lr-select-sm {
              background: var(--bg3);
              border: 1px solid var(--border);
              border-radius: 6px;
              padding: 5px 10px;
              font-size: 12px;
              color: var(--text);
              font-family: inherit;
              outline: none;
              cursor: pointer;
            }
            .lr-mobile-nav {
              display: flex;
              gap: 4px;
              padding: 0 14px 8px;
              overflow-x: auto;
              scrollbar-width: none;
            }
            .lr-mobile-nav::-webkit-scrollbar { display: none; }
            .lr-tab {
              flex-shrink: 0;
              padding: 5px 12px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              color: var(--text2);
              text-decoration: none;
              white-space: nowrap;
              transition: all 0.12s;
            }
            .lr-tab.active {
              background: var(--accent);
              color: #fff;
              font-weight: 600;
            }
            .lr-tab:not(.active):hover { color: var(--text); }

            .lr-content {
              margin-left: 0;
              padding: 16px 16px 48px;
              padding-top: 120px; /* 52px 헤더 + 68px 모바일 탭 */
            }
          }
        `}</style>
      </div>
    </SubjectContext.Provider>
    </SubjectTypeContext.Provider>
  )
}
