import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Gem, Sparkles, Rocket, Loader2, X, Mail } from "lucide-react";

const PLANS = [
  {
    id: "free", name: "Free", price: "€0", cadence: "forever", icon: Gem, paid: false,
    tagline: "Get started and try Clara.",
    features: ["5 campaigns per week", "1 workspace", "CSV import & contacts", "Open & click tracking", "Simulation sending"],
  },
  {
    id: "pro", name: "Pro", price: "Custom", cadence: "per month", icon: Sparkles, paid: true, popular: true,
    tagline: "For growing newsletters.",
    features: ["30 campaigns per month", "Microsoft 365 sending", "Categories & segments", "Subscribe form & API", "Priority email support"],
  },
  {
    id: "enterprise", name: "Enterprise", price: "Custom", cadence: "tailored", icon: Rocket, paid: true,
    tagline: "For teams and high volume.",
    features: ["Unlimited campaigns", "Multiple workspaces", "Dedicated onboarding", "Advanced analytics", "Priority support & SLA"],
  },
];

export default function Plans() {
  const { user } = useAuth();
  const current = user?.license?.plan || "free";
  const [busy, setBusy] = useState(null);
  const [quote, setQuote] = useState(null);

  const request = async (plan) => {
    setBusy(plan.id);
    try {
      const { data } = await api.post("/plan/request", { plan: plan.id });
      if (data.paid) setQuote(plan);
      else toast.success("Your plan change request has been sent.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
    setBusy(null);
  };

  return (
    <AppLayout title="Plans & billing" subtitle="Choose the plan that fits your newsletter">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl">
        {PLANS.map((p, i) => {
          const isCurrent = current === p.id;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              data-testid={`plan-card-${p.id}`}
              className={`relative bg-white rounded-3xl p-6 flex flex-col ${p.popular ? "clara-soft ring-2 ring-rose-500" : "clara-soft"}`}>
              {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[11px] font-semibold px-3 py-1 rounded-full">Most popular</span>}
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl mb-4 ${p.paid ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}><p.icon className="h-5 w-5" /></span>
              <h2 className="font-display text-xl font-bold text-slate-900">{p.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5 mb-4">{p.tagline}</p>
              <div className="mb-5">
                <span className="font-display text-3xl font-bold text-slate-900">{p.price}</span>
                <span className="text-sm text-slate-400 ml-1">/ {p.cadence}</span>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div data-testid={`current-plan-${p.id}`} className="text-center text-sm font-medium text-slate-500 bg-slate-100 rounded-full py-2.5">Your current plan</div>
              ) : (
                <button data-testid={`request-plan-${p.id}`} onClick={() => request(p)} disabled={busy === p.id}
                  className={`inline-flex items-center justify-center gap-2 text-sm font-medium rounded-full py-2.5 clara-trans disabled:opacity-60 ${
                    p.paid ? "bg-rose-600 hover:bg-rose-700 text-white" : "border border-slate-200 hover:bg-slate-50 text-slate-700"}`}>
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {p.paid ? "Request this plan" : "Switch to Free"}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="text-sm text-slate-400 mt-6 max-w-2xl">
        Every plan change request is sent to the Koodh team at <b className="text-slate-500">clara.global@koodh.com</b>. For paid plans we'll contact you with a quote and switch your plan once payment is arranged.
      </p>

      <AnimatePresence>
        {quote && (
          <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQuote(null)}>
            <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()} data-testid="quote-popup"
              className="w-full max-w-md bg-white rounded-3xl clara-soft shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white px-7 py-6">
                <Mail className="h-7 w-7 mb-2" />
                <h2 className="font-display text-xl font-bold">Request received!</h2>
              </div>
              <div className="px-7 py-6">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Thanks for your interest in the <b className="text-slate-900">{quote.name}</b> plan. The <b>Koodh team</b> will contact you as soon as possible to discuss everything — you'll receive a personalised quote. As soon as payment is arranged, your plan is switched.
                </p>
                <button onClick={() => setQuote(null)} data-testid="quote-close"
                  className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full py-2.5">Got it</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
