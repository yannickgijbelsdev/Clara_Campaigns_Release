import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";

export default function Integrations() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useSearchParams();

  const load = () => api.get("/mailbox").then((r) => setStatus(r.data)).catch(() => {});
  useEffect(() => {
    load();
    if (params.get("connected")) { toast.success("Office 365 verbonden!"); setParams({}); }
    if (params.get("error")) { toast.error(`Verbinden mislukt: ${params.get("error")}`); setParams({}); }
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/oauth/microsoft/start");
      if (!data.configured) {
        toast.error("Office 365 is nog niet geconfigureerd door de beheerder (Azure-sleutels ontbreken).");
        setLoading(false);
        return;
      }
      window.location.href = data.authorization_url;
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      setLoading(false);
    }
  };

  const disconnect = async () => {
    await api.delete("/mailbox");
    toast.success("Verbinding verbroken");
    load();
  };

  return (
    <AppLayout title="Office 365 Integratie">
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 p-6 border-b border-slate-100">
            <div className="h-12 w-12 rounded-xl bg-[#0078D4]/10 flex items-center justify-center">
              <svg viewBox="0 0 23 23" className="h-7 w-7"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold text-slate-900">Microsoft Office 365</h2>
              <p className="text-sm text-slate-500">Verstuur nieuwsbrieven vanuit je eigen Office 365-mailbox via Microsoft Graph.</p>
            </div>
          </div>

          <div className="p-6">
            {status?.configured === false && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <b>Nog niet geconfigureerd.</b> De Azure App Registration-sleutels (MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT) zijn nog niet ingesteld. Zonder deze werkt versturen in simulatiemodus.
                </div>
              </div>
            )}

            {status?.connected ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium text-emerald-800">Verbonden</div>
                    <div className="text-sm text-emerald-700">{status.email || "Office 365-account"}</div>
                  </div>
                </div>
                <button data-testid="disconnect-o365" onClick={disconnect}
                  className="inline-flex items-center gap-2 text-sm px-3 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">
                  <Unplug className="h-4 w-4" /> Verbreken
                </button>
              </div>
            ) : (
              <>
                {status?.needs_reauth && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 mb-3">
                    <RefreshCw className="h-4 w-4" /> Autorisatie verlopen — verbind opnieuw.
                  </div>
                )}
                <button data-testid="connect-o365-btn" onClick={connect} disabled={loading}
                  className="inline-flex items-center gap-2 bg-[#0078D4] hover:bg-[#106ebe] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Verbind Microsoft 365
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-display font-medium text-slate-900 mb-2">Zo werkt het</h3>
          <ol className="text-sm text-slate-600 space-y-1.5 list-decimal list-inside">
            <li>Klik op "Verbind Microsoft 365" en log in met je Office 365-account.</li>
            <li>Geef toestemming voor <code className="text-xs bg-slate-100 px-1 rounded">Mail.Send</code>.</li>
            <li>Je nieuwsbrieven worden verstuurd vanuit jouw mailbox.</li>
          </ol>
        </div>
      </div>
    </AppLayout>
  );
}
