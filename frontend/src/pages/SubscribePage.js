import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Mail } from "lucide-react";

export default function SubscribePage() {
  const { apiKey } = useParams();
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", city: "", category_ids: [] });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get(`/public/form/${apiKey}`).then((r) => setCfg(r.data)).catch(() => setErr(true));
  }, [apiKey]);

  const toggleCat = (id) => setForm((f) => ({
    ...f, category_ids: f.category_ids.includes(id) ? f.category_ids.filter((x) => x !== id) : [...f.category_ids, id],
  }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/public/subscribe/${apiKey}`, form);
      setDone(data.thankyou);
    } catch (er) {
      alert(formatApiErrorDetail(er.response?.data?.detail));
    }
    setBusy(false);
  };

  if (err) return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl clara-soft p-10 text-center max-w-sm">
        <h1 className="font-display text-xl font-bold text-slate-900">Form unavailable</h1>
        <p className="text-sm text-slate-500 mt-2">This subscribe form doesn't exist or has been turned off.</p>
      </div>
    </div>
  );

  if (!cfg) return <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-rose-500" /></div>;

  const primary = cfg.brand_primary || "#7380b6";

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl clara-soft overflow-hidden">
        <div className="h-2" style={{ background: primary }} />
        <div className="p-8">
          {done ? (
            <div className="text-center py-6" data-testid="subscribe-thankyou">
              <CheckCircle2 className="h-14 w-14 mx-auto mb-4" style={{ color: primary }} />
              <h1 className="font-display text-xl font-bold text-slate-900">You're in!</h1>
              <p className="text-sm text-slate-500 mt-2">{done}</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                {cfg.logo_url && <img src={cfg.logo_url} alt={cfg.company_name} className="h-14 mx-auto object-contain mb-4" />}
                <h1 className="font-display text-2xl font-bold text-slate-900">{cfg.form_title}</h1>
                <p className="text-sm text-slate-500 mt-2">{cfg.form_intro}</p>
              </div>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input data-testid="sub-first-name" required placeholder={cfg.label_first_name || "First name"} value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500" />
                  <input data-testid="sub-last-name" required placeholder={cfg.label_last_name || "Last name"} value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
                <input data-testid="sub-email" required type="email" placeholder={cfg.label_email || "Email address"} value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500" />
                {cfg.collect_city && (
                  <input data-testid="sub-city" placeholder={cfg.label_city || "City / municipality"} value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-rose-500" />
                )}
                {cfg.categories.length > 0 && (
                  <div className="pt-1">
                    <div className="text-xs font-medium text-slate-600 mb-2">{cfg.label_categories || "What would you like to receive?"}</div>
                    <div className="space-y-2">
                      {cfg.categories.map((c) => (
                        <label key={c.id} data-testid={`sub-cat-${c.id}`} className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" checked={form.category_ids.includes(c.id)} onChange={() => toggleCat(c.id)}
                            className="h-4 w-4 mt-0.5 accent-rose-600" style={{ accentColor: primary }} />
                          <span>
                            <span className="text-sm text-slate-800 font-medium block">{c.name}</span>
                            {c.description && <span className="text-xs text-slate-400">{c.description}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <button data-testid="sub-submit" type="submit" disabled={busy}
                  className="w-full flex items-center justify-center gap-2 text-white text-sm font-semibold rounded-full py-3 mt-2 disabled:opacity-60"
                  style={{ background: primary }}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} {cfg.submit_text || "Subscribe"}
                </button>
              </form>
            </>
          )}
        </div>
        <div className="px-8 pb-6 text-center">
          <span className="text-[11px] text-slate-400">Powered by Clara Campaigns</span>
        </div>
      </motion.div>
    </div>
  );
}
