import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";
import GlobalSearch from "@/components/GlobalSearch";
import Onboarding from "@/components/Onboarding";
import { ProgressOverlay } from "@/components/ProgressOverlay";
import { startTour } from "@/lib/useTour";
import { toast } from "sonner";
import {
  LogOut, AlertCircle, ChevronDown, Plus, Check, X, Globe, Gem, Lock, Search, ShieldCheck, HelpCircle, ExternalLink,
} from "lucide-react";

export const avatarUrl = (u) =>
  u?.avatar_url ? `${u.avatar_url}?v=${u.avatar_version || 0}` : null;

const BASE_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/contacts", label: "Contacts" },
  { to: "/branding", label: "Branding" },
  { to: "/developers", label: "API" },
  { to: "/integrations", label: "E-mail / SMTP" },
];

function WorkspaceSwitcher() {
  const { companies, activeCompany, setActiveCompany, loadCompanies } = useAuth();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [switching, setSwitching] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const current = companies.find((c) => c.id === activeCompany);

  const switchTo = (id) => {
    if (id === activeCompany) { setOpen(false); return; }
    setActiveCompany(id);
    setOpen(false);
    setSwitching(true);
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
      <ProgressOverlay open={switching} title="Switching workspace"
        subtitle={`Loading ${current?.name || "your workspace"}…`}
        steps={["Loading campaigns", "Loading contacts", "Refreshing dashboard"]}
        stepMs={500} onComplete={() => window.location.reload()} />
      <button data-testid="workspace-switcher" onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-2.5 pr-2.5 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors max-w-[220px]">
        <Globe className="h-4 w-4 text-slate-400 shrink-0" />
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

function BrandMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button data-testid="brand-menu-btn" onClick={() => setOpen(!open)}
        className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 clara-trans">
        <ChevronDown className={`h-4 w-4 clara-trans ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 w-52 bg-white rounded-2xl clara-soft shadow-xl shadow-slate-900/10 p-2 z-50">
            <a href="https://clr.koodh.com" target="_blank" rel="noopener noreferrer" data-testid="brand-menu-koodh-clara"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left text-sm text-slate-700 clara-trans">
              <img src="/favicon-32.png" alt="" className="h-5 w-5 object-contain" />
              <span className="flex-1">Koodh Clara</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const av = avatarUrl(user);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const Avatar = ({ size = "h-9 w-9" }) => av ? (
    <img src={av} alt="" className={`${size} rounded-full object-cover shadow-sm`} />
  ) : (
    <div className={`${size} rounded-full bg-rose-50 overflow-hidden shadow-sm flex items-end justify-center`}>
      <img src="/koodh-avatar.png" alt="koodh" className="h-full w-full object-cover object-top scale-110" draggable="false" />
    </div>
  );

  return (
    <div className="relative" ref={ref}>
      <button data-testid="user-menu-btn" onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full pr-1.5 hover:bg-slate-100/70 clara-trans py-1 pl-1">
        <Avatar />
        <ChevronDown className={`h-4 w-4 text-slate-400 clara-trans ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 bg-white rounded-2xl clara-soft shadow-xl shadow-slate-900/10 p-2 z-50">
            <div className="flex items-center gap-3 px-2 py-2.5">
              <Avatar size="h-10 w-10" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{user?.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              </div>
            </div>
            <div className="border-t border-slate-100 my-1" />
            <button data-testid="menu-account" onClick={() => { setOpen(false); navigate("/settings"); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left text-sm text-slate-700 clara-trans">
              <ShieldCheck className="h-4 w-4 text-slate-400" /> Account &amp; Security
            </button>
            <button data-testid="menu-plans" onClick={() => { setOpen(false); navigate("/plans"); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-slate-50 text-left text-sm text-slate-700 clara-trans">
              <Gem className="h-4 w-4 text-slate-400" /> Plans &amp; billing
            </button>
            <button data-testid="logout-btn" onClick={logout}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-rose-50 text-left text-sm text-rose-600 clara-trans">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
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
  const [smtp, setSmtp] = useState(null);
  const [apiCfg, setApiCfg] = useState(null);
  const [branding, setBranding] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.title = title ? `Clara Campaigns | ${title}` : "Clara Campaigns";
  }, [title]);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (!user) return;
    const onboardingOpen = user.role !== "admin" && user.onboarded !== true;
    if (onboardingOpen) return;
    if (localStorage.getItem("clara_tour_seen")) return;
    const t = setTimeout(() => {
      const started = startTour(location.pathname);
      if (started) localStorage.setItem("clara_tour_seen", "1");
    }, 900);
    return () => clearTimeout(t);
  }, [user, location.pathname]);

  useEffect(() => {
    api.get("/company/smtp").then((r) => setSmtp(r.data)).catch(() => {});
    api.get("/subscribe/settings").then((r) => setApiCfg(r.data)).catch(() => {});
    api.get("/company/branding").then((r) => setBranding(r.data)).catch(() => {});
  }, []);

  // A menu item shows a check when that area is correctly configured.
  const setupOk = {
    "/branding": !!branding?.has_logo,
    "/developers": !!(apiCfg?.connected || apiCfg?.website),
    "/integrations": !!smtp?.configured,
  };

  const NAV = user?.role === "admin"
    ? [...BASE_NAV, { to: "/admin", label: "Administration" }]
    : BASE_NAV;

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {user && user.role !== "admin" && user.onboarded !== true && <Onboarding />}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <header className="sticky top-0 z-30 bg-[#F5F6F8]/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <button onClick={() => navigate("/dashboard")} data-testid="brand-logo"><Logo /></button>
            <div className="hidden sm:block h-5 w-px bg-slate-200/70" />
            <span className="hidden sm:block font-display font-semibold text-slate-900 text-[15px] whitespace-nowrap">Clara Campaigns</span>
            <BrandMenu />
          </div>
          <div className="hidden xl:flex items-center gap-1.5 mr-1">
            <button onClick={() => navigate("/plans")} className="relative group" data-testid="plan-chip">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600 clara-trans hover:bg-amber-100">
                <Gem className="h-[17px] w-[17px]" />
              </span>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs px-2.5 py-1 opacity-0 group-hover:opacity-100 clara-trans capitalize z-50">
                {(user?.license?.plan || "free")} plan · manage
              </span>
            </button>
            <div className="relative group">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white clara-trans hover:bg-slate-800 cursor-default">
                <Lock className="h-4 w-4" />
              </span>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-lg bg-slate-900 text-white text-xs px-2.5 py-1 opacity-0 group-hover:opacity-100 clara-trans z-50">
                Two-factor active
              </span>
            </div>
          </div>
          <WorkspaceSwitcher />

          <nav className="hidden xl:flex items-center gap-0.5 ml-3 flex-1">
            {NAV.map(({ to, label }) => {
              const active = location.pathname === to || location.pathname.startsWith(to + "/");
              return (
                <NavLink key={to} to={to} data-testid={`nav-${to.slice(1)}`}
                  className="relative flex items-center px-3.5 py-2 rounded-full text-sm font-medium clara-trans hover:text-slate-900 whitespace-nowrap">
                  {active && (
                    <motion.span layoutId="nav-pill" className="absolute inset-0 bg-slate-900 rounded-full shadow-lg shadow-slate-900/25"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }} />
                  )}
                  <span className={`relative z-10 whitespace-nowrap flex items-center gap-1.5 ${active ? "text-white" : "text-slate-500"}`}>
                    {label}
                    {setupOk[to] && (
                      <span data-testid={`nav-check-${to.slice(1)}`} className="flex items-center justify-center">
                        <Check className={`h-3.5 w-3.5 ${active ? "text-white/80" : "text-[#7380b6]/70"}`} strokeWidth={2.5} />
                      </span>
                    )}
                  </span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 ml-auto">
            <button data-testid="global-search-btn" onClick={() => setSearchOpen(true)} title="Search (⌘K)"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 clara-trans">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button data-testid="help-tour-btn" onClick={() => { if (!startTour(location.pathname)) toast.info("No tour for this page yet."); }} title="Help & tour"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 clara-trans">
              <HelpCircle className="h-[19px] w-[19px]" />
            </button>
            <div className="pl-3 border-l border-slate-200/60">
              <UserMenu />
            </div>
          </div>
        </div>

        <nav className="xl:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${isActive ? "bg-slate-900 text-white" : "text-slate-600 bg-slate-100"}`}>
              {label}
              {setupOk[to] && (
                <span className="flex items-center justify-center">
                  <Check className="h-3 w-3 text-[#7380b6]/70" strokeWidth={2.5} />
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      <motion.main key={location.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }} className="max-w-[1400px] mx-auto px-6 py-8">
        {smtp && !smtp.configured && location.pathname !== "/integrations" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            data-testid="simulation-banner" className="mb-6 flex items-center gap-4 bg-white/70 backdrop-blur-md rounded-2xl clara-soft px-4 py-3.5 ring-1 ring-amber-100/70">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
              <AlertCircle className="h-[18px] w-[18px]" />
            </span>
            <div className="text-sm text-slate-600 flex-1 leading-snug">
              <b className="text-slate-900">Simulatiemodus actief.</b> Er is nog geen SMTP-server ingesteld — campagnes worden alleen als voorbeeld verstuurd. Tracking &amp; statistieken werken wel.
            </div>
            <button onClick={() => navigate("/integrations")}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-full px-4 py-2 clara-trans">
              Instellen
            </button>
          </motion.div>
        )}
        {apiCfg && !apiCfg.website && !["/developers", "/plans"].includes(location.pathname) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            data-testid="api-warning-banner" className="mb-6 flex items-center gap-4 bg-white/70 backdrop-blur-md rounded-2xl clara-soft px-4 py-3.5 ring-1 ring-amber-100/70">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
              <AlertCircle className="h-[18px] w-[18px]" />
            </span>
            <div className="text-sm text-slate-600 flex-1 leading-snug">
              <b className="text-slate-900">Subscribe API not set up.</b> No website is linked, so people can't subscribe from your site yet. Add your website and grab the embed code.
            </div>
            <button onClick={() => navigate("/developers")}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-full px-4 py-2 clara-trans">
              Set up
            </button>
          </motion.div>
        )}
        {(title || subtitle || actions) && (
          <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
            <div>
              {title && <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{title}</h1>}
              {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
        )}
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
