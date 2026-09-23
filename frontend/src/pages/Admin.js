import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { ShieldCheck, Users, Building2, Trash2, BadgeCheck, Ban, Crown, X, Check } from "lucide-react";

const PLANS = ["free", "pro", "enterprise"];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [assign, setAssign] = useState(null); // { user, selected:[] }
  const confirm = useConfirm();

  const load = () => {
    api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
    api.get("/companies").then((r) => setCompanies(r.data)).catch(() => {});
  };
  useEffect(() => { if (user?.role === "admin") load(); }, [user]);

  if (user && user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const saveAssign = async () => {
    try {
      await api.patch(`/admin/users/${assign.user.id}/companies`, { company_ids: assign.selected });
      toast.success("Workspaces updated");
      setAssign(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };
  const toggleSel = (cid) => setAssign((a) => ({
    ...a, selected: a.selected.includes(cid) ? a.selected.filter((x) => x !== cid) : [...a.selected, cid],
  }));

  const setLicense = async (u, plan, active) => {
    try {
      await api.patch(`/admin/users/${u.id}/license`, { plan, active });
      toast.success(active ? `License assigned (${plan})` : "License revoked");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const removeCompany = async (id) => {
    if (!(await confirm({ title: "Delete company?", message: "This deletes the company and all its campaigns, contacts and data.", confirmText: "Delete" }))) return;
    await api.delete(`/companies/${id}`);
    toast.success("Company deleted");
    load();
  };

  return (
    <AppLayout title="Administration" subtitle="Manage users, licenses and companies">
      <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 w-fit mb-6">
        {[["users", "Users", Users], ["companies", "Companies", Building2]].map(([id, label, Icon]) => (
          <button key={id} data-testid={`admin-tab-${id}`} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === id ? "bg-white shadow-sm text-rose-600" : "text-slate-600"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-6 py-3 font-medium">User</th>
                <th className="text-left px-6 py-3 font-medium">Role</th>
                <th className="text-left px-6 py-3 font-medium">License</th>
                <th className="text-left px-6 py-3 font-medium">Workspaces</th>
                <th className="text-right px-6 py-3 font-medium">Assign license</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u, i) => (
                <motion.tr key={u.id} data-testid={`admin-user-${u.id}`}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-semibold">
                        {(u.name || u.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-slate-800 font-medium flex items-center gap-1.5">
                          {u.name}{u.role === "admin" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                        </div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3 capitalize text-slate-600">{u.role}</td>
                  <td className="px-6 py-3">
                    {u.license?.active ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                        <BadgeCheck className="h-3.5 w-3.5" /> {u.license.plan}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        <Ban className="h-3.5 w-3.5" /> No license
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <button data-testid={`assign-companies-${u.id}`}
                      onClick={() => setAssign({ user: u, selected: [...(u.member_of || [])] })}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 rounded-full hover:bg-slate-50 text-slate-600">
                      <Building2 className="h-3.5 w-3.5" /> {(u.member_of || []).length} linked
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <select data-testid={`license-plan-${u.id}`} defaultValue={u.license?.plan || "pro"}
                        onChange={(e) => setLicense(u, e.target.value, true)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-rose-500 capitalize">
                        {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      {u.license?.active ? (
                        <button data-testid={`revoke-license-${u.id}`} onClick={() => setLicense(u, u.license.plan, false)}
                          className="text-xs px-3 py-1.5 border border-slate-200 rounded-full hover:bg-slate-50 text-slate-600">Revoke</button>
                      ) : (
                        <button data-testid={`assign-license-${u.id}`}
                          onClick={() => setLicense(u, document.querySelector(`[data-testid="license-plan-${u.id}"]`).value, true)}
                          className="text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full">Assign</button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c, i) => (
            <motion.div key={c.id} data-testid={`admin-company-${c.id}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white flex items-center justify-center font-bold text-lg">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <button data-testid={`delete-company-${c.id}`} onClick={() => removeCompany(c.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="font-display font-semibold text-slate-900 mt-3">{c.name}</div>
              <div className="text-xs text-slate-500 mt-1">{c.campaigns} campaigns · {c.contacts} contacts</div>
            </motion.div>
          ))}
        </div>
      )}

      {assign && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAssign(null)}>
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(e) => e.stopPropagation()} data-testid="assign-companies-modal"
            className="bg-white rounded-3xl clara-soft w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-display font-semibold text-lg text-slate-900">Link workspaces</h3>
              <button onClick={() => setAssign(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Choose which companies <b>{assign.user.name || assign.user.email}</b> can access.</p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {companies.map((c) => {
                const owned = c.owner_id === assign.user.id;
                const checked = owned || assign.selected.includes(c.id);
                return (
                  <button key={c.id} data-testid={`assign-company-${c.id}`} disabled={owned} onClick={() => !owned && toggleSel(c.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left clara-trans ${owned ? "opacity-60 cursor-default" : "hover:bg-slate-50"}`}>
                    <span className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${checked ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {c.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800 truncate">{c.name}</div>
                      {owned && <div className="text-[11px] text-slate-400">Owner</div>}
                    </div>
                    {checked && <Check className="h-4 w-4 text-rose-600" />}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setAssign(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50">Cancel</button>
              <button data-testid="save-assign-companies-btn" onClick={saveAssign} className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-full">Save</button>
            </div>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
