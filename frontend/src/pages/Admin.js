import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { ShieldCheck, Users, Building2, Trash2, BadgeCheck, Ban, Crown, X, Check, Pencil, KeyRound } from "lucide-react";

const PLANS = ["free", "pro", "enterprise"];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [assign, setAssign] = useState(null); // { user, selected:[] }
  const [editUser, setEditUser] = useState(null); // { id, name, email, role }
  const [editCompany, setEditCompany] = useState(null); // { id, name }
  const [savingEdit, setSavingEdit] = useState(false);
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

  const saveUser = async () => {
    setSavingEdit(true);
    try {
      await api.patch(`/admin/users/${editUser.id}`, {
        name: editUser.name, email: editUser.email, role: editUser.role,
      });
      toast.success("User updated");
      setEditUser(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setSavingEdit(false);
  };

  const deleteUser = async (u) => {
    if (!(await confirm({
      title: "Delete user?",
      message: `This permanently deletes ${u.name || u.email}, plus any workspaces they own and all that data. This cannot be undone.`,
      confirmText: "Delete user",
    }))) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("User deleted");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const sendReset = async (u) => {
    if (!(await confirm({
      title: "Send password reset?",
      message: `A password reset link will be emailed to ${u.email}.`,
      confirmText: "Send link",
    }))) return;
    try {
      await api.post(`/admin/users/${u.id}/send-reset`);
      toast.success(`Reset link sent to ${u.email}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const saveCompany = async () => {
    setSavingEdit(true);
    try {
      await api.patch(`/admin/companies/${editCompany.id}`, { name: editCompany.name });
      toast.success("Company renamed");
      setEditCompany(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setSavingEdit(false);
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
                <th className="text-right px-6 py-3 font-medium">Actions</th>
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
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button data-testid={`edit-user-${u.id}`} title="Edit user"
                        onClick={() => setEditUser({ id: u.id, name: u.name || "", email: u.email, role: u.role || "user" })}
                        className="p-2 text-slate-400 hover:text-[#7380b6] hover:bg-[#7380b6]/10 rounded-lg clara-trans"><Pencil className="h-4 w-4" /></button>
                      <button data-testid={`reset-user-${u.id}`} title="Send password reset"
                        onClick={() => sendReset(u)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg clara-trans"><KeyRound className="h-4 w-4" /></button>
                      <button data-testid={`delete-user-${u.id}`} title="Delete user"
                        onClick={() => deleteUser(u)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg clara-trans"><Trash2 className="h-4 w-4" /></button>
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
                <div className="flex items-center gap-1">
                  <button data-testid={`edit-company-${c.id}`} title="Rename company" onClick={() => setEditCompany({ id: c.id, name: c.name })}
                    className="p-1.5 text-slate-400 hover:text-[#7380b6] hover:bg-[#7380b6]/10 rounded-lg"><Pencil className="h-4 w-4" /></button>
                  <button data-testid={`delete-company-${c.id}`} onClick={() => removeCompany(c.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                </div>
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
      {editUser && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(e) => e.stopPropagation()} data-testid="edit-user-modal"
            className="bg-white rounded-3xl clara-soft w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-semibold text-lg text-slate-900">Edit user</h3>
              <button onClick={() => setEditUser(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Name</label>
                <input data-testid="edit-user-name" value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Email</label>
                <input data-testid="edit-user-email" type="email" value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Role</label>
                <select data-testid="edit-user-role" value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6] capitalize">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50">Cancel</button>
              <button data-testid="save-user-btn" onClick={saveUser} disabled={savingEdit}
                className="px-4 py-2 text-sm bg-[#7380b6] hover:opacity-90 text-white rounded-full disabled:opacity-60">Save changes</button>
            </div>
          </motion.div>
        </div>
      )}

      {editCompany && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditCompany(null)}>
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={(e) => e.stopPropagation()} data-testid="edit-company-modal"
            className="bg-white rounded-3xl clara-soft w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-semibold text-lg text-slate-900">Rename company</h3>
              <button onClick={() => setEditCompany(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Company name</label>
            <input data-testid="edit-company-name" value={editCompany.name}
              onChange={(e) => setEditCompany({ ...editCompany, name: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditCompany(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50">Cancel</button>
              <button data-testid="save-company-btn" onClick={saveCompany} disabled={savingEdit || !editCompany.name.trim()}
                className="px-4 py-2 text-sm bg-[#7380b6] hover:opacity-90 text-white rounded-full disabled:opacity-60">Save</button>
            </div>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
