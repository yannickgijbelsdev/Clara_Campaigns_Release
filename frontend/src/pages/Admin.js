import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { ShieldCheck, Users, Building2, Trash2, BadgeCheck, Ban, Crown } from "lucide-react";

const PLANS = ["free", "pro", "enterprise"];

export default function Admin() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);

  const load = () => {
    api.get("/admin/users").then((r) => setUsers(r.data)).catch(() => {});
    api.get("/companies").then((r) => setCompanies(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

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
    if (!window.confirm("Delete this company and all its data?")) return;
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
    </AppLayout>
  );
}
