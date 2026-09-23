#!/usr/bin/env bash
# =============================================================================
# Clara Campaigns — Style Starter (MVP)
# Copies the EXACT Clara Campaigns visual style into another Emergent project.
#
# HOW TO USE (in your NEW Emergent project):
#   1. Put this file in the project's `frontend/` folder.
#   2. Run:  bash clara-style-setup.sh
#   3. Restart the frontend (sudo supervisorctl restart frontend).
#
# What it does:
#   - Writes src/index.css   (Clara fonts, tokens, shadows, toasts, animations)
#   - Writes tailwind.config.js (periwinkle brand scale + shadcn tokens)
#   - Installs framer-motion, lucide-react, sonner, tailwindcss-animate
#   - Backs up any existing files to *.bak
# =============================================================================
set -e

if [ ! -f package.json ]; then
  echo "❌ Run this from your project's frontend/ folder (no package.json found)."
  exit 1
fi

mkdir -p src
[ -f src/index.css ] && cp src/index.css src/index.css.bak && echo "↳ backed up src/index.css -> src/index.css.bak"
[ -f tailwind.config.js ] && cp tailwind.config.js tailwind.config.js.bak && echo "↳ backed up tailwind.config.js -> tailwind.config.js.bak"

# ---------------------------------------------------------------------------
# 1) src/index.css
# ---------------------------------------------------------------------------
cat > src/index.css <<'CLARA_CSS_EOF'
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
    --clara-primary: #7380b6;
    --clara-primary-hover: #545f8f;
    --clara-light-bg: #F5F6F8;
    --o365-blue: #0078D4;
}

body {
    margin: 0;
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: var(--clara-light-bg);
}

/* smooth, modern interactions */
button, a, .clara-trans {
    transition: color .2s ease, background-color .2s ease, border-color .2s ease, box-shadow .25s ease, transform .25s cubic-bezier(.22,1,.36,1);
}
.clara-soft { box-shadow: 0 4px 24px rgba(2, 6, 23, 0.06); }
.clara-hover:hover { transform: translateY(-3px); box-shadow: 0 14px 40px rgba(2, 6, 23, 0.09); }

