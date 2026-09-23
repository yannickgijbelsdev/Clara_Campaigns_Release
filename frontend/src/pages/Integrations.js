import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Link2, Loader2, RefreshCw, Unplug, BookOpen, Copy } from "lucide-react";

const redirectUri = `${process.env.REACT_APP_BACKEND_URL}/api/oauth/microsoft/callback`;

export default function Integrations() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useSearchParams();

  const load = () => api.get("/mailbox").then((r) => setStatus(r.data)).catch(() => {});
  useEffect(() => {
    load();
    if (params.get("connected")) { toast.success("Office 365 connected!"); setParams({}); }
    if (params.get("error")) { toast.error(`Connection failed: ${params.get("error")}`); setParams({}); }
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/oauth/microsoft/start");
      if (!data.configured) {
        toast.error("Office 365 is not configured yet by the administrator (Azure keys missing).");
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
    <AppLayout title="Office 365 Integration" subtitle="Send newsletters from your own Microsoft 365 mailbox">
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 p-6 border-b border-slate-100">
            <div className="h-12 w-12 rounded-xl bg-[#0078D4]/10 flex items-center justify-center">
              <svg viewBox="0 0 23 23" className="h-7 w-7"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold text-slate-900">Microsoft Office 365</h2>
              <p className="text-sm text-slate-500">Send newsletters via Microsoft Graph, straight from your mailbox.</p>
            </div>
          </div>

          <div className="p-6">
            {status?.configured === false && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <b>Not configured yet.</b> The Azure App Registration keys (MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT) haven't been set. Without them, sending runs in simulation mode.
                </div>
              </div>
            )}

            {status?.connected ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <div>
                    <div className="text-sm font-medium text-emerald-800">Connected</div>
                    <div className="text-sm text-emerald-700">{status.email || "Office 365 account"}</div>
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
              { t: "Hand the keys to your admin", d: <>Provide <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">MS_CLIENT_ID</span>, <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">MS_CLIENT_SECRET</span> and <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">MS_TENANT</span> so they can be added to the platform. Then click <b>Connect Microsoft 365</b> above.</> },
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
