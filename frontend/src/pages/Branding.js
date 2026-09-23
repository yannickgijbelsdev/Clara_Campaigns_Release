import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Palette, Camera, Loader2, Globe, Check, Building2 } from "lucide-react";

const inp = "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none";

export const companyLogoUrl = (b) =>
  b?.logo_url ? `${b.logo_url}?v=${b.logo_version || 0}` : null;

export function BrandingForm({ onSaved, compact = false }) {
  const { loadCompanies } = useAuth();
  const fileRef = useRef();
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => api.get("/company/branding").then((r) => setB(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/company/branding", {
        name: b.name, brand_primary: b.brand_primary, brand_accent: b.brand_accent, website: b.website,
      });
      setB(data);
      await loadCompanies();
      toast.success("Branding saved");
      onSaved && onSaved(data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setBusy(false);
  };

  const onFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post("/company/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await load();
      toast.success("Logo updated");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    setUploading(false);
    e.target.value = "";
  };

  if (!b) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-rose-500" /></div>;
  const logo = companyLogoUrl(b);

  return (
    <div className="space-y-5">
      {/* Logo + name */}
      <div className="flex items-center gap-5 flex-wrap">
        <div className="relative">
          {logo
            ? <img src={logo} alt="" className="h-20 w-20 rounded-2xl object-contain bg-slate-50 p-2 clara-soft" data-testid="company-logo-preview" />
            : <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center"><Building2 className="h-8 w-8 text-slate-300" /></div>}
          {uploading && <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-rose-600" /></div>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Company name</label>
          <input data-testid="branding-name" value={b.name || ""} onChange={(e) => setB({ ...b, name: e.target.value })} className={inp} />
          <button data-testid="upload-logo-btn" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="mt-2 inline-flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 rounded-full hover:bg-slate-50 clara-trans disabled:opacity-60">
            <Camera className="h-4 w-4" /> {logo ? "Change logo" : "Upload logo"}
          </button>
          <input ref={fileRef} data-testid="logo-file-input" type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary color</label>
          <div className="flex items-center gap-2">
            <input type="color" data-testid="brand-primary-picker" value={b.brand_primary || "#7380b6"} onChange={(e) => setB({ ...b, brand_primary: e.target.value })}
              className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer bg-white p-1" />
            <input value={b.brand_primary || ""} onChange={(e) => setB({ ...b, brand_primary: e.target.value })} className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Accent color</label>
          <div className="flex items-center gap-2">
            <input type="color" data-testid="brand-accent-picker" value={b.brand_accent || "#0F172A"} onChange={(e) => setB({ ...b, brand_accent: e.target.value })}
              className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer bg-white p-1" />
            <input value={b.brand_accent || ""} onChange={(e) => setB({ ...b, brand_accent: e.target.value })} className={inp} />
          </div>
        </div>
      </div>

      {/* Website */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
        <div className="relative">
          <Globe className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input data-testid="branding-website" value={b.website || ""} onChange={(e) => setB({ ...b, website: e.target.value })}
            placeholder="https://yourcompany.com" className={`${inp} pl-9`} />
        </div>
        <p className="text-xs text-slate-400 mt-1.5">Your logo, colors and website are automatically applied to every newsletter this company sends.</p>
      </div>

      <button data-testid="save-branding-btn" onClick={save} disabled={busy}
        className="inline-flex items-center gap-2 text-sm px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full clara-trans disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {compact ? "Save & continue" : "Save branding"}
      </button>
    </div>
  );
}

export default function Branding() {
  return (
    <AppLayout title="Company branding" subtitle="Customize how your company appears in every newsletter">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl bg-white rounded-3xl clara-soft p-6">
        <h2 className="font-display font-semibold text-slate-900 mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Palette className="h-[18px] w-[18px]" /></span>
          Brand identity
        </h2>
        <BrandingForm />
      </motion.div>
    </AppLayout>
  );
}
