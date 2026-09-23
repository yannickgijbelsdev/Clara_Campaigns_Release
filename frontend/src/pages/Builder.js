import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { generateHtml, BLOCK_DEFAULTS, renderBlock } from "@/lib/emailHtml";
import { companyLogoUrl } from "@/pages/Branding";
import { ProgressOverlay } from "@/components/ProgressOverlay";
import { toast } from "sonner";
import {
  Type, AlignLeft, Image as ImageIcon, MousePointer, Minus, Space, Images,
  Save, Send, Code2, Eye, Trash2, ArrowUp, ArrowDown, Loader2, X, Link2, Check, AlertTriangle, User,
} from "lucide-react";

const MERGE_TAGS = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{last_name}}", label: "Last name" },
  { token: "{{name}}", label: "Full name" },
  { token: "{{email}}", label: "Email" },
];

const PALETTE = [
  { type: "logo", label: "Logo", icon: Images },
  { type: "title", label: "Title", icon: Type },
  { type: "text", label: "Text block", icon: AlignLeft },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "button", label: "Button", icon: MousePointer },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: Space },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export default function Builder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [meta, setMeta] = useState({ name: "New newsletter", subject: "", preheader: "" });
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("visual");
  const [rawHtml, setRawHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [saving, setSaving] = useState(false);
  const [campaignId, setCampaignId] = useState(isNew ? null : id);
  const [createProgress, setCreateProgress] = useState(false);
  const [branding, setBranding] = useState(null);
  const [autoStatus, setAutoStatus] = useState(""); // "" | "saving" | "saved"
  const hydrated = useRef(false);

  useEffect(() => {
    api.get("/company/branding").then((r) => setBranding(r.data)).catch(() => {});
  }, []);

  // Pre-apply company branding to block defaults (user can still change it).
  const brandDefaults = (type) => {
    const d = { ...BLOCK_DEFAULTS[type] };
    if (!branding) return d;
    if (type === "logo") {
      const l = companyLogoUrl(branding);
      if (l) d.src = l;
      if (branding.website) d.link = branding.website;
    }
    if (type === "button" && branding.brand_primary) d.bg = branding.brand_primary;
    if (type === "title" && branding.brand_accent) d.color = branding.brand_accent;
    return d;
  };

  // For a brand-new empty newsletter, start it with the company logo on top.
  useEffect(() => {
    if (isNew && branding && blocks.length === 0 && companyLogoUrl(branding)) {
      setBlocks([{ id: uid(), type: "logo", props: brandDefaults("logo") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding]);

  useEffect(() => {
    if (!isNew) {
      api.get(`/campaigns/${id}`).then((r) => {
        setMeta({ name: r.data.name, subject: r.data.subject || "", preheader: r.data.preheader || "" });
        setBlocks(r.data.blocks || []);
        setRawHtml(r.data.html || "");
        setTimeout(() => { hydrated.current = true; }, 200);
      }).catch(() => toast.error("Campaign not found"));
    } else {
      const t = setTimeout(() => { hydrated.current = true; }, 900);
      return () => clearTimeout(t);
    }
  }, [id]);

  const buildHtml = () => (mode === "html" ? rawHtml : generateHtml(blocks));

  const autosave = async () => {
    const payload = { ...meta, blocks, html: buildHtml() };
    try {
      if (campaignId) {
        await api.put(`/campaigns/${campaignId}`, payload);
      } else {
        const { data } = await api.post("/campaigns", payload);
        setCampaignId(data.id);
        window.history.replaceState(null, "", `/campaigns/${data.id}`);
      }
      setAutoStatus("saved");
    } catch {
      setAutoStatus("");
    }
  };

  // Debounced autosave on any change.
  useEffect(() => {
    if (!hydrated.current) return;
    setAutoStatus("saving");
    const t = setTimeout(() => { autosave(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, blocks, rawHtml, mode]);

  const html = useMemo(() => (mode === "html" ? rawHtml : generateHtml(blocks)), [blocks, mode, rawHtml]);

  const addBlock = (type) => {
    const b = { id: uid(), type, props: { ...brandDefaults(type) } };
    setBlocks([...blocks, b]);
    setSelected(b.id);
  };
  const updateProp = (key, value) => {
    setBlocks(blocks.map((b) => (b.id === selected ? { ...b, props: { ...b.props, [key]: value } } : b)));
  };
  const removeBlock = (bid) => {
    setBlocks(blocks.filter((b) => b.id !== bid));
    if (selected === bid) setSelected(null);
  };
  const move = (idx, dir) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= blocks.length) return;
    const arr = [...blocks];
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    setBlocks(arr);
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...meta, blocks, html: buildHtml() };
    try {
      if (campaignId) {
        await api.put(`/campaigns/${campaignId}`, payload);
      } else {
        const { data } = await api.post("/campaigns", payload);
        setCampaignId(data.id);
        window.history.replaceState(null, "", `/campaigns/${data.id}`);
      }
      toast.success("Saved");
      return true;
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const sel = blocks.find((b) => b.id === selected);

  const saveManual = async () => {
    const wasNew = !campaignId;
    const ok = await save();
    if (ok && wasNew) setCreateProgress(true);
  };

  return (
    <AppLayout title={isNew ? "New newsletter" : "Edit newsletter"}>
      {/* toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5 flex flex-wrap items-center gap-3">
        <input data-testid="campaign-name-input" value={meta.name}
          onChange={(e) => setMeta({ ...meta, name: e.target.value })}
          className="font-display font-semibold text-slate-900 border-0 border-b border-transparent hover:border-slate-200 focus:border-rose-500 outline-none px-1 py-0.5 min-w-[180px]" />
        <input data-testid="campaign-subject-input" value={meta.subject} placeholder="Email subject…"
          onChange={(e) => setMeta({ ...meta, subject: e.target.value })}
          className="flex-1 min-w-[200px] text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button data-testid="mode-visual" onClick={() => setMode("visual")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === "visual" ? "bg-white shadow-sm text-rose-600" : "text-slate-600"}`}>Visual</button>
          <button data-testid="mode-html" onClick={() => { setRawHtml(generateHtml(blocks)); setMode("html"); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${mode === "html" ? "bg-white shadow-sm text-rose-600" : "text-slate-600"}`}>
            <Code2 className="h-3.5 w-3.5" /> HTML</button>
        </div>
        <button data-testid="preview-btn" onClick={() => setShowPreview(true)}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors">
          <Eye className="h-4 w-4" /> Preview</button>
        <button data-testid="save-btn" onClick={saveManual} disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button>
        <button data-testid="send-btn" onClick={async () => { if (await save()) setShowSend(true); }}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-colors">
          <Send className="h-4 w-4" /> Send</button>
        {autoStatus && (
          <span data-testid="autosave-status" className="flex items-center gap-1.5 text-xs text-slate-400 ml-1">
            {autoStatus === "saving"
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              : <><Check className="h-3.5 w-3.5 text-emerald-500" /> Auto-saved</>}
          </span>
        )}
      </div>

      {mode === "html" ? (
        <div className="grid lg:grid-cols-2 gap-5">
          <textarea data-testid="html-editor" value={rawHtml} onChange={(e) => setRawHtml(e.target.value)}
            className="font-mono text-xs bg-[#0F172A] text-slate-100 rounded-xl p-4 min-h-[560px] outline-none resize-none" />
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <iframe title="preview" srcDoc={rawHtml} className="w-full h-[560px] border-0" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* palette */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sticky top-24">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-3">Blocks</div>
              <div className="grid grid-cols-2 gap-2">
                {PALETTE.map((p) => (
                  <button key={p.type} data-testid={`add-block-${p.type}`} onClick={() => addBlock(p.type)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-slate-200 hover:border-rose-400 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition-colors">
                    <p.icon className="h-5 w-5" />
                    <span className="text-[11px] font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* canvas */}
          <div className="col-span-12 lg:col-span-6">
            <div className="bg-slate-100 rounded-xl p-5 min-h-[560px]">
              {!blocks.length ? (
                <div className="text-center text-slate-400 py-24">
                  <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Add blocks from the left panel</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg overflow-hidden max-w-[600px] mx-auto shadow-sm">
                  {blocks.map((b, idx) => (
                    <div key={b.id} data-testid={`canvas-block-${b.type}`} onClick={() => setSelected(b.id)}
                      onClickCapture={(e) => { const a = e.target.closest && e.target.closest("a"); if (a) e.preventDefault(); }}
                      className={`relative group cursor-pointer transition-all ${selected === b.id ? "ring-2 ring-rose-500 ring-inset" : "hover:ring-1 hover:ring-slate-300 ring-inset"}`}>
                      <div dangerouslySetInnerHTML={{ __html: `<table style="width:100%;border-collapse:collapse">${renderBlock(b)}</table>` }} />
                      {b.type === "logo" && b.props.link && (
                        <div data-testid="logo-redirect-note"
                          className="absolute bottom-1 left-1 flex items-center gap-1 max-w-[90%] bg-slate-900/85 text-white text-[10px] font-medium px-2 py-1 rounded-full backdrop-blur">
                          <Link2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">Redirects to {b.props.link}</span>
                        </div>
                      )}
                      {selected === b.id && (
                        <div className="absolute top-1 right-1 flex gap-1 bg-white rounded-md shadow border border-slate-200 p-0.5">
                          <button onClick={(e) => { e.stopPropagation(); move(idx, -1); }} className="p-1 hover:bg-slate-100 rounded"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); move(idx, 1); }} className="p-1 hover:bg-slate-100 rounded"><ArrowDown className="h-3.5 w-3.5" /></button>
                          <button data-testid={`delete-block-${b.id}`} onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="p-1 hover:bg-rose-50 text-rose-600 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* properties */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sticky top-24">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-3">Properties</div>
              {!sel ? (
                <p className="text-sm text-slate-400">Select a block to edit it.</p>
              ) : (
                <PropsEditor block={sel} update={updateProp} />
              )}
            </div>
          </div>
        </div>
      )}

      {showPreview && <PreviewModal html={html} onClose={() => setShowPreview(false)} />}
      {showSend && campaignId && <SendModal campaignId={campaignId} html={html} onClose={() => setShowSend(false)} onSent={() => navigate(`/campaigns/${campaignId}/analytics`)} />}
      <ProgressOverlay
        open={createProgress}
        title="Newsletter created"
        subtitle="Saving your work…"
        steps={["Saving your newsletter…", "Rendering the email layout…", "Ready to send!"]}
        stepMs={700}
        onComplete={() => setCreateProgress(false)}
      />
    </AppLayout>
  );
}

function L({ children }) { return <label className="block text-[11px] font-medium text-slate-600 mb-1">{children}</label>; }

function TagInserter({ onInsert }) {
  return (
    <div className="mb-3 -mt-1">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5 flex items-center gap-1">
        <User className="h-3 w-3" /> Personalize
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MERGE_TAGS.map((t) => (
          <button key={t.token} type="button" data-testid={`insert-tag-${t.token.replace(/[{}]/g, "")}`}
            onClick={() => onInsert(t.token)}
            className="text-[11px] px-2 py-1 rounded-full bg-[#7380b6]/10 text-[#7380b6] hover:bg-[#7380b6]/20 font-medium clara-trans">
            + {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
function Inp({ testid, value, onChange, placeholder, type = "text" }) {
  return <input data-testid={testid} type={type} value={value ?? ""} placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 mb-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />;
}
function AlignPicker({ value, onChange }) {
  return (
    <div className="flex gap-1 mb-3">
      {["left", "center", "right"].map((a) => (
        <button key={a} onClick={() => onChange(a)}
          className={`flex-1 text-xs py-1.5 rounded-md border capitalize ${value === a ? "bg-rose-50 border-rose-400 text-rose-600" : "border-slate-200 text-slate-500"}`}>{a}</button>
      ))}
    </div>
  );
}

function PropsEditor({ block, update }) {
  const p = block.props;
  switch (block.type) {
    case "title":
      return (<>
        <L>Text</L><Inp testid="prop-text" value={p.text} onChange={(v) => update("text", v)} />
        <TagInserter onInsert={(tok) => update("text", (p.text || "") + tok)} />
        <L>Level</L>
        <div className="flex gap-1 mb-3">
          {["h1", "h2", "h3"].map((lv) => (
            <button key={lv} onClick={() => update("level", lv)}
              className={`flex-1 text-xs py-1.5 rounded-md border uppercase ${p.level === lv ? "bg-rose-50 border-rose-400 text-rose-600" : "border-slate-200 text-slate-500"}`}>{lv}</button>
          ))}
        </div>
        <L>Alignment</L><AlignPicker value={p.align} onChange={(v) => update("align", v)} />
        <L>Color</L><input type="color" value={p.color} onChange={(e) => update("color", e.target.value)} className="w-full h-9 rounded-lg border border-slate-200" />
      </>);
    case "text":
      return (<>
        <L>Text</L>
        <textarea data-testid="prop-text" value={p.text} onChange={(e) => update("text", e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 mb-3 min-h-[120px] focus:ring-2 focus:ring-rose-500 outline-none" />
        <TagInserter onInsert={(tok) => update("text", (p.text || "") + tok)} />
        <L>Alignment</L><AlignPicker value={p.align} onChange={(v) => update("align", v)} />
        <L>Color</L><input type="color" value={p.color} onChange={(e) => update("color", e.target.value)} className="w-full h-9 rounded-lg border border-slate-200" />
      </>);
    case "logo":
      return (<>
        <L>Image URL</L><Inp testid="prop-src" value={p.src} onChange={(v) => update("src", v)} placeholder="https://…/logo.png" />
        <L>Link (optional)</L><Inp value={p.link} onChange={(v) => update("link", v)} placeholder="https://" />
        <L>Width (px)</L><Inp type="number" value={p.width} onChange={(v) => update("width", Number(v))} />
        <L>Alignment</L><AlignPicker value={p.align} onChange={(v) => update("align", v)} />
      </>);
    case "image":
      return (<>
        <L>Image URL</L><Inp testid="prop-src" value={p.src} onChange={(v) => update("src", v)} placeholder="https://…/photo.jpg" />
        <L>Alt text</L><Inp value={p.alt} onChange={(v) => update("alt", v)} />
        <L>Link (optional)</L><Inp value={p.link} onChange={(v) => update("link", v)} placeholder="https://" />
        <L>Width (px)</L><Inp type="number" value={p.width} onChange={(v) => update("width", Number(v))} />
      </>);
    case "button":
      return (<>
        <L>Button text</L><Inp testid="prop-text" value={p.text} onChange={(v) => update("text", v)} />
        <TagInserter onInsert={(tok) => update("text", (p.text || "") + tok)} />
        <L>Link</L><Inp testid="prop-link" value={p.link} onChange={(v) => update("link", v)} placeholder="https://" />
        <L>Background</L><input type="color" value={p.bg} onChange={(e) => update("bg", e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 mb-3" />
        <L>Text color</L><input type="color" value={p.color} onChange={(e) => update("color", e.target.value)} className="w-full h-9 rounded-lg border border-slate-200 mb-3" />
        <L>Corner radius (px)</L><Inp type="number" value={p.radius} onChange={(v) => update("radius", Number(v))} />
        <L>Alignment</L><AlignPicker value={p.align} onChange={(v) => update("align", v)} />
      </>);
    case "divider":
      return (<><L>Color</L><input type="color" value={p.color} onChange={(e) => update("color", e.target.value)} className="w-full h-9 rounded-lg border border-slate-200" /></>);
    case "spacer":
      return (<><L>Height (px)</L><Inp type="number" value={p.height} onChange={(v) => update("height", Number(v))} /></>);
    default:
      return null;
  }
}

function PreviewModal({ html, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-display font-semibold">Preview</h3>
          <button data-testid="close-preview" onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
        </div>
        <iframe title="full-preview" srcDoc={html} className="flex-1 w-full border-0" />
      </div>
    </div>
  );
}

function SendModal({ campaignId, html = "", onClose, onSent }) {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState({});
  const [all, setAll] = useState(true);
  const [sending, setSending] = useState(false);
  const [mailbox, setMailbox] = useState(null);
  const [quota, setQuota] = useState(null);
  const [when, setWhen] = useState("now"); // now | schedule
  const [scheduleAt, setScheduleAt] = useState("");
  const [progress, setProgress] = useState(false);
  const [allCats, setAllCats] = useState([]);
  const [cats, setCats] = useState({});

  useEffect(() => {
    api.get("/contacts").then((r) => setContacts(r.data)).catch(() => {});
    api.get("/mailbox").then((r) => setMailbox(r.data)).catch(() => {});
    api.get("/quota").then((r) => setQuota(r.data)).catch(() => {});
    api.get("/categories").then((r) => setAllCats(r.data)).catch(() => {});
  }, []);

  const catIds = Object.keys(cats).filter((k) => cats[k]);

  const doSend = async () => {
    setSending(true);
    const ids = all ? null : Object.keys(selected).filter((k) => selected[k]);
    const target = catIds.length ? { category_ids: catIds } : { contact_ids: ids };
    try {
      if (when === "schedule") {
        if (!scheduleAt) { toast.error("Please pick a date and time"); setSending(false); return; }
        const iso = new Date(scheduleAt).toISOString();
        await api.post(`/campaigns/${campaignId}/schedule`, { ...target, scheduled_at: iso });
        toast.success(`Campaign scheduled for ${new Date(scheduleAt).toLocaleString()}`);
        onSent();
        return;
      }
      const { data } = await api.post(`/campaigns/${campaignId}/send`, target);
      setProgress(true);
      const mode = data.mode;
      setTimeout(() => toast.success(`Sent to ${data.recipients} recipient(s)${mode === "simulation" ? " (simulation)" : " via Microsoft 365"}`), 100);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      setSending(false);
    }
  };

  const count = catIds.length
    ? contacts.filter((c) => c.status !== "unsubscribed" && (c.categories || []).some((id) => catIds.includes(id))).length
    : all ? contacts.filter((c) => c.status !== "unsubscribed").length : Object.values(selected).filter(Boolean).length;

  // Personalization check: which recipients lack a name the newsletter needs.
  const targetContacts = catIds.length
    ? contacts.filter((c) => c.status !== "unsubscribed" && (c.categories || []).some((id) => catIds.includes(id)))
    : all ? contacts.filter((c) => c.status !== "unsubscribed")
      : contacts.filter((c) => selected[c.id]);
  const needFirst = /\{\{\s*(first_name|name)\s*\}\}/i.test(html);
  const needLast = /\{\{\s*(last_name|name)\s*\}\}/i.test(html);
  const usesName = needFirst || needLast;
  const missingName = targetContacts.filter((c) =>
    (needFirst && !(c.first_name || "").trim()) || (needLast && !(c.last_name || "").trim()));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-display font-semibold text-lg">Send campaign</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {quota && !quota.unlimited && (
            <div className={`mb-4 text-xs rounded-lg p-3 border ${quota.remaining <= 0 ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
              <b className="capitalize">{quota.plan}</b> plan — {quota.used}/{quota.limit} campaigns used in the last {quota.window_days} days.
              {quota.remaining <= 0
                ? " Limit reached — upgrade your license to send more."
                : ` ${quota.remaining} remaining.`}
            </div>
          )}
          {quota && quota.unlimited && (
            <div className="mb-4 text-xs rounded-lg p-3 border bg-emerald-50 border-emerald-200 text-emerald-700">
              <b className="capitalize">{quota.plan}</b> plan — unlimited sending.
            </div>
          )}
          {mailbox && !mailbox.connected && (
            <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3">
              Microsoft 365 is not connected. The campaign will be sent in <b>simulation mode</b> (tracking works, but no real email goes out). Connect your mailbox via Microsoft 365 to send for real.
            </div>
          )}
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" data-testid="send-all-checkbox" checked={all} disabled={catIds.length > 0} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-rose-600" />
            <span className="text-sm text-slate-700">Send to all subscribed contacts</span>
          </label>
          {!all && catIds.length === 0 && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={!!selected[c.id]} onChange={(e) => setSelected({ ...selected, [c.id]: e.target.checked })} className="h-4 w-4 accent-rose-600" />
                  <span className="text-sm text-slate-700">{c.email}</span>
                </label>
              ))}
            </div>
          )}

          {allCats.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">Or target by tag / category</div>
              <div className="flex flex-wrap gap-2">
                {allCats.map((c) => {
                  const on = !!cats[c.id];
                  return (
                    <button key={c.id} type="button" data-testid={`send-cat-${c.id}`}
                      onClick={() => setCats({ ...cats, [c.id]: !on })}
                      className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full clara-trans ${on ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      <span className="h-2 w-2 rounded-full" style={{ background: on ? "#fff" : c.color }} /> {c.name}
                    </button>
                  );
                })}
              </div>
              {catIds.length > 0 && <p className="text-xs text-slate-400 mt-2">Sending to everyone in {catIds.length} selected {catIds.length === 1 ? "tag" : "tags"} — {count} subscribed contact(s).</p>}
            </div>
          )}

          {usesName && missingName.length > 0 && (
            <div data-testid="personalization-warning" className="mt-4 text-xs rounded-lg p-3 border bg-amber-50 border-amber-200 text-amber-800">
              <div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Name can't be personalized for {missingName.length} contact(s)</div>
              <p className="mt-1 leading-relaxed">Your newsletter uses a name field, but these recipients have no name filled in — their greeting will show up blank. Add their name in Contacts to personalize the email.</p>
              <div className="mt-2 max-h-28 overflow-y-auto flex flex-wrap gap-1.5">
                {missingName.map((c) => (
                  <span key={c.id} data-testid={`missing-name-${c.id}`} className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-700">{c.email}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">When</div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-3">
              <button data-testid="send-when-now" onClick={() => setWhen("now")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${when === "now" ? "bg-white shadow-sm text-rose-600" : "text-slate-600"}`}>Send now</button>
              <button data-testid="send-when-schedule" onClick={() => setWhen("schedule")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${when === "schedule" ? "bg-white shadow-sm text-rose-600" : "text-slate-600"}`}>Schedule</button>
            </div>
            {when === "schedule" && (
              <input data-testid="schedule-datetime" type="datetime-local" value={scheduleAt}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
            )}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50">Cancel</button>
          <button data-testid="confirm-send-btn" onClick={doSend} disabled={sending || count === 0}
            className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center gap-2 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {when === "schedule" ? "Schedule" : `Send to ${count}`}
          </button>
        </div>
      </div>
      <ProgressOverlay
        open={progress}
        title="Sending your campaign"
        subtitle="Delivering to your recipients…"
        steps={["Preparing your newsletter…", "Connecting to Microsoft 365…", "Queuing recipients…", "Tracking enabled — all set!"]}
        onComplete={onSent}
      />
    </div>
  );
}
