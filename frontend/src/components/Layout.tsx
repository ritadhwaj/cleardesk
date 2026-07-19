import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, FilePlus2, ClipboardCheck, Activity, LogOut } from "lucide-react";
import { useAuth } from "../store/auth";
import ThemeToggle from "./ThemeToggle";
import OfficeScene from "./OfficeScene";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/cases/new", label: "New Case", icon: FilePlus2 },
  { to: "/review", label: "Review Queue", icon: ClipboardCheck },
  { to: "/activity", label: "My Activity", icon: Activity },
];

/** App shell: sticky glassy navbar + content area. */
export default function Layout() {
  const { role, fullName, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col relative">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80
                         border-b border-slate-200/70 dark:border-slate-800/70
                         transition-colors duration-500">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-white dark:bg-white
                             dark:text-slate-900 flex items-center justify-center
                             transition-colors duration-500">
              <ShieldCheck size={20} />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              ClearDesk
            </span>
            <span className="hidden md:inline text-[11px] font-medium text-slate-400 mt-0.5">
              Document Verification Desk
            </span>
          </button>

          <nav className="flex items-center gap-1">
            {links
              .filter((l) => l.to !== "/review" || role === "reviewer" || role === "admin")
              .map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all
                     ${isActive
                       ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                       : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden md:flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fullName}</span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400">{role}</span>
            </div>
            <button onClick={logout} title="Sign out"
                    className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700
                               text-slate-500 dark:text-slate-400
                               hover:bg-slate-100 dark:hover:bg-slate-800
                               hover:text-slate-700 dark:hover:text-slate-200
                               transition-colors flex items-center justify-center">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* office scene sidebar: quarter of the screen, sticky while content scrolls */}
        <aside className="hidden xl:block w-1/4 max-w-[380px] relative shrink-0
                          border-r border-slate-200/70 dark:border-slate-800/70
                          transition-colors duration-700">
          <div className="sticky top-16 h-[calc(100vh-4rem)]">
            <OfficeScene />
          </div>
        </aside>

        <main className="flex-1 min-w-0 animate-fade-in relative z-10">
          <Outlet />
        </main>
      </div>

      <footer className="relative z-10 border-t border-slate-200/70 dark:border-slate-800/70 py-4 transition-colors duration-500">
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          ClearDesk · AI reads the pages, humans make the decisions · Demo build
        </p>
      </footer>
    </div>
  );
}
