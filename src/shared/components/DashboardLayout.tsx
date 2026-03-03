import { useState, useCallback, type ReactNode, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Swords, Gamepad2, Users, GraduationCap, Shield,
  User, LogOut, Sun, Moon, PanelLeft, Menu,
} from "lucide-react";
import useUser from "@/shared/hooks/useUser";
import { useTheme } from "@/lib/theme-context";
import { useNavigationGuard } from "@/lib/navigation-guard-context";

const DARK_BLUE = "#084178";
const LIGHT_BLUE = "#10A5C3";
const faviconPng = "/favicon/android-chrome-512x512.png";

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user } = useUser();
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();
  const { tryNavigate } = useNavigationGuard();

  const mainLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/blitz-challenge", icon: Swords, label: "Blitz Challenge" },
    { to: "/play/solo", icon: Gamepad2, label: "Solo Blitz" },
    { to: "/profile", icon: User, label: "Profile" },
  ];

  const studentLinks = user && user.role !== "teacher" && user.role !== "admin"
    ? [{ to: "/classrooms", icon: Users, label: "Assignments" }]
    : [];

  const teacherLinks = user?.role === "teacher" || user?.role === "admin"
    ? [{ to: "/teacher", icon: GraduationCap, label: "Teacher Panel" }]
    : [];

  const adminLinks = user?.role === "admin"
    ? [{ to: "/admin/users", icon: Shield, label: "Admin" }]
    : [];

  const allLinks = [...mainLinks, ...studentLinks, ...teacherLinks, ...adminLinks];

  const guardedClick = (e: React.MouseEvent) => {
    if (!tryNavigate()) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <>
      {/* Overlay (mobile only) */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col border-r transition-transform duration-300
          bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Logo + collapse */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Link to="/dashboard" onClick={guardedClick} className="flex items-center gap-3 min-w-0">
            <img src={faviconPng} alt="" className="h-10 w-10 flex-shrink-0" />
            <span className="text-lg font-extrabold tracking-tight text-[#084178] dark:text-white whitespace-nowrap">
              The Spanish <span className="text-[#10A5C3]">Blitz</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100
              dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 transition-colors md:hidden"
            title="Close menu"
          >
            <PanelLeft size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allLinks.map((link) => {
            const isActive = location.pathname === link.to || location.pathname.startsWith(link.to + "/");
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={(e) => { if (!tryNavigate()) { e.preventDefault(); onClose(); return; } onClose(); }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${isActive
                    ? "text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                style={isActive ? { backgroundColor: DARK_BLUE } : undefined}
              >
                <link.icon size={20} className="flex-shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2 flex-shrink-0">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
              text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>

          {/* Logout */}
          <Link
            to="/account/logout"
            onClick={guardedClick}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium
              text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={20} />
            Logout
          </Link>

          {/* User info */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-2">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: LIGHT_BLUE }}
                >
                  {(user.display_name || user.email)?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {user.display_name || "Student"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role || "Student"}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — always offset on md+ */}
      <div className="md:ml-64 min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center h-14 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100
              dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <img src={faviconPng} alt="" className="h-8 w-8 flex-shrink-0" />
            <span className="text-sm font-extrabold tracking-tight text-[#084178] dark:text-white">
              The Spanish <span className="text-[#10A5C3]">Blitz</span>
            </span>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
