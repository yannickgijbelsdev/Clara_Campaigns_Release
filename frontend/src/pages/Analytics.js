import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowLeft, Send, MailOpen, MousePointerClick, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

const STATUS = {
  sent: "bg-emerald-50 text-emerald-700",
  sending: "bg-amber-50 text-amber-700",
  failed: "bg-rose-50 text-rose-700",
};

export default function Analytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = () => api.get(`/campaigns/${id}/stats`).then((r) => setData(r.data)).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  if (!data) return <AppLayout title="Analytics"><div className="text-slate-400">Loading…</div></AppLayout>;

  const t = data.totals;
  const chart = [
    { name: "Sent", value: t.sent, color: "#E11D48" },
    { name: "Opened", value: t.opened, color: "#10B981" },
    { name: "Clicked", value: t.clicked, color: "#F59E0B" },
  ];
  const cards = [
    { label: "Sent", value: t.sent, icon: Send, color: "text-rose-600 bg-rose-50" },
    { label: "Opened", value: `${t.opened} (${t.open_rate}%)`, icon: MailOpen, color: "text-emerald-600 bg-emerald-50" },
    { label: "Clicked", value: `${t.clicked} (${t.click_rate}%)`, icon: MousePointerClick, color: "text-amber-600 bg-amber-50" },
    { label: "Failed", value: t.failed, icon: AlertCircle, color: "text-rose-600 bg-rose-50" },
  ];

  return (
    <AppLayout title="Campaign Analytics" subtitle={data.campaign.name}>
      <button onClick={() => navigate("/campaigns")} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to campaigns
      </button>

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">{data.campaign.subject}</p>
        <div className="flex items-center gap-2">
          {data.campaign.simulated && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Simulation mode</span>
          )}
          <button onClick={load} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} data-testid={`analytics-stat-${c.label}`} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${c.color}`}><c.icon className="h-[18px] w-[18px]" /></div>
            <div className="text-xl font-display font-bold text-slate-900">{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-display font-semibold text-slate-900 mb-4">Overview</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#F1F5F9" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chart.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-display font-semibold text-slate-900 mb-4">Top clicked links</h3>
          {!data.top_links.length ? (
            <p className="text-sm text-slate-400">No clicks yet.</p>
          ) : (
            <div className="space-y-2">
              {data.top_links.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <a href={l.url} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline truncate flex items-center gap-1 max-w-[70%]">
                    <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{l.url}</span>
                  </a>
                  <span className="text-slate-700 font-medium">{l.clicks}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-display font-semibold text-slate-900">Recipients ({data.recipients.length})</h3>
        </div>
        {!data.recipients.length ? (
          <div className="p-10 text-center text-slate-400 text-sm">Not sent yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Recipient</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-center px-6 py-3 font-medium">Opened</th>
                <th className="text-center px-6 py-3 font-medium">Clicked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recipients.map((r, i) => (
                <tr key={i} data-testid={`recipient-row-${i}`} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <div className="text-slate-800">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.email}</div>
                  </td>
                  <td className="px-6 py-3"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS[r.status] || "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                  <td className="px-6 py-3 text-center">{r.opened ? <span className="text-emerald-600 font-medium">✓ {r.open_count}×</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-6 py-3 text-center">{r.clicked ? <span className="text-amber-600 font-medium">✓ {r.click_count}×</span> : <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
