import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Plus, Users, Send, ShieldCheck, Mail, Zap } from "lucide-react";

const DOT = { sent: "bg-emerald-500", draft: "bg-slate-400", sending: "bg-amber-500", scheduled: "bg-sky-500", failed: "bg-rose-500" };
const TAG = { sent: "text-emerald-600", draft: "text-slate-500", sending: "text-amber-600", scheduled: "text-sky-600", failed: "text-rose-600" };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();
  const { activeCompany, companies } = useAuth();
  const current = companies.find((c) => c.id === activeCompany);

  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)).catch(() => {}); }, []);

  return (
    <AppLayout title="Dashboard" subtitle="Your newsletter workspace at a glance">
      {/* Top floating row */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/5 p-4 flex items-center gap-4">
          <div className="text-4xl font-display font-bold text-slate-900 leading-none">{data?.total_campaigns ?? 0}</div>
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Campaigns</div>
            <div className="text-sm font-medium text-slate-700">Total created</div>
          </div>
          <button data-testid="new-campaign-btn" onClick={() => navigate("/campaigns/new")}
            className="ml-2 inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2.5 rounded-full transition-colors">
            <Plus className="h-4 w-4" /> New campaign
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-full border border-slate-200 shadow-sm px-4 py-2 flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-600"><Users className="h-4 w-4 text-slate-400" /> Contacts <b className="text-slate-900">{data?.total_contacts ?? 0}</b></span>
          <span className="h-4 w-px bg-slate-200" />
          <span className="flex items-center gap-1.5 text-slate-600"><Send className="h-4 w-4 text-slate-400" /> Sent <b className="text-slate-900">{data?.total_sent ?? 0}</b></span>
        </motion.div>
      </div>

      {/* Central workspace card */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }}
        className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{current?.name || "Workspace"}</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Active
          </span>
        </div>

        <div className="px-3">
          {!data?.recent_campaigns?.length ? (
            <div className="px-2 py-10 text-center text-slate-400">
              <Mail className="h-9 w-9 mx-auto mb-3 opacity-40" />
              <p className="text-sm mb-4">No campaigns yet — create your first newsletter.</p>
              <button onClick={() => navigate("/campaigns/new")} className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-full">New campaign</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recent_campaigns.map((c) => (
                <div key={c.id} data-testid={`recent-${c.id}`} onClick={() => navigate(`/campaigns/${c.id}/analytics`)}
                  className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${DOT[c.status] || DOT.draft}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{c.name}</div>
                    <div className="text-xs text-slate-400 truncate">{c.subject || "No subject"} · {c.sent} sent · {c.opened} open</div>
                  </div>
                  <span className={`text-xs font-medium capitalize ${TAG[c.status] || TAG.draft}`}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="m-3 mt-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white px-4 py-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-medium">Clara Campaigns — Office 365 Newsletter Delivery</span>
        </div>
      </motion.div>

      {/* Status chip */}
      <div className="flex justify-center mt-6">
        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full shadow-sm px-4 py-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-slate-600">All systems operational</span>
          <Zap className="h-4 w-4 text-amber-500" />
          <b className="text-slate-900">{data?.open_rate ?? 0}% open · {data?.click_rate ?? 0}% click</b>
        </div>
      </div>
    </AppLayout>
  );
}
