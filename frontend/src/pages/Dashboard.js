import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Plus, Users, Send, Mail } from "lucide-react";

const DOT = { sent: "bg-emerald-500", draft: "bg-slate-400", sending: "bg-amber-500", scheduled: "bg-sky-500", failed: "bg-rose-500" };
const TAGBG = {
  sent: "bg-emerald-50 text-emerald-600",
  draft: "bg-slate-100 text-slate-500",
  sending: "bg-amber-50 text-amber-600",
  scheduled: "bg-sky-50 text-sky-600",
  failed: "bg-rose-50 text-rose-600",
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const { activeCompany, companies } = useAuth();
  const current = companies.find((c) => c.id === activeCompany);

  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)).catch(() => {}); }, []);
  const recent = data?.recent_campaigns || [];

  return (
    <AppLayout title="Dashboard" subtitle="Your newsletter workspace at a glance">
      {/* Top floating row */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="bg-white rounded-3xl clara-soft clara-hover clara-trans p-5 flex items-center gap-4">
          <div className="text-[42px] font-display font-bold text-slate-900 leading-none">{data?.total_campaigns ?? 0}</div>
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-widest text-rose-500 font-bold">Clara</div>
            <div className="text-sm font-semibold text-slate-700">Campaigns created</div>
          </div>
          <button data-testid="new-campaign-btn" onClick={() => navigate("/campaigns/new")}
            className="ml-3 inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-5 py-3 rounded-full">
            <Plus className="h-4 w-4" /> New campaign
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.06 }}
          className="bg-white rounded-full clara-soft px-5 py-3 flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2 text-slate-500"><Users className="h-4 w-4 text-slate-400" /> Contacts <b className="text-slate-900 text-base">{data?.total_contacts ?? 0}</b></span>
          <span className="h-5 w-px bg-slate-200" />
          <span className="flex items-center gap-2 text-slate-500"><Send className="h-4 w-4 text-slate-400" /> Sent <b className="text-slate-900 text-base">{data?.total_sent ?? 0}</b></span>
        </motion.div>
      </div>

      {/* Central workspace card */}
      <motion.div initial={{ opacity: 0, y: 22, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 22, delay: 0.1 }}
        className="max-w-xl mx-auto bg-white rounded-3xl clara-soft overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-3 py-1">{current?.name || "Workspace"}</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 rounded-full px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Active
          </span>
        </div>

        <div className="px-3 pb-2 pt-1">
          {!recent.length ? (
            <div className="px-2 py-10 text-center text-slate-400">
              <Mail className="h-9 w-9 mx-auto mb-3 opacity-40" />
              <p className="text-sm mb-4">No campaigns yet — create your first newsletter.</p>
              <button onClick={() => navigate("/campaigns/new")} className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-full">New campaign</button>
            </div>
          ) : recent.map((c, i) => (
            <motion.div key={c.id} data-testid={`recent-${c.id}`} onClick={() => navigate(`/campaigns/${c.id}/analytics`)}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.14 + i * 0.05 }}
              className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-slate-50 cursor-pointer clara-trans">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 shrink-0">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${DOT[c.status] || DOT.draft}`} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{c.name}</div>
                <div className="text-xs text-slate-400 truncate">{c.sent} sent · {c.opened} open · {c.clicked} click</div>
              </div>
              <span className={`text-xs font-semibold capitalize rounded-full px-2.5 py-1 ${TAGBG[c.status] || TAGBG.draft}`}>{c.status}</span>
            </motion.div>
          ))}
        </div>

        {recent.length > 0 && (
          <button onClick={() => navigate("/campaigns")}
            className="w-full px-6 py-4 border-t border-slate-100 text-sm font-medium text-rose-600 hover:bg-rose-50/50 clara-trans">
            View all campaigns
          </button>
        )}
      </motion.div>
    </AppLayout>
  );
}
