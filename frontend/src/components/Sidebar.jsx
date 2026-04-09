import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "./Avatar.jsx";

const ICON = {
  dashboard: "◆",
  employees: "◉",
  attendance: "◷",
  tasks: "◎",
  payroll: "◈",
  leaves: "☉",
  reviews: "★",
  chain: "⛓",
  settings: "⚙",
};

// `roles` controls visibility — absent means visible to everyone authenticated.
const NAV = [
  { to: "/", label: "Dashboard", key: "dashboard" },
  { to: "/employees", label: "Employees", key: "employees", roles: ["hr"] },
  { to: "/attendance", label: "Attendance", key: "attendance" },
  { to: "/tasks", label: "Tasks & Projects", key: "tasks" },
  { to: "/payroll", label: "Payroll", key: "payroll", roles: ["hr"] },
  { to: "/leaves", label: "Leave", key: "leaves" },
  { to: "/reviews", label: "Performance", key: "reviews" },
  { to: "/blockchain", label: "Blockchain Activity", key: "chain", roles: ["hr"] },
  { to: "/settings", label: "Settings", key: "settings" },
];

export default function Sidebar() {
  const { user, role } = useAuth();
  const visible = NAV.filter((n) => !n.roles || n.roles.includes(role));

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-ink-950/60 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div className="h-9 w-9 rounded-xl bg-grad-neon shadow-glow grid place-items-center font-bold text-white">
          E
        </div>
        <div className="leading-tight">
          <div className="text-white font-semibold">Employee Dashboard</div>
          <div className="text-[11px] text-slate-500 uppercase tracking-wider">
            {role === "hr" ? "HR Workspace" : "Employee Workspace"}
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
            }
          >
            <span className="text-base w-5 text-center">{ICON[item.key]}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="glass flex items-center gap-3 p-3">
          <Avatar address={user?.email || "user"} size={36} />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Signed in as
            </div>
            <div className="text-xs text-white truncate">
              {user?.email || "—"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
