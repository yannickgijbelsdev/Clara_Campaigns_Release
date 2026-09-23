import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { BrandingForm } from "@/pages/Branding";
import { Sparkles } from "lucide-react";

export default function Onboarding() {
  const { refreshUser } = useAuth();

  const finish = async () => {
    await refreshUser();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        data-testid="onboarding-modal"
        className="w-full max-w-xl bg-white rounded-3xl clara-soft shadow-2xl my-[6vh] overflow-hidden">
        <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white px-7 py-6">
          <div className="flex items-center gap-2 text-rose-100 text-xs font-semibold uppercase tracking-widest mb-2">
            <Sparkles className="h-4 w-4" /> Welcome to Clara
          </div>
          <h1 className="font-display text-2xl font-bold">Set up your company</h1>
          <p className="text-sm text-rose-50/90 mt-1">Add your logo, brand colors and website. We'll apply them automatically to every newsletter you send.</p>
        </div>
        <div className="px-7 py-6">
          <BrandingForm compact onSaved={finish} />
        </div>
      </motion.div>
    </div>
  );
}