/* top loading bar */
.clara-loadbar-track {
    position: absolute; inset: 0; overflow: hidden;
    background: rgba(115, 128, 182, 0.12);
}
.clara-loadbar-fill {
    position: absolute; top: 0; bottom: 0; left: -40%; width: 40%;
    background: linear-gradient(90deg, #8f99c5, #7380b6, #545f8f);
    border-radius: 9999px;
    animation: clara-loadbar 1.1s cubic-bezier(.4,0,.2,1) infinite;
}
@keyframes clara-loadbar {
    0%   { left: -40%; width: 40%; }
    50%  { left: 25%;  width: 55%; }
    100% { left: 100%; width: 40%; }
}

/* branded (non-default) toasts — Clara style */
[data-sonner-toaster] { font-family: 'Plus Jakarta Sans', sans-serif; }
[data-sonner-toast] {
    border-radius: 18px !important;
    border: 1px solid rgba(15, 23, 42, 0.06) !important;
    box-shadow: 0 18px 45px rgba(2, 6, 23, 0.13) !important;
    padding: 15px 17px !important;
    background: rgba(255, 255, 255, 0.94) !important;
    backdrop-filter: blur(12px);
    gap: 12px !important;
}
[data-sonner-toast] [data-title] { font-weight: 600; color: #0f172a; }
[data-sonner-toast] [data-description] { color: #64748b; }
[data-sonner-toast] [data-icon] { margin-right: 4px; }
[data-sonner-toast][data-type="success"] { box-shadow: 0 18px 45px rgba(16,185,129,0.18), inset 4px 0 0 #10b981 !important; }
[data-sonner-toast][data-type="error"]   { box-shadow: 0 18px 45px rgba(225,29,72,0.18), inset 4px 0 0 #7380b6 !important; }
[data-sonner-toast][data-type="info"]    { box-shadow: 0 18px 45px rgba(99,102,241,0.16), inset 4px 0 0 #6366f1 !important; }

h1, h2, h3, h4, .font-display {
    font-family: 'Outfit', sans-serif;
}

.font-mono, code, pre {
    font-family: 'JetBrains Mono', monospace;
}

@layer base {
    :root {
        --background: 0 0% 100%;
        --foreground: 222 47% 11%;
        --card: 0 0% 100%;
        --card-foreground: 222 47% 11%;
        --popover: 0 0% 100%;
        --popover-foreground: 222 47% 11%;
        --primary: 347 77% 50%;
        --primary-foreground: 0 0% 100%;
        --secondary: 210 40% 96%;
        --secondary-foreground: 222 47% 11%;
        --muted: 210 40% 96%;
        --muted-foreground: 215 16% 47%;
        --accent: 210 40% 96%;
        --accent-foreground: 222 47% 11%;
        --destructive: 0 84% 60%;
        --destructive-foreground: 0 0% 98%;
        --border: 214 32% 91%;
        --input: 214 32% 91%;
        --ring: 347 77% 50%;
        --radius: 0.65rem;
    }
}

@layer base {
    * {
        @apply border-border;
    }
    body {
        @apply bg-background text-foreground;
    }
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 9px; height: 9px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

.sidebar-scroll::-webkit-scrollbar-thumb { background: #334155; }

@keyframes clara-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
}
.clara-fade-up { animation: clara-fade-up 0.5s cubic-bezier(.22,1,.36,1) both; }

@keyframes clara-float-in {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
.clara-float-in { animation: clara-float-in 0.6s cubic-bezier(.22,1,.36,1) both; }
CLARA_CSS_EOF
echo "✓ wrote src/index.css"

# ---------------------------------------------------------------------------
# 2) tailwind.config.js
# ---------------------------------------------------------------------------
cat > tailwind.config.js <<'CLARA_TW_EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  // `overline` is a Tailwind utility; without this an app's own eyebrow-label class draws a line above the text.
  blocklist: ["overline"],
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        // Periwinkle brand scale — overrides Tailwind's default `rose` so every
        // rose-* utility already used across shadcn becomes brand-coloured.
        rose: {
          50: '#f3f4fa', 100: '#e7e9f4', 200: '#d0d4e8', 300: '#aab2d4',
          400: '#8f99c5', 500: '#7380b6', 600: '#6673ab', 700: '#545f8f',
          800: '#454d72', 900: '#3b415e', 950: '#252a40',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))', '2': 'hsl(var(--chart-2))', '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))', '5': 'hsl(var(--chart-5))'
        }
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
CLARA_TW_EOF
echo "✓ wrote tailwind.config.js"

# ---------------------------------------------------------------------------
# 3) dependencies
# ---------------------------------------------------------------------------
echo "↳ installing framer-motion, lucide-react, sonner, tailwindcss-animate ..."
yarn add framer-motion lucide-react sonner tailwindcss-animate >/dev/null 2>&1 || \
  echo "⚠  yarn add failed — install manually: yarn add framer-motion lucide-react sonner tailwindcss-animate"

# ---------------------------------------------------------------------------
# 4) example primitives (optional reference file — safe to delete)
# ---------------------------------------------------------------------------
cat > src/ClaraStyleReference.jsx <<'CLARA_REF_EOF'
// Reference primitives in the exact Clara Campaigns style. Copy what you need.
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const P = "#7380b6";

export function ClaraCard({ children }) {
  return <div className="bg-white rounded-3xl clara-soft clara-hover clara-trans p-5">{children}</div>;
}

export function PrimaryBtn(props) {
  return <button {...props} className={`px-4 py-2 text-sm font-medium bg-[${P}] hover:opacity-90 text-white rounded-full clara-trans disabled:opacity-60`} />;
}

export function OutlineBtn(props) {
  return <button {...props} className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50 text-slate-700 clara-trans" />;
}

export function Input(props) {
  return <input {...props} className={`w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[${P}]`} />;
}

export function StatusBadge({ children }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Check className="h-3.5 w-3.5" /> {children}
    </span>
  );
}

export function PageTitle({ children }) {
  return <h1 className="font-display text-3xl font-bold text-slate-900">{children}</h1>;
}

export function Eyebrow({ children }) {
  return <div className="text-[11px] uppercase tracking-widest text-[#7380b6] font-bold">{children}</div>;
}

export function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl clara-soft w-full max-w-md p-6">
        {children}
      </motion.div>
    </div>
  );
}

// Remember to mount <Toaster position="top-right" richColors={false} /> from "sonner" once in your app root.
CLARA_REF_EOF
echo "✓ wrote src/ClaraStyleReference.jsx (optional, safe to delete)"

echo ""
echo "✅ Done. Next:"
echo "   1) Ensure src/index.js imports './index.css'."
echo "   2) Add <Toaster position=\"top-right\" richColors={false} /> from 'sonner' in your app root."
echo "   3) Restart frontend:  sudo supervisorctl restart frontend"
echo "   4) Build UI with the recipes in src/ClaraStyleReference.jsx"
