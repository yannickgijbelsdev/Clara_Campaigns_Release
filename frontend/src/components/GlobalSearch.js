import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { Search, Mail, User, CornerDownLeft, Command } from "lucide-react";

const DOT = { sent: "bg-emerald-500", draft: "bg-slate-400", sending: "bg-amber-500", scheduled: "bg-sky-500", failed: "bg-rose-500" };

export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setQ(""); setActive(0);
    Promise.all([
      api.get("/campaigns").then((r) => r.data).catch(() => []),
      api.get("/contacts").then((r) => r.data).catch(() => []),
    ]).then(([c, ct]) => { setCampaigns(c); setContacts(ct); });
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const camp = campaigns
      .filter((c) => !term || [c.name, c.subject].join(" ").toLowerCase().includes(term))
      .slice(0, 6)
      .map((c) => ({ type: "campaign", id: c.id, title: c.name || c.subject || "Untitled", sub: c.subject, status: c.status }));
    const cont = contacts
      .filter((c) => !term || [c.email, c.first_name, c.last_name, c.company].join(" ").toLowerCase().includes(term))
      .slice(0, 6)
      .map((c) => ({ type: "contact", id: c.id, title: c.email, sub: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.company || "", email: c.email }));
    return [...camp, ...cont];
  }, [q, campaigns, contacts]);

  useEffect(() => { setActive(0); }, [q]);

  const go = (item) => {
    if (!item) return;
    onClose();
    if (item.type === "campaign") navigate(`/campaigns/${item.id}/analytics`);
    else navigate(`/contacts?q=${encodeURIComponent(item.email)}`);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
    else if (e.key === "Escape") { onClose(); }
  };

  const campResults = results.filter((r) => r.type === "campaign");
  const contResults = results.filter((r) => r.type === "contact");

  const Row = ({ item, idx }) => (
    <button
      data-testid={`search-result-${item.type}-${item.id}`}
      onMouseEnter={() => setActive(idx)}
      onClick={() => go(item)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left clara-trans ${active === idx ? "bg-rose-50" : "hover:bg-slate-50"}`}
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 shrink-0">
        {item.type === "campaign" ? <Mail className="h-4 w-4 text-slate-500" /> : <User className="h-4 w-4 text-slate-500" />}
        {item.type === "campaign" && <span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${DOT[item.status] || DOT.draft}`} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{item.title}</div>
        {item.sub && <div className="text-xs text-slate-400 truncate">{item.sub}</div>}
      </div>
      {item.type === "campaign" && <span className="text-[11px] font-semibold capitalize text-slate-400">{item.status}</span>}
      {active === idx && <CornerDownLeft className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
    </button>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-slate-900/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            data-testid="global-search-modal"
            className="w-full max-w-xl bg-white rounded-3xl clara-soft shadow-2xl shadow-slate-900/20 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <Search className="h-5 w-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                data-testid="global-search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Search campaigns and contacts…"
                className="flex-1 text-[15px] bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
              />
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 rounded-md px-2 py-1">esc</span>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {!results.length ? (
                <div className="px-4 py-12 text-center text-slate-400">
                  <Command className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">{q ? `No matches for “${q}”.` : "Start typing to search."}</p>
                </div>
              ) : (
                <>
                  {campResults.length > 0 && (
                    <div className="mb-1">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold px-3 py-1.5">Campaigns</div>
                      {campResults.map((item) => <Row key={`c-${item.id}`} item={item} idx={results.indexOf(item)} />)}
                    </div>
                  )}
                  {contResults.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold px-3 py-1.5">Contacts</div>
                      {contResults.map((item) => <Row key={`ct-${item.id}`} item={item} idx={results.indexOf(item)} />)}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> to open</span>
              <span className="flex items-center gap-1">↑ ↓ to navigate</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
