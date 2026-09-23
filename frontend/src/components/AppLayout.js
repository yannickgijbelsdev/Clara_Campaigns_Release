import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import {
  LayoutDashboard, Send, Users, Plug, ShieldCheck, LogOut, ShieldAlert,
  CheckCircle2, AlertCircle, ChevronDown, Plus, Building2, Check, X,
} from "lucide-react";

const BASE_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/contacts", label: "Contacts" },
  { to: "/integrations", label: "Office 365" },
  { to: "/settings", label: "Security" },
];

function WorkspaceSwitcher() {
  const { companies, activeCompany, setActiveCompany, loadCompanies } = useAuth();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const current = companies.find((c) => c.id === activeCompany);

  const switchTo = (id) => {
    setActiveCompany(id);
    setOpen(false);
    window.location.reload();
  };

  const addCompany = async () => {
    if (!name.trim()) return;
    try {
      const { data } = await api.post("/companies", { name: name.trim() });
      await loadCompanies();
      toast.success("Company added");
      setName(""); setAdding(false);
      switchTo(data.id);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button data-testid="workspace-switcher" onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors max-w-[220px]">
        <span className="h-6 w-6 rounded-md bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
          {(current?.name || "W").slice(0, 1).toUpperCase()}
        </span>
        <span className="text-sm font-medium text-slate-800 truncate">{current?.name || "Workspace"}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/10 p-2 z-50">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium px-2 py-1.5">Workspaces</div>
            <div className="max-h-64 overflow-y-auto">
              {companies.map((c) => (
                <button key={c.id} data-testid={`workspace-${c.id}`} onClick={() => switchTo(c.id)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 text-left">
                  <span className="h-7 w-7 rounded-md bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center text-xs font-bold">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800 truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-400">{c.campaigns} campaigns · {c.contacts} contacts</div>
                  </div>
                  {c.id === activeCompany && <Check className="h-4 w-4 text-rose-600" />}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 mt-1 pt-1">
              {adding ? (
                <div className="flex items-center gap-2 p-1.5">
                  <input autoFocus data-testid="new-company-input" value={name} onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCompany()}
                    placeholder="Company name" className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-rose-500" />
                  <button data-testid="confirm-add-company" onClick={addCompany} className="p-1.5 bg-rose-600 text-white rounded-lg"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setAdding(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button data-testid="add-company-btn" onClick={() => setAdding(true)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-rose-50 text-rose-600 text-sm font-medium">
                  <Plus className="h-4 w-4" /> Add company
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppLayout({ children, title, subtitle, actions }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mailbox, setMailbox] = useState(null);

  useEffect(() => {
    document.title = title ? `Clara Campaigns | ${title}` : "Clara Campaigns";
  }, [title]);

  useEffect(() => {
    api.get("/mailbox").then((r) => setMailbox(r.data)).catch(() => {});
  }, []);

  const NAV = user?.role === "admin"
    ? [...BASE_NAV, { to: "/admin", label: "<" }]
    : BASE_NAV;

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} data-testid="brand-logo"><Logo /></button>
          <div className="h-6 w-px bg-slate-200" />
          <WorkspaceSwitcher />
          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          <nav className="hidden md:flex items-center gap-1 ml-1 flex-1">
            {NAV.map(({ to, label }) => {
              const active = location.pathname === to || location.pathname.startsWith(to + "/");
              return (
                <NavLink key={to} to={to} data-testid={`nav-${to.slice(1)}`}
                  className="relative flex items-center px-3.5 py-2 rounded-full text-sm font-medium transition-colors">
                  {active && (
                    <motion.span layoutId="nav-pill" className="absolute inset-0 bg-rose-600 rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                  )}
                  <span className={`relative z-10 ${active ? "text-white" : "text-slate-600"}`}>
                    {label}
                  </span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 ml-auto">
            <div className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              mailbox?.connected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
              {mailbox?.connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} O365
            </div>
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-semibold text-sm">
                {(user?.name || "U").slice(0, 1).toUpperCase()}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="text-sm text-slate-800 font-medium">{user?.name}</div>
                <div className="text-[11px] text-slate-400">{user?.role === "admin" ? "Administrator" : "Member"}</div>
              </div>
              <button data-testid="logout-btn" onClick={logout} title="Sign out"
                className="text-slate-400 hover:text-rose-600 transition-colors ml-1"><LogOut className="h-[18px] w-[18px]" /></button>
            </div>
          </div>
        </div>

        <nav className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `flex items-center px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${isActive ? "bg-rose-600 text-white" : "text-slate-600 bg-slate-100"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <motion.main key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }} className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {children}
      </motion.main>
    </div>
  );
}

export function PrimaryButton({ children, onClick, testid, icon: Icon, ...props }) {
  return (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      data-testid={testid} onClick={onClick} {...props}
      className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors disabled:opacity-60">
      {Icon && <Icon className="h-4 w-4" />}{children}
    </motion.button>
  );
}
