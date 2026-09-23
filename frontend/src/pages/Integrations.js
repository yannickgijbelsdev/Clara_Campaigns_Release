import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Loader2, Save, Server, Send, Trash2, BookOpen } from "lucide-react";

const SECURITY_OPTIONS = [
  { value: "starttls", label: "STARTTLS (poort 587)" },
  { value: "ssl", label: "SSL/TLS (poort 465)" },
  { value: "none", label: "Geen (onversleuteld)" },
];

const EMPTY = { host: "", port: 587, security: "starttls", username: "", password: "", from_email: "", from_name: "", has_password: false, configured: false };

export default function Integrations() {
  const [cfg, setCfg] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = () =>
    api.get("/company/smtp")
      .then((r) => setCfg({ ...EMPTY, ...r.data, password: "" }))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    if (!cfg.host.trim() || !cfg.from_email.trim()) return toast.error("Host en afzender e-mailadres zijn verplicht.");
    if (!cfg.has_password && !cfg.password.trim()) return toast.error("Een wachtwoord is verplicht.");
    setSaving(true);
    try {
      await api.put("/company/smtp", {
        host: cfg.host.trim(), port: Number(cfg.port) || 587, security: cfg.security,
        username: cfg.username.trim(), password: cfg.password.trim() || null,
        from_email: cfg.from_email.trim(), from_name: cfg.from_name.trim(),
      });
      toast.success("SMTP-instellingen opgeslagen");
      await load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setSaving(false);
  };

  const test = async () => {
    setTesting(true);
    try {
      await api.post("/company/smtp/test");
      toast.success("Verbinding gelukt! De SMTP-gegevens werken.");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setTesting(false);
  };

  const remove = async () => {
    await api.delete("/company/smtp");
    toast.success("SMTP-configuratie verwijderd");
    setCfg(EMPTY);
    load();
  };

  return (
    <AppLayout title="E-mail / SMTP" subtitle="Verstuur nieuwsbrieven via je eigen SMTP-server">
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-testid="smtp-config-card">
          <div className="flex items-center gap-4 p-6 border-b border-slate-100">
            <div className="h-12 w-12 rounded-xl bg-[#7380b6]/10 flex items-center justify-center">
              <Server className="h-6 w-6 text-[#7380b6]" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold text-slate-900">SMTP-server</h2>
              <p className="text-sm text-slate-500">Nieuwsbrieven worden verstuurd via de SMTP-server van deze werkruimte.</p>
            </div>
            {cfg.configured && (
              <span data-testid="smtp-status-badge" className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> Geconfigureerd
              </span>
            )}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Laden…</div>
            ) : (
              <>
                {!cfg.configured && (
                  <div className="flex items-center gap-4 bg-amber-50/70 rounded-2xl clara-soft ring-1 ring-amber-100/70 p-4 mb-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
                      <AlertTriangle className="h-[18px] w-[18px]" />
                    </span>
                    <div className="text-sm text-slate-600 leading-snug">
                      <b className="text-slate-900">Nog niet geconfigureerd.</b> Zolang er geen SMTP-server is ingesteld, worden campagnes in simulatiemodus verstuurd (tracking werkt, maar er gaat geen echte e-mail uit).
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">SMTP-host</label>
                    <input data-testid="smtp-host" value={cfg.host} onChange={(e) => set("host", e.target.value)}
                      placeholder="smtp.jouwdomein.com"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Poort</label>
                    <input data-testid="smtp-port" type="number" value={cfg.port} onChange={(e) => set("port", e.target.value)}
                      placeholder="587"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Beveiliging</label>
                  <select data-testid="smtp-security" value={cfg.security} onChange={(e) => set("security", e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6] bg-white">
                    {SECURITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Gebruikersnaam</label>
                    <input data-testid="smtp-username" value={cfg.username} onChange={(e) => set("username", e.target.value)}
                      placeholder="gebruiker@jouwdomein.com" autoComplete="off"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Wachtwoord {cfg.has_password && <span className="text-emerald-600 font-normal">· opgeslagen — laat leeg om te behouden</span>}
                    </label>
                    <input data-testid="smtp-password" type="password" value={cfg.password} onChange={(e) => set("password", e.target.value)}
                      placeholder={cfg.has_password ? "•••••••••• (ongewijzigd)" : "SMTP-wachtwoord"} autoComplete="new-password"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Afzender e-mailadres</label>
                    <input data-testid="smtp-from-email" type="email" value={cfg.from_email} onChange={(e) => set("from_email", e.target.value)}
                      placeholder="nieuwsbrief@jouwdomein.com"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Afzendernaam</label>
                    <input data-testid="smtp-from-name" value={cfg.from_name} onChange={(e) => set("from_name", e.target.value)}
                      placeholder="Jouw Organisatie"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-6">
                  <button data-testid="save-smtp-config" onClick={save} disabled={saving}
                    className="inline-flex items-center gap-2 bg-[#7380b6] hover:bg-[#616fa6] text-white text-sm font-medium px-4 py-2.5 rounded-full transition-colors disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Opslaan
                  </button>
                  <button data-testid="test-smtp-config" onClick={test} disabled={testing || !cfg.configured}
                    className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium px-4 py-2.5 rounded-full transition-colors disabled:opacity-50">
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Verbinding testen
                  </button>
                  {cfg.configured && (
                    <button data-testid="delete-smtp-config" onClick={remove}
                      className="inline-flex items-center gap-2 text-sm text-rose-600 hover:bg-rose-50 font-medium px-3 py-2.5 rounded-full transition-colors ml-auto">
                      <Trash2 className="h-4 w-4" /> Verwijderen
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-display font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#7380b6]" /> Zo stel je SMTP in
          </h3>
          <p className="text-sm text-slate-500 mb-5">Vraag deze gegevens op bij je e-mail- of hostingprovider.</p>
          <ol className="space-y-4">
            {[
              { t: "Zoek de SMTP-gegevens", d: "Je e-mailprovider (bv. Microsoft 365, Google Workspace, je hostingpartij) geeft een SMTP-host, poort en beveiligingstype." },
              { t: "Vul host en poort in", d: "Gebruik meestal poort 587 met STARTTLS, of poort 465 met SSL/TLS." },
              { t: "Gebruikersnaam & wachtwoord", d: "Dit is meestal het volledige e-mailadres en het bijbehorende (app-)wachtwoord." },
              { t: "Afzender instellen", d: "Vul het afzenderadres en de afzendernaam in die je ontvangers zien. Sla op en klik op ‘Verbinding testen’." },
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-[#7380b6] text-white text-sm font-semibold flex items-center justify-center shrink-0">{i + 1}</div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{step.t}</div>
                  <div className="text-sm text-slate-600 mt-0.5 leading-relaxed">{step.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </AppLayout>
  );
}
