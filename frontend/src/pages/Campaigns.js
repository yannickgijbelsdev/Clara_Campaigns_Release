import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Send, BarChart3, Pencil, Trash2, Plus, Mail } from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  sending: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Campaigns() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  const load = () => api.get("/campaigns").then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Deze campagne verwijderen?")) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success("Campagne verwijderd");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <AppLayout title="Campagnes">
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-500">{items.length} campagne(s)</p>
        <button data-testid="new-campaign-btn" onClick={() => navigate("/campaigns/new")}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="h-4 w-4" /> Nieuwe campagne
        </button>
      </div>

      {!items.length ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400">
          <Mail className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-sm mb-4">Nog geen campagnes aangemaakt.</p>
          <button onClick={() => navigate("/campaigns/new")} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            Maak je eerste nieuwsbrief
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((c) => (
            <div key={c.id} data-testid={`campaign-card-${c.id}`}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-display font-semibold text-slate-900">{c.name}</h3>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border capitalize ${STATUS[c.status] || STATUS.draft}`}>{c.status}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1 truncate">{c.subject || "Geen onderwerp"}</p>
                <div className="flex gap-5 mt-2 text-xs text-slate-500">
                  <span>{c.stats?.sent || 0} verzonden</span>
                  <span>{c.stats?.opened || 0} geopend</span>
                  <span>{c.stats?.clicked || 0} geklikt</span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button data-testid={`analytics-${c.id}`} onClick={() => navigate(`/campaigns/${c.id}/analytics`)}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Statistieken">
                  <BarChart3 className="h-[18px] w-[18px]" />
                </button>
                <button data-testid={`edit-${c.id}`} onClick={() => navigate(`/campaigns/${c.id}`)}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Bewerken">
                  <Pencil className="h-[18px] w-[18px]" />
                </button>
                <button data-testid={`delete-${c.id}`} onClick={(e) => remove(c.id, e)}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Verwijderen">
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
