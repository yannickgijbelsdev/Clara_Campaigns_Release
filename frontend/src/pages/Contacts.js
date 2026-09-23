import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Upload, Plus, Trash2, Search, Users, X, FileSpreadsheet } from "lucide-react";

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", company: "", tags: "" });
  const fileRef = useRef();

  const load = () => api.get("/contacts").then((r) => setContacts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      await api.post("/contacts", { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) });
      toast.success("Contact toegevoegd");
      setShowAdd(false);
      setForm({ email: "", first_name: "", last_name: "", company: "", tags: "" });
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const remove = async (id) => {
    await api.delete(`/contacts/${id}`);
    toast.success("Contact verwijderd");
    load();
  };

  const onFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/contacts/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${data.imported} geïmporteerd, ${data.skipped} overgeslagen`);
      setShowImport(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    e.target.value = "";
  };

  const filtered = contacts.filter((c) =>
    [c.email, c.first_name, c.last_name, c.company].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppLayout title="Contacten">
      <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input data-testid="contact-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek contacten…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-72 focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div className="flex gap-2">
          <button data-testid="import-csv-btn" onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Upload className="h-4 w-4" /> CSV importeren
          </button>
          <button data-testid="add-contact-btn" onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            <Plus className="h-4 w-4" /> Contact
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {!filtered.length ? (
          <div className="p-16 text-center text-slate-400">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-sm">Nog geen contacten. Voeg toe of importeer een CSV.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-medium">E-mail</th>
                <th className="text-left px-5 py-3 font-medium">Naam</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Bedrijf</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Tags</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} data-testid={`contact-row-${c.id}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-800">{c.email}</td>
                  <td className="px-5 py-3 text-slate-600">{`${c.first_name || ""} ${c.last_name || ""}`.trim() || "—"}</td>
                  <td className="px-5 py-3 text-slate-600 hidden md:table-cell">{c.company || "—"}</td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {(c.tags || []).map((t) => (
                        <span key={t} className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button data-testid={`delete-contact-${c.id}`} onClick={() => remove(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <Modal title="Contact toevoegen" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <F label="E-mail *" testid="new-email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Voornaam"><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inp} /></F>
              <F label="Achternaam"><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inp} /></F>
            </div>
            <F label="Bedrijf"><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inp} /></F>
            <F label="Tags (komma-gescheiden)"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={inp} placeholder="klant, nieuwsbrief" /></F>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Annuleren</button>
            <button data-testid="save-contact-btn" onClick={add} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Opslaan</button>
          </div>
        </Modal>
      )}

      {showImport && (
        <Modal title="CSV importeren" onClose={() => setShowImport(false)}>
          <div data-testid="csv-dropzone" onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-slate-400" />
            <p className="text-sm text-slate-600 font-medium">Klik om een CSV-bestand te kiezen</p>
            <p className="text-xs text-slate-400 mt-1">Kolommen: email, first_name, last_name, company, tags</p>
            <input ref={fileRef} data-testid="csv-file-input" type="file" accept=".csv" className="hidden" onChange={onFile} />
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}

const inp = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";
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
