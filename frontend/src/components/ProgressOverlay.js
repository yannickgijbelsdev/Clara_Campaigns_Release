import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useRotatingTip } from "@/lib/tips";

export function ProgressOverlay({ open, title, subtitle, steps, onComplete, stepMs = 850 }) {
  const [active, setActive] = useState(0);
  const tip = useRotatingTip(open);

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
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg px-10 py-9">
            <motion.img
              src="/koodh-avatar.png"
              alt=""
              className="h-20 w-20 mx-auto object-contain mb-2"
              style={{ filter: "drop-shadow(0 10px 18px rgba(115,128,182,0.35))" }}
              animate={{ y: [0, -9, 0], rotate: [0, -3, 3, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <h2 className="font-display text-3xl font-bold text-slate-900 text-center">{title}</h2>
            <p className="text-slate-500 text-center mt-1 mb-7">{subtitle}</p>
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
            <div className="mt-7 rounded-2xl bg-[#f3f4fb] px-5 py-4 min-h-[68px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={tip}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="text-sm text-slate-600 leading-relaxed text-center"
                  data-testid="progress-overlay-tip"
                >
                  <span className="font-semibold text-[#7380b6]">Tip · </span>
                  {tip}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
