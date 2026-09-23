import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout, { PrimaryButton } from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { BarChart3, Pencil, Trash2, Plus, Mail } from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  sending: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse",
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  const load = () => api.get("/campaigns").then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this campaign?")) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success("Campaign deleted");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <AppLayout title="Campaigns" subtitle={`${items.length} campaign(s)`}
      actions={<PrimaryButton testid="new-campaign-btn" icon={Plus} onClick={() => navigate("/campaigns/new")}>New campaign</PrimaryButton>}>
      {!items.length ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400">
          <Mail className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-sm mb-4">No campaigns created yet.</p>
          <button onClick={() => navigate("/campaigns/new")} className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-full">
            Create your first newsletter
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((c, i) => (
            <motion.div key={c.id} data-testid={`campaign-card-${c.id}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 hover:shadow-md hover:border-rose-200 transition-all">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center font-display font-bold text-lg shrink-0">
                {c.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-display font-semibold text-slate-900 truncate">{c.name}</h3>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border capitalize ${STATUS[c.status] || STATUS.draft}`}>{c.status}</span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5 truncate">{c.subject || "No subject"}</p>
                <div className="flex gap-4 mt-1.5 text-xs text-slate-400">
                  <span>{c.stats?.sent || 0} sent</span>
                  <span>{c.stats?.opened || 0} opened</span>
                  <span>{c.stats?.clicked || 0} clicked</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button data-testid={`analytics-${c.id}`} onClick={() => navigate(`/campaigns/${c.id}/analytics`)}
                  className="inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 border border-slate-200 rounded-full hover:bg-slate-50 text-slate-700 transition-colors">
                  <BarChart3 className="h-4 w-4" /> Analytics
                </button>
                <button data-testid={`edit-${c.id}`} onClick={() => navigate(`/campaigns/${c.id}`)}
                  className="inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 border border-slate-200 rounded-full hover:bg-slate-50 text-slate-700 transition-colors">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button data-testid={`delete-${c.id}`} onClick={(e) => remove(c.id, e)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors" title="Delete">
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
