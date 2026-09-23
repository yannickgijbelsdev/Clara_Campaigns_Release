import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { companyLogoUrl } from "@/pages/Branding";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { BearLoader } from "@/components/BearLoader";
import { useLoadingGate } from "@/lib/useLoadingGate";
import {
  Code2, Copy, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle, Loader2, Check,
  Tag, Plus, Trash2, Globe, BookOpen, Link2,
} from "lucide-react";

const inp = "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none";
const copy = (t) => { navigator.clipboard.writeText(t); toast.success("Copied to clipboard"); };

function Card({ icon: Icon, tint, title, desc, children, testid }) {
  return (
    <div className="bg-white rounded-3xl clara-soft p-6" data-testid={testid}>
      <div className="flex items-start gap-3 mb-5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${tint}`}><Icon className="h-[18px] w-[18px]" /></span>
        <div>
          <h2 className="font-display font-semibold text-slate-900">{title}</h2>
          {desc && <p className="text-sm text-slate-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function CategoriesCard() {
  const [cats, setCats] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7380b6");
  const confirm = useConfirm();
  const load = () => api.get("/categories").then((r) => setCats(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim()) return;
    try { await api.post("/categories", { name, color }); setName(""); load(); toast.success("Category added"); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (c) => {
    if (!(await confirm({ title: "Delete category?", message: `"${c.name}" will be removed from the form and all contacts.`, confirmText: "Delete" }))) return;
    await api.delete(`/categories/${c.id}`); load();
  };

  return (
    <Card icon={Tag} tint="bg-amber-50 text-amber-600" title="Categories" testid="categories-card"
      desc="Subscribers pick these on your form. Target them when sending a newsletter.">
      <div className="flex items-center gap-2 mb-4">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-11 rounded-lg border border-slate-200 cursor-pointer bg-white p-1" />
        <input data-testid="category-name-input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New category name" className={inp} />
        <button data-testid="add-category-btn" onClick={add} className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shrink-0"><Plus className="h-4 w-4" /> Add</button>
      </div>
      {!cats.length ? (
        <p className="text-sm text-slate-400 py-2">No categories yet. Add your first one above.</p>
      ) : (
        <div className="space-y-2">
          {cats.map((c) => (
            <div key={c.id} data-testid={`category-row-${c.id}`} className="flex items-center gap-3 px-3 py-2.5 border border-slate-100 rounded-xl">
              <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
              <span className="text-sm text-slate-800 font-medium flex-1">{c.name}</span>
              <span className="text-xs text-slate-400">{c.contacts} contacts</span>
              <button data-testid={`delete-category-${c.id}`} onClick={() => del(c)} className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ApiAccess() {
  const [s, setS] = useState(null);
  const [branding, setBranding] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = useConfirm();

  const load = () => api.get("/subscribe/settings").then((r) => { setS(r.data); setFailed(false); }).catch(() => setFailed(true));
  useEffect(() => {
    load();
    api.get("/company/branding").then((r) => setBranding(r.data)).catch(() => {});
  }, []);
  const showLoader = useLoadingGate(!!s || failed);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/subscribe/settings", {
        website: s.website, form_title: s.form_title, form_intro: s.form_intro,
        form_thankyou: s.form_thankyou, collect_city: s.collect_city, active: s.active,
        label_first_name: s.label_first_name, label_last_name: s.label_last_name,
        label_email: s.label_email, label_city: s.label_city,
        label_categories: s.label_categories, submit_text: s.submit_text,
      });
      setS(data); toast.success("Saved");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setBusy(false);
  };

  const regen = async () => {
    if (!(await confirm({ title: "Regenerate API key?", message: "Your old key stops working immediately and any embedded form must be updated.", confirmText: "Regenerate" }))) return;
    const { data } = await api.post("/subscribe/regenerate-key");
    setS(data); toast.success("New API key generated");
  };

  if (showLoader) return <AppLayout title="API & Subscribe form"><BearLoader label="Loading API access…" /></AppLayout>;

  if (!s) return (
    <AppLayout title="API & Subscribe form">
      <div data-testid="api-load-error" className="max-w-md mx-auto text-center bg-white rounded-3xl clara-soft p-10 mt-6">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4"><AlertTriangle className="h-6 w-6" /></span>
        <h2 className="font-display font-semibold text-slate-900 text-lg mb-1">Couldn't load API access</h2>
        <p className="text-sm text-slate-500 mb-6">Something went wrong loading this page. Please try again.</p>
        <button data-testid="api-load-retry" onClick={() => { setFailed(false); load(); }}
          className="inline-flex items-center gap-2 bg-[#7380b6] hover:bg-[#616fa6] text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </AppLayout>
  );

  const notConfigured = !s.website;
  const logo = companyLogoUrl(branding);
  const primary = branding?.brand_primary || "#7380b6";

  return (
    <AppLayout title="API & Subscribe form" subtitle="Let people subscribe from your website and manage what they sign up for">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          {notConfigured && (
            <div data-testid="api-not-configured-banner" className="flex items-center gap-4 bg-amber-50/70 rounded-2xl clara-soft ring-1 ring-amber-100/70 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0"><AlertTriangle className="h-[18px] w-[18px]" /></span>
              <div className="text-sm text-slate-600 leading-snug">
                <b className="text-slate-900">Not set up yet.</b> No website is linked, so your subscribe form isn't connected anywhere. Add your website below and place the embed code on your site to start collecting subscribers.
              </div>
            </div>
          )}

          {/* Connection status */}
          <Card icon={s.connected ? CheckCircle2 : Link2} tint={s.connected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}
            title="Connection status" testid="connection-card"
            desc={s.connected ? "Your form is connected and receiving subscribers." : "Once your website loads the form or someone subscribes, this turns green."}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${s.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {s.connected ? <><CheckCircle2 className="h-4 w-4" /> Connected</> : <><AlertTriangle className="h-4 w-4" /> Not connected</>}
              </span>
              {s.last_used_at && <span className="text-xs text-slate-400">Last activity: {new Date(s.last_used_at).toLocaleString()}</span>}
            </div>
          </Card>

          {/* Form URL + website */}
          <Card icon={Globe} tint="bg-sky-50 text-sky-600" title="Your subscribe form" testid="form-url-card"
            desc="Share this link or embed it. This is the hosted form people fill in.">
            <label className="block text-xs font-medium text-slate-600 mb-1">Form URL</label>
            <div className="flex items-center gap-2 mb-4">
              <input readOnly data-testid="form-url" value={s.public_url || ""} className={`${inp} font-mono text-xs`} />
              <button onClick={() => copy(s.public_url)} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 shrink-0"><Copy className="h-4 w-4 text-slate-500" /></button>
              <a href={s.public_url} target="_blank" rel="noopener noreferrer" data-testid="preview-form-link"
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shrink-0"><ExternalLink className="h-4 w-4" /> Preview</a>
            </div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Your website (where the form lives)</label>
            <input data-testid="website-input" value={s.website} onChange={(e) => setS({ ...s, website: e.target.value })} placeholder="https://yourcompany.com" className={inp} />
          </Card>

          {/* Editable form */}
          <Card icon={Code2} tint="bg-rose-50 text-rose-600" title="Edit the form" testid="edit-form-card"
            desc="Customize the wording. Your logo and colours come from Branding automatically.">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Form title</label>
                <input data-testid="form-title-input" value={s.form_title} onChange={(e) => setS({ ...s, form_title: e.target.value })} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Intro text (what they subscribe to)</label>
                <textarea data-testid="form-intro-input" value={s.form_intro} onChange={(e) => setS({ ...s, form_intro: e.target.value })} rows={2} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Thank-you message</label>
                <input data-testid="form-thankyou-input" value={s.form_thankyou} onChange={(e) => setS({ ...s, form_thankyou: e.target.value })} className={inp} />
              </div>
              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" data-testid="collect-city-toggle" checked={s.collect_city} onChange={(e) => setS({ ...s, collect_city: e.target.checked })} className="h-4 w-4 accent-rose-600" />
                Ask for city / municipality
              </label>
              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" data-testid="form-active-toggle" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} className="h-4 w-4 accent-rose-600" />
                Form is active (accepting subscriptions)
              </label>

              <div className="border-t border-slate-100 pt-4 mt-1">
                <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-3">Field labels</div>
                <div className="grid grid-cols-2 gap-3">
                  {[["label_first_name", "First name label"], ["label_last_name", "Last name label"],
                    ["label_email", "Email label"], ["label_city", "City label"]].map(([k, ph]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{ph}</label>
                      <input data-testid={`${k.replace(/_/g, "-")}-input`} value={s[k] || ""} onChange={(e) => setS({ ...s, [k]: e.target.value })} className={inp} />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Categories heading</label>
                    <input data-testid="label-categories-input" value={s.label_categories || ""} onChange={(e) => setS({ ...s, label_categories: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Subscribe button text</label>
                    <input data-testid="submit-text-input" value={s.submit_text || ""} onChange={(e) => setS({ ...s, submit_text: e.target.value })} className={inp} />
                  </div>
                </div>
              </div>

              <button data-testid="save-subscribe-settings-btn" onClick={save} disabled={busy}
                className="inline-flex items-center gap-2 text-sm px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save form
              </button>
            </div>
          </Card>

          <CategoriesCard />

          {/* API key + docs */}
          <Card icon={BookOpen} tint="bg-indigo-50 text-indigo-600" title="API key & embed code" testid="api-key-card"
            desc="Put this on your website so visitors can subscribe.">
            <label className="block text-xs font-medium text-slate-600 mb-1">API key</label>
            <div className="flex items-center gap-2 mb-4">
              <input readOnly data-testid="api-key" value={s.api_key || ""} className={`${inp} font-mono text-xs`} />
              <button onClick={() => copy(s.api_key)} className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 shrink-0"><Copy className="h-4 w-4 text-slate-500" /></button>
              <button data-testid="regen-key-btn" onClick={regen} className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 shrink-0"><RefreshCw className="h-4 w-4" /> Regenerate</button>
            </div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Embed a subscribe button</label>
            <pre className="relative bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto mb-2"><code>{s.embed_snippet}</code>
              <button onClick={() => copy(s.embed_snippet)} className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg"><Copy className="h-3.5 w-3.5" /></button>
            </pre>
            <label className="block text-xs font-medium text-slate-600 mb-1 mt-3">Or embed the whole form (iframe)</label>
            <pre className="relative bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto mb-4"><code>{s.iframe_snippet}</code>
              <button onClick={() => copy(s.iframe_snippet)} className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg"><Copy className="h-3.5 w-3.5" /></button>
            </pre>
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Manual — submit from your own code</h3>
              <p className="text-xs text-slate-500 mb-2">POST a subscriber to this endpoint:</p>
              <pre className="bg-slate-50 text-slate-700 text-xs rounded-xl p-3 overflow-x-auto"><code>{`POST ${process.env.REACT_APP_BACKEND_URL}/api/public/subscribe/${s.api_key}
Content-Type: application/json

{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "city": "Antwerp",
  "category_ids": ["<category id>", "..."]
}`}</code></pre>
            </div>
          </Card>
        </div>

        {/* Live preview */}
        <div className="xl:col-span-1">
          <div className="sticky top-24">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-3">Live preview</div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              data-testid="form-preview" className="bg-white rounded-3xl clara-soft overflow-hidden">
              <div className="h-2" style={{ background: primary }} />
              <div className="p-6 text-center">
                {logo && <img src={logo} alt="" className="h-12 mx-auto object-contain mb-4" />}
                <h3 className="font-display font-bold text-lg text-slate-900">{s.form_title}</h3>
                <p className="text-sm text-slate-500 mt-1.5 mb-5">{s.form_intro}</p>
                <div className="space-y-3 text-left">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">{s.label_first_name || "First name"}</label>
                      <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center px-3 text-xs text-slate-400">{s.label_first_name || "First name"}</div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">{s.label_last_name || "Last name"}</label>
                      <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center px-3 text-xs text-slate-400">{s.label_last_name || "Last name"}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">{s.label_email || "Email address"}</label>
                    <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center px-3 text-xs text-slate-400">you@example.com</div>
                  </div>
                  {s.collect_city && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">{s.label_city || "City / municipality"}</label>
                      <div className="h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center px-3 text-xs text-slate-400">{s.label_city || "City"}</div>
                    </div>
                  )}
                  <div className="h-9 rounded-full text-white text-sm font-semibold flex items-center justify-center mt-2" style={{ background: primary }}>{s.submit_text || "Subscribe"}</div>
                </div>
              </div>
            </motion.div>
            <p className="text-xs text-slate-400 text-center mt-3">Open the real form with the Preview button.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
