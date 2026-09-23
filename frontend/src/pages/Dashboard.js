import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout, { PrimaryButton } from "@/components/AppLayout";
import api from "@/lib/api";
import { Send, Users, MailOpen, MousePointerClick, TrendingUp, ArrowUpRight, Plus } from "lucide-react";

const STATUS = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  sending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => {});
  }, []);

  const cards = [
    { label: "Campaigns", value: data?.total_campaigns ?? 0, icon: Send, color: "rose" },
    { label: "Contacts", value: data?.total_contacts ?? 0, icon: Users, color: "sky" },
    { label: "Sent", value: data?.total_sent ?? 0, icon: TrendingUp, color: "violet" },
    { label: "Open rate", value: `${data?.open_rate ?? 0}%`, sub: `${data?.total_opened ?? 0} opened`, icon: MailOpen, color: "emerald" },
    { label: "Click rate", value: `${data?.click_rate ?? 0}%`, sub: `${data?.total_clicked ?? 0} clicked`, icon: MousePointerClick, color: "amber" },
  ];

  const colorMap = {
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <AppLayout title="Dashboard" subtitle="Your newsletter performance at a glance"
      actions={<PrimaryButton testid="new-campaign-btn" icon={Plus} onClick={() => navigate("/campaigns/new")}>New campaign</PrimaryButton>}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((c, i) => (
          <div key={c.label} data-testid={`stat-${c.label}`}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm clara-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${colorMap[c.color]}`}>
              <c.icon className="h-[18px] w-[18px]" />
            </div>
            <div className="text-2xl font-display font-bold text-slate-900">{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
            {c.sub && <div className="text-[11px] text-slate-400 mt-1">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">Recent campaigns</h2>
          <button onClick={() => navigate("/campaigns")} className="text-sm text-rose-600 font-medium hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {!data?.recent_campaigns?.length ? (
          <div className="p-12 text-center text-slate-400">
            <Send className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No campaigns yet. Create your first newsletter!</p>
            <button data-testid="empty-new-campaign" onClick={() => navigate("/campaigns/new")}
              className="mt-4 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-full">
              New campaign
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.recent_campaigns.map((c) => (
              <div key={c.id} data-testid={`recent-${c.id}`}
                onClick={() => navigate(`/campaigns/${c.id}/analytics`)}
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
                <div>
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.subject || "No subject"}</div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm text-slate-700">{c.sent} sent</div>
                    <div className="text-xs text-slate-400">{c.opened} open · {c.clicked} click</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border capitalize ${STATUS[c.status] || STATUS.draft}`}>
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
