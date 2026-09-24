import { useEffect, useMemo, useState } from "react";
import { format, subDays, parseISO } from "date-fns";
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Send, MailOpen, MousePointerClick, UserPlus, UserMinus,
  FlaskConical, AlertCircle, Percent, Loader2, CalendarDays,
} from "lucide-react";
import api from "@/lib/api";
import { Calendar } from "@/components/ui/calendar";

const SEND_TYPE_META = {
  all: { label: "All subscribers", color: "#7380b6" },
  category: { label: "By category", color: "#10B981" },
  contacts: { label: "Selected contacts", color: "#F59E0B" },
  test: { label: "Test sends", color: "#38BDF8" },
  other: { label: "Other / legacy", color: "#CBD5E1" },
};
const PRESETS = [{ label: "7 days", days: 7 }, { label: "30 days", days: 30 }, { label: "90 days", days: 90 }];

function Kpi({ icon: Icon, label, value, sub, color, testid }) {
  return (
    <div data-testid={testid} className="bg-white rounded-2xl clara-soft p-4">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2.5 ${color}`}><Icon className="h-[18px] w-[18px]" /></div>
      <div className="text-2xl font-display font-bold text-slate-900 leading-none">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}{sub ? <span className="text-slate-400"> · {sub}</span> : null}</div>
    </div>
  );
}

function Panel({ title, action, children, testid }) {
  return (
    <div data-testid={testid} className="bg-white rounded-3xl clara-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsPanel() {
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState("");
  const [cats, setCats] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [month, setMonth] = useState(new Date());

  const to = format(new Date(), "yyyy-MM-dd");
  const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  useEffect(() => { api.get("/categories").then((r) => setCats(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    api.get(`/analytics?from=${from}&to=${to}${category ? `&category=${category}` : ""}`)
      .then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, category]);

  const t = data?.totals;
  const shortDate = (d) => { try { return format(parseISO(d), "MMM d"); } catch { return d; } };

  const sendTypeData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.send_types)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: SEND_TYPE_META[k]?.label || k, value: v, color: SEND_TYPE_META[k]?.color || "#CBD5E1" }));
  }, [data]);

  const campaignBars = useMemo(() => (data?.per_campaign || []).slice(0, 8).map((c) => ({
    name: c.name.length > 18 ? c.name.slice(0, 18) + "…" : c.name,
    open_rate: c.open_rate, click_rate: c.click_rate, send_type: c.send_type,
  })), [data]);

  // Calendar heatmap
  const { modifiers, modifiersClassNames } = useMemo(() => {
    const byDay = data?.by_day || {};
    const maxSent = Math.max(1, ...Object.values(byDay).map((v) => v.sent || 0));
    const b1 = [], b2 = [], b3 = [];
    Object.entries(byDay).forEach(([d, v]) => {
      const s = v.sent || 0;
      if (!s) return;
      const day = parseISO(d + "T00:00:00");
      const r = s / maxSent;
      (r <= 0.34 ? b1 : r <= 0.67 ? b2 : b3).push(day);
    });
    return {
      modifiers: { heat1: b1, heat2: b2, heat3: b3 },
      modifiersClassNames: {
        heat1: "bg-[#7380b6]/20 text-slate-900 font-semibold rounded-md",
        heat2: "bg-[#7380b6]/50 text-white font-semibold rounded-md",
        heat3: "bg-[#7380b6] text-white font-semibold rounded-md",
      },
    };
  }, [data]);

  const dayDetail = selectedDay ? (data?.by_day?.[selectedDay] || { sent: 0, opened: 0, clicked: 0, tests: 0, campaigns: [] }) : null;

  return (
    <div className="space-y-5" data-testid="analytics-panel">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900">Analytics</h2>
          <p className="text-sm text-slate-500">{from} → {to}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select data-testid="analytics-category-filter" value={category} onChange={(e) => { setCategory(e.target.value); setSelectedDay(null); }}
            className="text-sm border border-slate-200 rounded-full px-4 py-2 bg-white outline-none focus:ring-2 focus:ring-[#7380b6]">
            <option value="">All tags</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex bg-slate-100 rounded-full p-1">
            {PRESETS.map((p) => (
              <button key={p.days} data-testid={`analytics-range-${p.days}`} onClick={() => { setDays(p.days); setSelectedDay(null); }}
                className={`text-sm px-3.5 py-1.5 rounded-full transition-colors ${days === p.days ? "bg-white text-[#7380b6] font-semibold clara-soft" : "text-slate-500 hover:text-slate-700"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !data ? (
        <div className="text-center py-16 text-slate-400 text-sm">Couldn't load analytics.</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi testid="kpi-campaigns" icon={Send} label="Campaigns sent" value={t.campaigns_sent} color="bg-[#7380b6]/10 text-[#7380b6]" />
            <Kpi testid="kpi-emails" icon={Send} label="Emails delivered" value={t.emails_sent} color="bg-[#7380b6]/10 text-[#7380b6]" />
            <Kpi testid="kpi-open-rate" icon={MailOpen} label="Open rate" value={`${t.open_rate}%`} sub={`${t.opened} opens`} color="bg-emerald-50 text-emerald-600" />
            <Kpi testid="kpi-click-rate" icon={MousePointerClick} label="Click rate" value={`${t.click_rate}%`} sub={`${t.clicked} clicks`} color="bg-amber-50 text-amber-600" />
            <Kpi testid="kpi-added" icon={UserPlus} label="Subscribers added" value={t.subscribers_added} color="bg-[#7380b6]/10 text-[#7380b6]" />
            <Kpi testid="kpi-unsub" icon={UserMinus} label="Unsubscribed" value={t.unsubscribed} color="bg-rose-50 text-rose-600" />
            <Kpi testid="kpi-tests" icon={FlaskConical} label="Test sends" value={t.test_sends} color="bg-sky-50 text-sky-600" />
            <Kpi testid="kpi-failed" icon={AlertCircle} label="Failed" value={t.failed} color="bg-rose-50 text-rose-600" />
          </div>

          {/* Line chart + send-type pie */}
          <div className="grid lg:grid-cols-3 gap-5">
            <Panel testid="chart-timeseries" title="Sends, opens & clicks over time" action={null}>
              <div className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.timeseries} margin={{ left: -18, right: 8, top: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={shortDate} contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="sent" name="Sent" stroke="#7380b6" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="opened" name="Opened" stroke="#10B981" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="clicked" name="Clicked" stroke="#F59E0B" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel testid="chart-sendtypes" title="Send types">
              {!sendTypeData.length ? (
                <div className="text-sm text-slate-400 py-16 text-center">No sends in this period.</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={sendTypeData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                        {sendTypeData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {sendTypeData.map((e) => (
                      <div key={e.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} /> {e.name}</span>
                        <b className="text-slate-900">{e.value}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>

          {/* Subscriber growth + per-campaign rates */}
          <div className="grid lg:grid-cols-2 gap-5">
            <Panel testid="chart-growth" title="Subscriber growth">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.subscriber_growth} margin={{ left: -18, right: 8, top: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip labelFormatter={shortDate} contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="added" name="Added" fill="#7380b6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="unsubscribed" name="Unsubscribed" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel testid="chart-campaign-rates" title="Open & click rate per campaign">
              {!campaignBars.length ? (
                <div className="text-sm text-slate-400 py-16 text-center">No campaigns sent in this period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={campaignBars} layout="vertical" margin={{ left: 8, right: 16, top: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
                    <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="open_rate" name="Open %" fill="#10B981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="click_rate" name="Click %" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          {/* Calendar + day detail */}
          <div className="grid lg:grid-cols-2 gap-5">
            <Panel testid="analytics-calendar" title="Activity calendar" action={<span className="text-xs text-slate-400 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> click a day</span>}>
              <div className="flex flex-col items-center">
                <Calendar
                  mode="single"
                  month={month}
                  onMonthChange={setMonth}
                  selected={selectedDay ? parseISO(selectedDay + "T00:00:00") : undefined}
                  onDayClick={(d) => setSelectedDay(format(d, "yyyy-MM-dd"))}
                  modifiers={modifiers}
                  modifiersClassNames={modifiersClassNames}
                />
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                  <span>Less</span>
                  <span className="h-3 w-3 rounded-sm bg-[#7380b6]/20" />
                  <span className="h-3 w-3 rounded-sm bg-[#7380b6]/50" />
                  <span className="h-3 w-3 rounded-sm bg-[#7380b6]" />
                  <span>More</span>
                </div>
              </div>
            </Panel>

            <Panel testid="analytics-day-detail" title={selectedDay ? `Activity on ${shortDate(selectedDay)}` : "Day detail"}>
              {!selectedDay ? (
                <div className="text-sm text-slate-400 py-16 text-center">Select a day in the calendar to see everything that happened that day.</div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { l: "Sent", v: dayDetail.sent, c: "text-[#7380b6]" },
                      { l: "Opened", v: dayDetail.opened, c: "text-emerald-600" },
                      { l: "Clicked", v: dayDetail.clicked, c: "text-amber-600" },
                      { l: "Tests", v: dayDetail.tests, c: "text-sky-600" },
                    ].map((x) => (
                      <div key={x.l} className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <div className={`text-lg font-display font-bold ${x.c}`}>{x.v}</div>
                        <div className="text-[11px] text-slate-500">{x.l}</div>
                      </div>
                    ))}
                  </div>
                  {!dayDetail.campaigns.length ? (
                    <div className="text-sm text-slate-400 py-6 text-center">No campaigns delivered on this day.</div>
                  ) : (
                    <div className="space-y-2">
                      {dayDetail.campaigns.map((c) => (
                        <div key={c.id} data-testid={`day-campaign-${c.id}`} className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-800 truncate">{c.name}</div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: (SEND_TYPE_META[c.send_type]?.color || "#CBD5E1") + "22", color: SEND_TYPE_META[c.send_type]?.color || "#64748B" }}>
                              {SEND_TYPE_META[c.send_type]?.label || c.send_type}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 whitespace-nowrap">{c.sent} sent · {c.opened} open · {c.clicked} click</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
