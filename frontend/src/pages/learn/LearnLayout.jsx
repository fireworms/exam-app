import { NavLink, Outlet } from "react-router-dom"
import { LEARN_SECTIONS } from "../../utils/areaKeyMap"

export default function LearnLayout() {
  return (
    <div className="flex min-h-screen bg-bg text-[var(--text)]">
      {/* 서브 사이드바 */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 bg-bg2 border-r border-lborder py-6 px-3 gap-1">
        <div className="px-3 mb-4">
          <p className="text-xs text-muted font-semibold tracking-widest uppercase">학습자료</p>
        </div>
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
      <div className="md:hidden fixed top-[52px] left-0 right-0 z-50 bg-bg2 border-b border-lborder overflow-x-auto">
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

      {/* 콘텐츠 */}
      <main className="flex-1 min-w-0 p-6 md:p-10 mt-0 md:mt-0 pb-20 md:pb-10 max-w-4xl">
        <Outlet />
      </main>
    </div>
  )
}
