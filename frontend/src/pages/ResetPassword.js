import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { document.title = "Clara Campaigns | Reset password"; }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== pw2) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password: pw });
      setDone(true);
      toast.success("Password updated");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6"
      style={{ backgroundImage: "url(/clara-stripes.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 clara-fade-up">
        <Logo className="mb-8" />
        {!token ? (
          <div className="text-center">
            <p className="text-sm text-slate-600">This reset link is invalid or missing a token.</p>
            <button onClick={() => navigate("/login")} className="mt-4 text-rose-600 font-medium hover:underline text-sm">Back to sign in</button>
          </div>
        ) : done ? (
          <div className="text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h1 className="font-display text-2xl font-bold text-slate-900">Password updated</h1>
            <p className="text-sm text-slate-500 mt-1 mb-6">You can now sign in with your new password.</p>
            <button data-testid="goto-login-btn" onClick={() => navigate("/login")}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-lg transition-colors">Go to sign in</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-6 w-6 text-rose-600" />
              <h1 className="font-display text-2xl font-bold text-slate-900">Set a new password</h1>
            </div>
            <p className="text-sm text-slate-500 mb-6">Choose a strong password for your account.</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <input data-testid="new-password-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input data-testid="confirm-password-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none" />
              </div>
              <button data-testid="reset-submit-btn" disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Update password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
