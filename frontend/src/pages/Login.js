import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Mail, ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | register
  const [step, setStep] = useState("credentials"); // credentials | mfa
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [mfa, setMfa] = useState({ token: "", code: "", setup: false, qr: "", secret: "" });

  const submitCredentials = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        await api.post("/auth/register", form);
        toast.success("Account aangemaakt. Log nu in.");
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
      login(data.access_token, data.user);
      toast.success("Welkom terug!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0F172A]">
      {/* Left brand panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-transparent to-violet-700/20" />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-white text-lg leading-tight">Clara Campaigns</div>
            <div className="text-xs text-slate-400">Office 365 Newsletter Platform</div>
          </div>
        </div>
        <div className="relative">
          <h2 className="font-display text-4xl font-bold text-white leading-tight mb-4">
            Verstuur prachtige nieuwsbrieven vanuit je Office 365-mailbox.
          </h2>
          <p className="text-slate-300 text-base leading-relaxed max-w-md">
            Drag-and-drop editor, CSV-import, open- & klik-tracking, en veilige login met MFA.
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-slate-400 text-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-400" /> Beveiligd met tweestapsverificatie
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm clara-fade-up">
          {step === "credentials" ? (
            <>
              <h1 className="font-display text-2xl font-bold text-slate-900 mb-1">
                {mode === "login" ? "Welkom terug" : "Account aanmaken"}
              </h1>
              <p className="text-sm text-slate-500 mb-7">
                {mode === "login" ? "Log in op je dashboard" : "Start met Clara Campaigns"}
              </p>
              <form onSubmit={submitCredentials} className="space-y-4">
                {mode === "register" && (
                  <Field label="Naam" testid="name-input" type="text" value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })} placeholder="Jan Jansen" />
                )}
                <Field label="E-mailadres" testid="email-input" type="email" value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })} placeholder="jij@bedrijf.nl" />
                <Field label="Wachtwoord" testid="password-input" type="password" value={form.password}
                  onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" />
                <button data-testid="submit-credentials-btn" disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "login" ? "Inloggen" : "Registreren"}
                </button>
              </form>
              <p className="text-sm text-slate-500 mt-6 text-center">
                {mode === "login" ? "Nog geen account?" : "Al een account?"}{" "}
                <button data-testid="toggle-mode-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}
                  className="text-indigo-600 font-medium hover:underline">
                  {mode === "login" ? "Registreren" : "Inloggen"}
                </button>
              </p>
            </>
          ) : (
            <>
              <button onClick={() => setStep("credentials")} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-5">
                <ArrowLeft className="h-4 w-4" /> Terug
              </button>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-6 w-6 text-indigo-600" />
                <h1 className="font-display text-2xl font-bold text-slate-900">Verificatie</h1>
              </div>
              {mfa.setup ? (
                <p className="text-sm text-slate-500 mb-5">
                  Scan de QR-code met je authenticator-app (Google/Microsoft Authenticator) en voer de 6-cijferige code in.
                </p>
              ) : (
                <p className="text-sm text-slate-500 mb-5">Voer de 6-cijferige code uit je authenticator-app in.</p>
              )}

              {mfa.setup && (
                <div className="mb-5 flex flex-col items-center">
                  <img src={mfa.qr} alt="QR code" data-testid="mfa-qr" className="h-44 w-44 border border-slate-200 rounded-lg p-2 bg-white" />
                  <div className="mt-2 text-[11px] text-slate-400">Of voer handmatig in:</div>
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
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono font-semibold py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <button data-testid="verify-mfa-btn" disabled={loading || mfa.code.length !== 6}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mfa.setup ? "Activeren & inloggen" : "Verifiëren"}
                </button>
              </form>
            </>
          )}
        </div>
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
        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
      />
    </div>
  );
}
