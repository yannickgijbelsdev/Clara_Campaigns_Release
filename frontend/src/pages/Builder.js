import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { generateHtml, BLOCK_DEFAULTS, renderBlock } from "@/lib/emailHtml";
import { toast } from "sonner";
import {
  Type, AlignLeft, Image as ImageIcon, MousePointer, Minus, Space, Images,
  Save, Send, Code2, Eye, Trash2, ArrowUp, ArrowDown, Loader2, X,
} from "lucide-react";

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

  useEffect(() => {
    if (!isNew) {
      api.get(`/campaigns/${id}`).then((r) => {
        setMeta({ name: r.data.name, subject: r.data.subject || "", preheader: r.data.preheader || "" });
        setBlocks(r.data.blocks || []);
        setRawHtml(r.data.html || "");
      }).catch(() => toast.error("Campaign not found"));
    }
  }, [id]);

  const html = useMemo(() => (mode === "html" ? rawHtml : generateHtml(blocks)), [blocks, mode, rawHtml]);

  const addBlock = (type) => {
    const b = { id: uid(), type, props: { ...BLOCK_DEFAULTS[type] } };
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
    const payload = { ...meta, blocks, html: generateHtml(blocks) };
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
        <button data-testid="save-btn" onClick={save} disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button>
        <button data-testid="send-btn" onClick={async () => { if (await save()) setShowSend(true); }}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-colors">
          <Send className="h-4 w-4" /> Send</button>
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
                      className={`relative group cursor-pointer transition-all ${selected === b.id ? "ring-2 ring-rose-500 ring-inset" : "hover:ring-1 hover:ring-slate-300 ring-inset"}`}>
                      <div dangerouslySetInnerHTML={{ __html: `<table style="width:100%;border-collapse:collapse">${renderBlock(b)}</table>` }} />
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
      {showSend && campaignId && <SendModal campaignId={campaignId} onClose={() => setShowSend(false)} onSent={() => navigate(`/campaigns/${campaignId}/analytics`)} />}
    </AppLayout>
  );
}

function L({ children }) { return <label className="block text-[11px] font-medium text-slate-600 mb-1">{children}</label>; }
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

function SendModal({ campaignId, onClose, onSent }) {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState({});
  const [all, setAll] = useState(true);
  const [sending, setSending] = useState(false);
  const [mailbox, setMailbox] = useState(null);

  useEffect(() => {
    api.get("/contacts").then((r) => setContacts(r.data)).catch(() => {});
    api.get("/mailbox").then((r) => setMailbox(r.data)).catch(() => {});
  }, []);

  const doSend = async () => {
    setSending(true);
    const ids = all ? null : Object.keys(selected).filter((k) => selected[k]);
    try {
      const { data } = await api.post(`/campaigns/${campaignId}/send`, { contact_ids: ids });
      toast.success(`Campaign sending to ${data.recipients} recipient(s)${data.mode === "simulation" ? " (simulation)" : " via Office 365"}`);
      onSent();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      setSending(false);
    }
  };

  const count = all ? contacts.length : Object.values(selected).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-display font-semibold text-lg">Send campaign</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {mailbox && !mailbox.connected && (
            <div className="mb-4 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-3">
              Office 365 is not connected. The campaign will be sent in <b>simulation mode</b> (tracking works, but no real email goes out). Connect your mailbox via Office 365 to send for real.
            </div>
          )}
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" data-testid="send-all-checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-rose-600" />
            <span className="text-sm text-slate-700">Send to all contacts ({contacts.length})</span>
          </label>
          {!all && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={!!selected[c.id]} onChange={(e) => setSelected({ ...selected, [c.id]: e.target.checked })} className="h-4 w-4 accent-rose-600" />
                  <span className="text-sm text-slate-700">{c.email}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50">Cancel</button>
          <button data-testid="confirm-send-btn" onClick={doSend} disabled={sending || count === 0}
            className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center gap-2 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to {count}
          </button>
        </div>
      </div>
    </div>
  );
}
