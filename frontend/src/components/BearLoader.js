import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRotatingTip } from "@/lib/tips";

// Full-screen Clara loading overlay: the koodh bear with a subtle float
// animation and rotating newsletter tips underneath.
export function BearLoader({ open = true, label = "Loading…" }) {
  const tip = useRotatingTip(open);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="bear-loader"
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md px-10 py-9 text-center"
          >
            <motion.img
              src="/koodh-avatar.png"
              alt=""
              className="h-24 w-24 mx-auto object-contain"
              style={{ filter: "drop-shadow(0 10px 18px rgba(115,128,182,0.35))" }}
              animate={{ y: [0, -10, 0], rotate: [0, -3, 3, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{ background: "#7380b6" }}
                  animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                />
              ))}
            </div>
            <p className="mt-4 font-display text-lg font-bold text-slate-900">{label}</p>
            <div className="mt-4 rounded-2xl bg-[#f3f4fb] px-5 py-4 min-h-[72px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={tip}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="text-sm text-slate-600 leading-relaxed"
                  data-testid="bear-loader-tip"
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
