import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Search, Users, X, FileSpreadsheet, Download, History } from "lucide-react";
import { BearLoader } from "@/components/BearLoader";
import { withMinDelay } from "@/lib/useLoadingGate";

export default function Contacts() {
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", company: "", tags: "" });
  const fileRef = useRef();
  const [historyView, setHistoryView] = useState(null); // { contact, items }
  const [group, setGroup] = useState("all"); // all | subscribed | unsubscribed
  const [catMap, setCatMap] = useState({});
  const [importing, setImporting] = useState(false);
  const confirm = useConfirm();

  const load = () => api.get("/contacts").then((r) => setContacts(r.data)).catch(() => {});
  useEffect(() => {
    load();
    api.get("/categories").then((r) => {
      const m = {}; r.data.forEach((c) => { m[c.id] = c.name; }); setCatMap(m);
    }).catch(() => {});
  }, []);

  const SOURCE_LABEL = { imported: "Imported", subscribe_form: "Form", manual: "Manual" };
  const contactTags = (c) => {
    const out = [];
    out.push({ label: c.status === "unsubscribed" ? "Unsubscribed" : "Subscribed", kind: c.status === "unsubscribed" ? "unsub" : "sub" });
    if (c.source && SOURCE_LABEL[c.source]) out.push({ label: SOURCE_LABEL[c.source], kind: "source" });
    (c.categories || []).forEach((id) => catMap[id] && out.push({ label: catMap[id], kind: "cat" }));
    (c.tags || []).forEach((t) => out.push({ label: t, kind: "tag" }));
    return out;
  };
  const TAG_CLS = {
    sub: "bg-emerald-50 text-emerald-600", unsub: "bg-rose-50 text-rose-600",
    source: "bg-slate-100 text-slate-500", cat: "bg-indigo-50 text-indigo-600", tag: "bg-amber-50 text-amber-600",
  };

  const add = async () => {
    try {
      await api.post("/contacts", { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) });
      toast.success("Contact added");
      setShowAdd(false);
      setForm({ email: "", first_name: "", last_name: "", company: "", tags: "" });
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const remove = async (id) => {
    await api.delete(`/contacts/${id}`);
    toast.success("Contact removed");
    load();
  };

  const onFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const start = Date.now();
    setImporting(true);
    try {
      const { data } = await withMinDelay(
        api.post("/contacts/import", fd, { headers: { "Content-Type": "multipart/form-data" } }),
        start, 4000);
      toast.success(`${data.imported} imported, ${data.skipped} skipped`);
      setShowImport(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setImporting(false);
    }
    e.target.value = "";
  };

  const exportCsv = () => {
    if (!contacts.length) return toast.error("No contacts to export");
    const header = ["email", "first_name", "last_name", "company", "tags"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [header, ...contacts.map((c) => [c.email, c.first_name, c.last_name, c.company, (c.tags || []).join("|")])];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "contacts.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${contacts.length} contacts`);
  };

  const deleteAll = async () => {
    if (!contacts.length) return;
    if (!(await confirm({ title: "Delete all contacts?", message: `This permanently removes all ${contacts.length} contacts. This cannot be undone.`, confirmText: "Delete all" }))) return;
    try {
      const { data } = await api.delete("/contacts");
      toast.success(`Deleted ${data.deleted} contacts`);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const openHistory = async (c) => {
    try {
      const { data } = await api.get(`/contacts/${c.id}/history`);
      setHistoryView({ contact: c, items: data });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const isUnsub = (c) => c.status === "unsubscribed";
  const subCount = contacts.filter((c) => !isUnsub(c)).length;
  const unsubCount = contacts.filter(isUnsub).length;

  const filtered = contacts.filter((c) => {
    if (group === "subscribed" && isUnsub(c)) return false;
    if (group === "unsubscribed" && !isUnsub(c)) return false;
    return [c.email, c.first_name, c.last_name, c.company].join(" ").toLowerCase().includes(q.toLowerCase());
  });

  const actions = (
    <div className="flex gap-2">
      <button data-testid="export-csv-btn" onClick={exportCsv}
        className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors">
        <Download className="h-4 w-4" /> Export
      </button>
      <button data-testid="import-csv-btn" onClick={() => setShowImport(true)}
        className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors">
        <Upload className="h-4 w-4" /> Import CSV
      </button>
      <button data-testid="delete-all-btn" onClick={deleteAll}
        className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-rose-200 text-rose-600 rounded-full hover:bg-rose-50 transition-colors">
        <Trash2 className="h-4 w-4" /> Delete all
      </button>
      <button data-testid="add-contact-btn" onClick={() => setShowAdd(true)}
        className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-colors">
        <Plus className="h-4 w-4" /> Contact
      </button>
    </div>
  );

  return (
    <AppLayout title="Contacts" subtitle={`${contacts.length} recipient(s)`} actions={actions}>
      <BearLoader open={importing} label="Importing your contacts…" />
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
          {[["all", "All", contacts.length], ["subscribed", "Subscribed", subCount], ["unsubscribed", "Unsubscribed", unsubCount]].map(([id, label, n]) => (
            <button key={id} data-testid={`group-tab-${id}`} onClick={() => setGroup(id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium clara-trans ${group === id ? "bg-white shadow-sm text-rose-600" : "text-slate-500 hover:text-slate-700"}`}>
              {label} <span className={`text-xs ${group === id ? "text-rose-400" : "text-slate-400"}`}>{n}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input data-testid="contact-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-full text-sm w-full focus:ring-2 focus:ring-rose-500 outline-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!filtered.length ? (
          <div className="p-16 text-center text-slate-400">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-sm">No contacts yet. Add one or import a CSV.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Email</th>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Company</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Tags</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} data-testid={`contact-row-${c.id}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-800">
                    <div className="flex items-center gap-2">{c.email}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{`${c.first_name || ""} ${c.last_name || ""}`.trim() || "—"}</td>
                  <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{c.company || "—"}</td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {contactTags(c).map((t, i) => (
                        <span key={i} data-testid={`contact-tag-${c.id}`} className={`text-[11px] px-2 py-0.5 rounded-full ${TAG_CLS[t.kind]}`}>{t.label}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button data-testid={`history-contact-${c.id}`} onClick={() => openHistory(c)} title="Campaign history"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <History className="h-4 w-4" />
                      </button>
                      <button data-testid={`delete-contact-${c.id}`} onClick={() => remove(c.id)} title="Delete"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <Modal title="Add contact" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <F label="Email *" testid="new-email"><input data-testid="new-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="First name"><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inp} /></F>
              <F label="Last name"><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inp} /></F>
            </div>
            <F label="Company"><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inp} /></F>
            <F label="Tags (comma-separated)"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={inp} placeholder="customer, newsletter" /></F>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50">Cancel</button>
            <button data-testid="save-contact-btn" onClick={add} className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-full">Save</button>
          </div>
        </Modal>
      )}

      {showImport && (
        <Modal title="Import CSV" onClose={() => setShowImport(false)}>
          <div data-testid="csv-dropzone" onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-rose-400 hover:bg-rose-50/40 transition-colors">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-slate-400" />
            <p className="text-sm text-slate-600 font-medium">Click to choose a CSV file</p>
            <p className="text-xs text-slate-400 mt-1">Columns: email, first_name, last_name, company, tags</p>
            <input ref={fileRef} data-testid="csv-file-input" type="file" accept=".csv" className="hidden" onChange={onFile} />
          </div>
        </Modal>
      )}

      {historyView && (
        <Modal title={`Campaign history — ${historyView.contact.email}`} onClose={() => setHistoryView(null)}>
          {!historyView.items.length ? (
            <p className="text-sm text-slate-400 py-6 text-center">This contact hasn't received any campaigns yet.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {historyView.items.map((h, i) => (
                <div key={i} data-testid={`history-row-${i}`} className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{h.campaign}</div>
                    <div className="text-xs text-slate-400">{h.sent_at ? new Date(h.sent_at).toLocaleString() : "—"}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs shrink-0">
                    {h.opened
                      ? <span className="text-emerald-600 font-medium bg-emerald-50 rounded-full px-2 py-0.5">Opened{h.open_count ? ` ${h.open_count}×` : ""}</span>
                      : <span className="text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">Not opened</span>}
                    {h.clicked && <span className="text-amber-600 font-medium bg-amber-50 rounded-full px-2 py-0.5">Clicked</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </AppLayout>
  );
}

const inp = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none";
function F({ label, children }) { return <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>{children}</div>; }
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
