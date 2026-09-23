import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { avatarUrl } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Mail, User, KeyRound, Camera, Loader2, Check, RefreshCw,
  Copy, Download, X, ScanLine,
} from "lucide-react";

const inp = "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none";

function Card({ icon: Icon, tint, title, children }) {
  return (
    <div className="bg-white rounded-3xl clara-soft p-6">
      <h2 className="font-display font-semibold text-slate-900 mb-5 flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}><Icon className="h-[18px] w-[18px]" /></span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function AvatarCard() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef();
  const [busy, setBusy] = useState(false);
  const av = avatarUrl(user);

  const onFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/auth/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refreshUser();
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setBusy(false);
    e.target.value = "";
  };

  return (
    <Card icon={Camera} tint="bg-rose-50 text-rose-600" title="Profile photo">
      <div className="flex items-center gap-5">
        <div className="relative">
          {av
            ? <img src={av} alt="" className="h-20 w-20 rounded-2xl object-cover clara-soft" />
            : <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center text-2xl font-bold">{(user?.name || "U").slice(0, 1).toUpperCase()}</div>}
          {busy && <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-rose-600" /></div>}
        </div>
        <div>
          <button data-testid="upload-avatar-btn" onClick={() => fileRef.current?.click()} disabled={busy}
            className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full clara-trans disabled:opacity-60">
            <Camera className="h-4 w-4" /> {av ? "Change photo" : "Upload photo"}
          </button>
          <p className="text-xs text-slate-400 mt-2">JPG, PNG or WEBP — up to 5 MB.</p>
          <input ref={fileRef} data-testid="avatar-file-input" type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const [f, setF] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (f.new_password !== f.confirm) return toast.error("New passwords don't match");
    if (f.new_password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      await api.put("/auth/password", { current_password: f.current_password, new_password: f.new_password });
      toast.success("Password changed");
      setF({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setBusy(false);
  };

  return (
    <Card icon={KeyRound} tint="bg-indigo-50 text-indigo-600" title="Change password">
      <div className="space-y-3 max-w-md">
        <input data-testid="current-password" type="password" placeholder="Current password" value={f.current_password}
          onChange={(e) => setF({ ...f, current_password: e.target.value })} className={inp} />
        <input data-testid="new-password" type="password" placeholder="New password" value={f.new_password}
          onChange={(e) => setF({ ...f, new_password: e.target.value })} className={inp} />
        <input data-testid="confirm-password" type="password" placeholder="Confirm new password" value={f.confirm}
          onChange={(e) => setF({ ...f, confirm: e.target.value })} className={inp} />
        <button data-testid="save-password-btn" onClick={submit} disabled={busy || !f.current_password || !f.new_password}
          className="inline-flex items-center gap-2 text-sm px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full clara-trans disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Update password
        </button>
      </div>
    </Card>
  );
}

function CodesModal({ codes, onClose }) {
  const copy = () => { navigator.clipboard.writeText(codes.join("\n")); toast.success("Copied to clipboard"); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([codes.join("\n")], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "clara-backup-codes.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()} data-testid="backup-codes-modal"
        className="bg-white rounded-3xl clara-soft w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-display font-semibold text-lg text-slate-900">Your backup codes</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Save these one-time codes somewhere safe. Each works once if you lose access to your authenticator. They won't be shown again.</p>
        <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-2xl p-4 font-mono text-sm text-slate-800">
          {codes.map((c) => <div key={c} data-testid="backup-code" className="select-all text-center py-1">{c}</div>)}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={copy} className="flex-1 inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 border border-slate-200 rounded-full hover:bg-slate-50"><Copy className="h-4 w-4" /> Copy</button>
          <button onClick={download} className="flex-1 inline-flex items-center justify-center gap-2 text-sm px-4 py-2.5 border border-slate-200 rounded-full hover:bg-slate-50"><Download className="h-4 w-4" /> Download</button>
        </div>
      </motion.div>
    </div>
  );
}

function MfaCard() {
  const [status, setStatus] = useState(null);
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(null); // { secret, qr } | "confirm"
  const [code, setCode] = useState("");

  const loadStatus = () => api.get("/auth/mfa/backup-codes/status").then((r) => setStatus(r.data)).catch(() => {});
  useEffect(() => { loadStatus(); }, []);

  const regenerate = async () => {
    if (status?.generated && !window.confirm("Regenerate backup codes? Your old codes will stop working.")) return;
    setBusy(true);
    try {
      const { data } = await api.post("/auth/mfa/backup-codes");
      setCodes(data.codes); loadStatus();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    setBusy(false);
  };

  const startReset = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/mfa/reset/start");
      setReset(data); setCode("");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    setBusy(false);
  };

  const confirmReset = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/mfa/reset/confirm", { code: code.trim() });
      toast.success("Authenticator reset successfully");
      setReset(null); setCodes(data.codes); loadStatus();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    setBusy(false);
  };

  return (
    <Card icon={ShieldCheck} tint="bg-emerald-50 text-emerald-600" title="Two-factor authentication">
      <div className="flex items-center justify-between bg-emerald-50/70 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-emerald-600" />
          <div>
            <div className="text-sm font-medium text-emerald-800">Authenticator app active</div>
            <div className="text-xs text-emerald-700">A 6-digit code is required at every login.</div>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">Enabled</span>
      </div>

      {/* Backup codes */}
      <div className="flex items-center justify-between border border-slate-100 rounded-2xl p-4 mb-3">
        <div>
          <div className="text-sm font-medium text-slate-800">Backup codes</div>
          <div className="text-xs text-slate-400">
            {status?.generated ? `${status.remaining} of ${status.total} codes remaining` : "No backup codes generated yet"}
          </div>
        </div>
        <button data-testid="regen-backup-codes-btn" onClick={regenerate} disabled={busy}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 rounded-full hover:bg-slate-50 clara-trans disabled:opacity-60">
          <RefreshCw className="h-4 w-4" /> {status?.generated ? "Regenerate" : "Generate"}
        </button>
      </div>

      {/* Reset MFA */}
      <div className="flex items-center justify-between border border-slate-100 rounded-2xl p-4">
        <div>
          <div className="text-sm font-medium text-slate-800">Reset authenticator</div>
          <div className="text-xs text-slate-400">Set up a new device or app by scanning a fresh QR code.</div>
        </div>
        <button data-testid="reset-mfa-btn" onClick={startReset} disabled={busy}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 border border-rose-200 text-rose-600 rounded-full hover:bg-rose-50 clara-trans disabled:opacity-60">
          <ScanLine className="h-4 w-4" /> Reset MFA
        </button>
      </div>

      <AnimatePresence>
        {reset && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="mt-4 border border-slate-100 rounded-2xl p-5">
              <p className="text-sm text-slate-600 mb-3">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
              <div className="flex items-center gap-5 flex-wrap">
                <img src={reset.qr} alt="MFA QR" className="h-40 w-40 rounded-xl border border-slate-100" data-testid="mfa-reset-qr" />
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs text-slate-400 mb-1">Manual key</div>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded break-all">{reset.secret}</code>
                  <input data-testid="mfa-reset-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    maxLength={6} placeholder="000000" className={`${inp} mt-3 tracking-[0.4em] text-center`} />
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setReset(null)} className="flex-1 text-sm px-4 py-2 border border-slate-200 rounded-full hover:bg-slate-50">Cancel</button>
                    <button data-testid="confirm-reset-mfa-btn" onClick={confirmReset} disabled={busy || code.length !== 6}
                      className="flex-1 inline-flex items-center justify-center gap-2 text-sm px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full disabled:opacity-60">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {codes && <CodesModal codes={codes} onClose={() => setCodes(null)} />}
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  return (
    <AppLayout title="Account & Security" subtitle="Manage your profile, password and two-factor authentication">
      <div className="max-w-2xl space-y-5">
        <Card icon={User} tint="bg-slate-100 text-slate-600" title="Account details">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500 w-24">Email</span>
              <span className="text-slate-800 font-medium" data-testid="account-email">{user?.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500 w-24">Name</span>
              <span className="text-slate-800 font-medium">{user?.name}</span>
            </div>
          </div>
        </Card>
        <AvatarCard />
        <PasswordCard />
        <MfaCard />
      </div>
    </AppLayout>
  );
}
