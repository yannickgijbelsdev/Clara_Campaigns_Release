import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

export function ProgressOverlay({ open, title, subtitle, steps, onComplete, stepMs = 850 }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setActive(i);
      if (i >= steps.length) {
        clearInterval(t);
        setTimeout(() => onComplete && onComplete(), 550);
      }
    }, stepMs);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}
            data-testid="progress-overlay"
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg px-10 py-10">
            <h2 className="font-display text-3xl font-bold text-slate-900 text-center">{title}</h2>
            <p className="text-slate-500 text-center mt-1 mb-8">{subtitle}</p>
            <div className="space-y-5">
              {steps.map((label, idx) => {
                const done = idx < active;
                const current = idx === active;
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="relative h-11 w-11 shrink-0">
                      {done ? (
                        <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                          className="h-11 w-11 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="h-5 w-5 text-white" strokeWidth={3} />
                        </motion.div>
                      ) : current ? (
                        <div className="h-11 w-11 rounded-full border-[3px] border-slate-200 border-t-slate-900 animate-spin" />
                      ) : (
                        <div className="h-11 w-11 rounded-full border-[3px] border-slate-200" />
                      )}
                    </div>
                    <span className={`text-lg font-medium transition-colors ${
                      done ? "text-emerald-600" : current ? "text-slate-900" : "text-slate-400"}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
