import { createContext, useCallback, useContext, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = (opts = {}) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setState({
        title: opts.title || "Are you sure?",
        message: opts.message || "",
        confirmText: opts.confirmText || "Confirm",
        cancelText: opts.cancelText || "Cancel",
        danger: opts.danger !== false,
      });
    });

  const close = (result) => {
    if (resolver.current) resolver.current(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {createPortal(
        <AnimatePresence>
          {state && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[130] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => close(false)}>
              <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}
                onClick={(e) => e.stopPropagation()} data-testid="confirm-dialog"
                className="w-full max-w-sm bg-white rounded-3xl clara-soft shadow-2xl p-6">
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${state.danger ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
                    <AlertTriangle className="h-[18px] w-[18px]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-slate-900">{state.title}</h3>
                    {state.message && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{state.message}</p>}
                  </div>
                  <button onClick={() => close(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><X className="h-5 w-5" /></button>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button data-testid="confirm-cancel" onClick={() => close(false)}
                    className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50 clara-trans">{state.cancelText}</button>
                  <button data-testid="confirm-accept" onClick={() => close(true)}
                    className={`px-4 py-2 text-sm text-white rounded-full clara-trans ${state.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800"}`}>{state.confirmText}</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
