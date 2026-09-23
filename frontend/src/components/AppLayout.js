import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  LayoutDashboard, Send, Users, Plug, ShieldCheck, LogOut,
  Mail, ChevronRight, CheckCircle2, AlertCircle,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/campaigns", label: "Campagnes", icon: Send },
  { to: "/contacts", label: "Contacten", icon: Users },
  { to: "/integrations", label: "Office 365", icon: Plug },
  { to: "/settings", label: "Beveiliging (MFA)", icon: ShieldCheck },
];

export default function AppLayout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mailbox, setMailbox] = useState(null);

  useEffect(() => {
    api.get("/mailbox").then((r) => setMailbox(r.data)).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#0F172A] text-slate-300 flex flex-col fixed h-screen sidebar-scroll overflow-y-auto">
        <div className="px-6 py-6 flex items-center gap-2.5 border-b border-slate-800">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-white text-[15px] leading-tight">Clara</div>
            <div className="text-[11px] text-slate-400 tracking-wide">Campaigns</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${to.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-[#1E293B] hover:text-white"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 space-y-3">
          <div className="rounded-lg bg-[#1E293B] p-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">Office 365</div>
            {mailbox?.connected ? (
              <div className="flex items-center gap-2 text-emerald-400 text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span className="truncate">{mailbox.email || "Verbonden"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-400 text-xs">
                <AlertCircle className="h-4 w-4" />
                <span>Niet verbonden</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-semibold text-sm">
              {(user?.name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{user?.name}</div>
              <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" /> MFA actief
              </div>
            </div>
            <button data-testid="logout-btn" onClick={logout} className="text-slate-400 hover:text-white transition-colors">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-64 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-slate-900 flex items-center gap-2">
            {title}
          </h1>
          <button
            data-testid="header-new-campaign"
            onClick={() => navigate("/campaigns/new")}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Send className="h-4 w-4" /> Nieuwe campagne
            <ChevronRight className="h-4 w-4" />
          </button>
        </header>
        <main className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
