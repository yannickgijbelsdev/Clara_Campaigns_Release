import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { ProgressOverlay } from "@/components/ProgressOverlay";
import { ShieldCheck, Loader2, ArrowLeft, LayoutTemplate, Send, Upload, MousePointerClick, Lock, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const BUBBLES = [
  { icon: LayoutTemplate, title: "Drag & Drop Builder", text: "Pre-built blocks for logo, images, titles, text and buttons.", pos: "top-[8%] left-[10%]", color: "text-rose-600 bg-rose-50" },
  { icon: Send, title: "Microsoft 365 Sending", text: "Send newsletters straight from your Microsoft 365 mailbox.", pos: "top-[20%] right-[8%]", color: "text-sky-600 bg-sky-50" },
  { icon: Upload, title: "CSV Import", text: "Bulk-import recipients with automatic column mapping.", pos: "top-[42%] left-[6%]", color: "text-violet-600 bg-violet-50" },
  { icon: MousePointerClick, title: "Open & Click Tracking", text: "See exactly who opened and clicked every campaign.", pos: "top-[52%] right-[10%]", color: "text-amber-600 bg-amber-50" },
  { icon: Lock, title: "Secure MFA Login", text: "Two-factor authentication with any authenticator app.", pos: "bottom-[14%] left-[12%]", color: "text-emerald-600 bg-emerald-50" },
  { icon: BarChart3, title: "Analytics & KPIs", text: "Open rate, click-through and per-recipient engagement.", pos: "bottom-[6%] right-[12%]", color: "text-rose-600 bg-rose-50" },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("credentials");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [mfa, setMfa] = useState({ token: "", code: "", setup: false, qr: "", secret: "" });
  const [welcome, setWelcome] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    document.title = step === "mfa" ? "Clara Campaigns | Verification" : "Clara Campaigns | Sign in";
  }, [step]);

  const submitCredentials = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        await api.post("/auth/register", form);
        toast.success("Account created. Please sign in.");
        setMode("login");
        setForm({ ...form, name: "" });
        setLoading(false);
        return;
      }
      const { data } = await api.post("/auth/login", { email: form.email, password: form.password });
      if (data.mfa_setup_required) {
        setMfa({ token: data.mfa_token, code: "", setup: true, qr: data.qr, secret: data.secret });
        setStep("mfa");
      } else if (data.mfa_required) {
        setMfa({ token: data.mfa_token, code: "", setup: false, qr: "", secret: "" });
        setStep("mfa");
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/mfa/verify", { mfa_token: mfa.token, code: mfa.code });
      await login(data.access_token, data.user);
      setWelcome(true);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      toast.success("If an account exists for that email, a reset link has been sent.");
      setStep("credentials");
      setForgotEmail("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <ProgressOverlay
        open={welcome}
        title="Welcome to Clara"
        subtitle="Setting things up for you…"
        steps={[
          "Logging in to Clara…",
          "Making a secure connection to the Clara Datacenter…",
          "Connecting to the Clara services…",
          "Preparing your workspace to show all the data…",
        ]}
        onComplete={() => navigate("/dashboard")}
      />
      {/* Left: form */}
      <div className="w-full lg:w-[46%] xl:w-[38%] flex flex-col justify-center px-8 sm:px-16 py-10">
        <div className="w-full max-w-sm mx-auto clara-fade-up">
          <div className="flex items-center gap-2.5 mb-12">
            <Logo className="scale-125 origin-left" />
            <div className="h-6 w-px bg-slate-200" />
            <span className="font-display font-semibold text-slate-900 text-lg">Clara Campaigns</span>
          </div>

          {step === "credentials" ? (
            <>
              <h1 className="font-display text-3xl font-bold text-slate-900 mb-1">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h1>
              <p className="text-sm text-slate-500 mb-8">
                {mode === "login" ? "Sign in to access your dashboard" : "Start sending newsletters with Clara"}
              </p>
              <form onSubmit={submitCredentials} className="space-y-5">
                {mode === "register" && (
                  <Field label="Name" testid="name-input" type="text" value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })} placeholder="John Doe" />
                )}
                <Field label="Email" testid="email-input" type="email" value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })} placeholder="you@example.com" />
                <Field label="Password" testid="password-input" type="password" value={form.password}
                  onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" />
                <button data-testid="submit-credentials-btn" disabled={loading}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "login" ? "Sign in" : "Register"}
                </button>
              </form>
              {mode === "login" && (
                <div className="text-right mt-3">
                  <button data-testid="forgot-password-link" onClick={() => setStep("forgot")}
                    className="text-sm text-rose-600 font-medium hover:underline">Forgot password?</button>
                </div>
              )}
              <p className="text-sm text-slate-500 mt-6 text-center">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button data-testid="toggle-mode-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}
                  className="text-rose-600 font-semibold hover:underline">
                  {mode === "login" ? "Register" : "Sign in"}
                </button>
              </p>
            </>
          ) : step === "forgot" ? (
            <>
              <button onClick={() => setStep("credentials")} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-6">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">Reset password</h1>
              <p className="text-sm text-slate-500 mb-6">Enter your email and we'll send you a secure reset link.</p>
              <form onSubmit={submitForgot} className="space-y-4">
                <Field label="Email" testid="forgot-email-input" type="email" value={forgotEmail}
                  onChange={(v) => setForgotEmail(v)} placeholder="you@example.com" />
                <button data-testid="send-reset-btn" disabled={loading}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
                </button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => setStep("credentials")} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-6">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-6 w-6 text-rose-600" />
                <h1 className="font-display text-2xl font-bold text-slate-900">Verification</h1>
              </div>
              {mfa.setup ? (
                <p className="text-sm text-slate-500 mb-5">
                  Scan the QR code with your authenticator app (Google / Microsoft Authenticator) and enter the 6-digit code.
                </p>
              ) : (
                <p className="text-sm text-slate-500 mb-5">Enter the 6-digit code from your authenticator app.</p>
              )}

              {mfa.setup && (
                <div className="mb-5 flex flex-col items-center">
                  <img src={mfa.qr} alt="QR code" data-testid="mfa-qr" className="h-44 w-44 border border-slate-200 rounded-lg p-2 bg-white" />
                  <div className="mt-2 text-[11px] text-slate-400">Or enter manually:</div>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-700 break-all">{mfa.secret}</code>
                </div>
              )}

              <form onSubmit={submitMfa} className="space-y-4">
                <input
                  data-testid="mfa-code-input"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfa.code}
                  onChange={(e) => setMfa({ ...mfa, code: e.target.value.replace(/\D/g, "") })}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-semibold py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                />
                <button data-testid="verify-mfa-btn" disabled={loading || mfa.code.length !== 6}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mfa.setup ? "Activate & sign in" : "Verify"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Right: striped panel with floating bubbles */}
      <div className="hidden lg:block relative flex-1 overflow-hidden border-l border-slate-100"
        style={{ backgroundImage: "url(/clara-stripes.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-white/10" />
        {BUBBLES.map((b, i) => (
          <div key={i} className={`absolute ${b.pos} max-w-[240px] clara-fade-up`} style={{ animationDelay: `${i * 120}ms` }}>
            <div className="bg-white rounded-2xl shadow-xl shadow-rose-900/10 border border-white/60 p-4 flex gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${b.color}`}>
                <b.icon className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="font-display font-semibold text-sm text-slate-900">{b.title}</div>
                <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{b.text}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, testid, type, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        data-testid={testid}
        type={type}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:bg-white outline-none transition-all"
      />
    </div>
  );
}
