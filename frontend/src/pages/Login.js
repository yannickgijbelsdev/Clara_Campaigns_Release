import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { ProgressOverlay } from "@/components/ProgressOverlay";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("credentials");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [mfa, setMfa] = useState({ token: "", code: "", setup: false, qr: "", secret: "" });
  const [welcome, setWelcome] = useState(false);
  const [pendingAuth, setPendingAuth] = useState(null);
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
      setPendingAuth({ token: data.access_token, user: data.user });
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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative"
      style={{
        backgroundImage: "url(/clara-bear-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#e9e9ea",
      }}
    >
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
        onComplete={async () => {
          if (pendingAuth) await login(pendingAuth.token, pendingAuth.user);
          navigate("/dashboard");
        }}
      />

      <div className="absolute inset-0 bg-white/25 backdrop-blur-[1px]" />

      <div
        data-testid="login-card"
        className="relative w-full max-w-md rounded-[28px] bg-white shadow-2xl shadow-slate-900/15 px-8 sm:px-10 py-9 clara-fade-up"
        style={{ backgroundImage: "linear-gradient(180deg, #faf9fc 0%, #ffffff 22%)" }}
      >
        <div className="flex items-center justify-center gap-3 mb-7">
          <Logo className="scale-100 origin-center" />
          <div className="h-6 w-px bg-slate-200" />
          <span className="font-display font-semibold text-slate-900 text-lg tracking-tight">Clara Campaigns</span>
        </div>

        {step === "credentials" ? (
          <>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-1.5 text-center">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm text-slate-500 mb-8 text-center">
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
                className="w-full bg-[#7380b6] hover:bg-[#616fa6] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-[#7380b6]/25">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Register"}
              </button>
            </form>
            {mode === "login" && (
              <div className="text-right mt-3">
                <button data-testid="forgot-password-link" onClick={() => setStep("forgot")}
                  className="text-sm text-[#7380b6] font-medium hover:underline">Forgot password?</button>
              </div>
            )}
            <p className="text-sm text-slate-500 mt-6 text-center">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button data-testid="toggle-mode-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-[#7380b6] font-semibold hover:underline">
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
                className="w-full bg-[#7380b6] hover:bg-[#616fa6] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-[#7380b6]/25">
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
              <ShieldCheck className="h-6 w-6 text-[#7380b6]" />
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
                className="w-full text-center tracking-[0.5em] text-2xl font-mono font-semibold py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#7380b6] focus:border-[#7380b6] outline-none"
              />
              <button data-testid="verify-mfa-btn" disabled={loading || mfa.code.length !== 6}
                className="w-full bg-[#7380b6] hover:bg-[#616fa6] text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-[#7380b6]/25">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mfa.setup ? "Activate & sign in" : "Verify"}
              </button>
            </form>
          </>
        )}
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
        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#7380b6] focus:border-[#7380b6] focus:bg-white outline-none transition-all"
      />
    </div>
  );
}
