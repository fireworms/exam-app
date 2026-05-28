import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const links = [
  { to: '/', label: '홈', icon: '⌂', end: true },
  { to: '/wrong-notes', label: '오답노트', icon: '✗' },
  { to: '/scraps', label: '스크랩', icon: '★' },
  { to: '/stats', label: '통계', icon: '📊' },
  { to: '/settings', label: '설정', icon: '⚙' },
  { to: '/admin', label: '관리자', icon: '🔐' },
]

export default function Layout() {
  const navigate = useNavigate()
  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem('exam_user')
    navigate('/login')
  }

  return (
    <div className="layout">
      {/* 데스크탑 사이드바 */}
      <nav className="sidebar">
        <div className="logo">
          <span className="logo-icon">合</span>
          <span className="logo-text">공시문제집</span>
        </div>
        <ul className="nav-links">
          {links.map(({ to, label, icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{icon}</span>
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <button onClick={logout} style={{marginTop:'auto',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text2)',cursor:'pointer',fontSize:13}}>로그아웃</button>
      </nav>

      {/* 모바일 상단 헤더 */}
      <header className="mobile-header">
        <span className="logo-icon">合</span>
        <span className="logo-text">공시문제집</span>
      </header>

      <main className="content">
        <Outlet />
      </main>

      {/* 모바일 하단 탭바 */}
      <nav className="tab-bar">
        {links.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}
          >
            <span className="tab-icon">{icon}</span>
            <span className="tab-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <style>{`
        /* ── 공통 ── */
        .layout {
          display: flex;
          min-height: 100vh;
        }

        /* ── 데스크탑 사이드바 ── */
        .sidebar {
          width: 220px;
          background: var(--bg2);
          border-right: 1px solid var(--border);
          padding: 28px 16px;
          display: flex;
          flex-direction: column;
          gap: 32px;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 100;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 8px;
        }
        .logo-icon {
          font-size: 28px;
          color: var(--accent);
        }
        .logo-text {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.3px;
        }
        .nav-links {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          color: var(--text2);
          transition: all 0.15s;
        }
        .nav-link:hover {
          background: var(--bg3);
          color: var(--text);
        }
        .nav-link.active {
          background: var(--accent);
          color: white;
        }
        .nav-icon {
          font-size: 16px;
          width: 20px;
          text-align: center;
        }

        /* ── 컨텐츠 영역 ── */
        .content {
          margin-left: 220px;
          flex: 1;
          padding: 40px;
          max-width: 860px;
        }

        /* ── 모바일 전용 (기본 숨김) ── */
        .mobile-header {
          display: none;
        }
        .tab-bar {
          display: none;
        }

        /* ── 모바일 미디어쿼리 ── */
        @media (max-width: 768px) {
          .sidebar {
            display: none;
          }

          .mobile-header {
            display: flex;
            align-items: center;
            gap: 8px;
            position: fixed;
            top: 0; left: 0; right: 0;
            height: 52px;
            background: var(--bg2);
            border-bottom: 1px solid var(--border);
            padding: 0 16px;
            z-index: 100;
          }
          .mobile-header .logo-icon {
            font-size: 22px;
            color: var(--accent);
          }
          .mobile-header .logo-text {
            font-size: 15px;
            font-weight: 700;
          }

          .content {
            margin-left: 0;
            padding: 16px 16px 80px;
            margin-top: 52px;
            max-width: 100%;
          }

          .tab-bar {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 60px;
            background: var(--bg2);
            border-top: 1px solid var(--border);
            z-index: 100;
          }
          .tab-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            color: var(--text2);
            transition: color 0.15s;
            font-size: 10px;
          }
          .tab-item.active {
            color: var(--accent);
          }
          .tab-icon {
            font-size: 18px;
            line-height: 1;
          }
          .tab-label {
            font-size: 10px;
            font-weight: 500;
          }
        }
      `}</style>
    </div>
  )
}
