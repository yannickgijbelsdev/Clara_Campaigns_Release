import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Link2, Loader2, RefreshCw, Unplug, BookOpen, Copy, Save, KeyRound } from "lucide-react";

const redirectUri = "https://campaigns.koodh.com/api/oauth/microsoft/callback";

export default function Integrations() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useSearchParams();
  const [cfg, setCfg] = useState({ client_id: "", tenant: "", client_secret: "", has_secret: false });
  const [savingCfg, setSavingCfg] = useState(false);

  const load = () => api.get("/mailbox").then((r) => setStatus(r.data)).catch(() => {});
  const loadCfg = () => api.get("/admin/ms-config").then((r) => setCfg({ ...r.data, client_secret: "" })).catch(() => {});
  useEffect(() => {
    load();
    if (isAdmin) loadCfg();
    if (params.get("connected")) { toast.success("Microsoft 365 connected!"); setParams({}); }
    if (params.get("error")) { toast.error(`Connection failed: ${params.get("error")}`); setParams({}); }
  }, []);

  const saveCfg = async () => {
    if (!cfg.client_id.trim() || !cfg.tenant.trim()) return toast.error("Client ID and Tenant ID are required.");
    setSavingCfg(true);
    try {
      await api.put("/admin/ms-config", {
        client_id: cfg.client_id.trim(), tenant: cfg.tenant.trim(),
        client_secret: cfg.client_secret.trim() || null,
      });
      toast.success("Microsoft 365 credentials saved");
      await loadCfg();
      await load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setSavingCfg(false);
  };

  const connect = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/oauth/microsoft/start");
      if (!data.configured) {
        toast.error("Microsoft 365 is not configured yet by the administrator (Azure keys missing).");
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
    toast.success("Disconnected");
    load();
  };

  return (
    <AppLayout title="Microsoft 365 Integration" subtitle="Send newsletters from your own Microsoft 365 mailbox">
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 p-6 border-b border-slate-100">
            <div className="h-12 w-12 rounded-xl bg-[#0078D4]/10 flex items-center justify-center">
              <svg viewBox="0 0 23 23" className="h-7 w-7"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold text-slate-900">Microsoft 365</h2>
              <p className="text-sm text-slate-500">Send newsletters via Microsoft Graph, straight from your mailbox.</p>
            </div>
          </div>

          <div className="p-6">
            {status?.configured === false && (
              <div className="flex items-center gap-4 bg-amber-50/70 rounded-2xl clara-soft ring-1 ring-amber-100/70 p-4 mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
                  <AlertTriangle className="h-[18px] w-[18px]" />
                </span>
                <div className="text-sm text-slate-600 leading-snug">
                  <b className="text-slate-900">Not configured yet.</b> The Azure App Registration keys (<span className="font-mono text-xs bg-white/80 px-1.5 py-0.5 rounded text-amber-700">MS_CLIENT_ID</span> / <span className="font-mono text-xs bg-white/80 px-1.5 py-0.5 rounded text-amber-700">MS_CLIENT_SECRET</span> / <span className="font-mono text-xs bg-white/80 px-1.5 py-0.5 rounded text-amber-700">MS_TENANT</span>) haven't been set. Until then, sending runs in simulation mode.
                </div>
              </div>
            )}

            {status?.connected ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium text-emerald-800">Connected</div>
                    <div className="text-sm text-emerald-700">{status.email || "Microsoft 365 account"}</div>
                  </div>
                </div>
                <button data-testid="disconnect-o365" onClick={disconnect}
                  className="inline-flex items-center gap-2 text-sm px-3 py-2 border border-emerald-300 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors">
                  <Unplug className="h-4 w-4" /> Disconnect
                </button>
              </div>
            ) : (
              <>
                {status?.needs_reauth && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 mb-3">
                    <RefreshCw className="h-4 w-4" /> Authorization expired — please reconnect.
                  </div>
                )}
                <button data-testid="connect-o365-btn" onClick={connect} disabled={loading}
                  className="inline-flex items-center gap-2 bg-[#0078D4] hover:bg-[#106ebe] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Connect Microsoft 365
                </button>
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="ms-config-card">
            <h3 className="font-display font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-rose-600" /> Azure app credentials
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Paste the keys from your Azure app registration here. They are stored securely (the secret is encrypted) and used to connect Microsoft 365.
            </p>

            <div className="mb-3">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Redirect URI (add this in Azure → Authentication)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-slate-900 text-slate-100 px-2.5 py-2 rounded-lg break-all">{cfg.redirect_uri || redirectUri}</code>
                <button onClick={() => { navigator.clipboard.writeText(cfg.redirect_uri || redirectUri); toast.success("Copied"); }}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"><Copy className="h-4 w-4 text-slate-500" /></button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Application (client) ID</label>
                <input data-testid="ms-client-id" value={cfg.client_id}
                  onChange={(e) => setCfg({ ...cfg, client_id: e.target.value })}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6] font-mono" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Directory (tenant) ID</label>
                <input data-testid="ms-tenant" value={cfg.tenant}
                  onChange={(e) => setCfg({ ...cfg, tenant: e.target.value })}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6] font-mono" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Client secret {cfg.has_secret && <span className="text-emerald-600 font-normal">· a secret is saved — leave blank to keep it</span>}
              </label>
              <input data-testid="ms-client-secret" type="password" value={cfg.client_secret}
                onChange={(e) => setCfg({ ...cfg, client_secret: e.target.value })}
                placeholder={cfg.has_secret ? "•••••••••• (unchanged)" : "Paste the secret Value"}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6] font-mono" />
            </div>

            <div className="flex items-center justify-between mt-5">
              <span className={`text-xs px-2.5 py-1 rounded-full ${cfg.configured ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                {cfg.configured ? "Configured" : "Not configured"}
              </span>
              <button data-testid="save-ms-config" onClick={saveCfg} disabled={savingCfg}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors disabled:opacity-60">
                {savingCfg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save credentials
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-display font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-rose-600" /> Step-by-step: connect Microsoft 365
          </h3>
          <p className="text-sm text-slate-500 mb-5">Follow these steps once, in the Microsoft Entra admin center (Azure Portal).</p>
          <ol className="space-y-4">
            {[
              { t: "Open App registrations", d: <>Go to <a className="text-rose-600 hover:underline" href="https://entra.microsoft.com" target="_blank" rel="noreferrer">entra.microsoft.com</a> → <b>Applications → App registrations → New registration</b>.</> },
              { t: "Name your app", d: <>Enter a name like <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Clara Campaigns</span> and choose <b>Accounts in this organizational directory only</b> (or multi-tenant if needed).</> },
              { t: "Add the Redirect URI", d: <>Under <b>Redirect URI</b> select type <b>Web</b> and paste exactly:<div className="mt-1.5 flex items-center gap-2"><code className="text-xs bg-slate-900 text-slate-100 px-2 py-1.5 rounded-lg break-all">{redirectUri}</code><button onClick={() => { navigator.clipboard.writeText(redirectUri); toast.success("Copied"); }} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"><Copy className="h-4 w-4 text-slate-500" /></button></div></> },
              { t: "Add API permissions", d: <>Go to <b>API permissions → Add a permission → Microsoft Graph → Delegated</b> and add: <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">openid</span> <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">profile</span> <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">email</span> <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">offline_access</span> <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">User.Read</span> <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">Mail.Send</span>. Then click <b>Grant admin consent</b>.</> },
              { t: "Create a client secret", d: <>Go to <b>Certificates &amp; secrets → New client secret</b>. Copy the <b>Value</b> immediately (you can't see it again).</> },
              { t: "Copy your IDs", d: <>From the app <b>Overview</b> copy the <b>Application (client) ID</b> and the <b>Directory (tenant) ID</b>.</> },
              { t: "Paste the keys here", d: <>Copy the <b>Application (client) ID</b>, <b>Directory (tenant) ID</b> and the client secret <b>Value</b> into the <b>Azure app credentials</b> card above and click <b>Save credentials</b>. Then click <b>Connect Microsoft 365</b>.</> },
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-rose-600 text-white text-sm font-semibold flex items-center justify-center shrink-0">{i + 1}</div>
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
