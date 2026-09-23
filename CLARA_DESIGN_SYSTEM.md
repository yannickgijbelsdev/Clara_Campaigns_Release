# Clara Design System — MVP Layout & Style Spec

> Reusable, copy‑paste design system extracted 1:1 from the Clara Campaigns app.
> Drop the config blocks into any new Emergent project (React + Tailwind + shadcn)
> to get **exactly** the same look & feel. Stack: React (JS, not TSX) · Tailwind ·
> shadcn/ui · Framer Motion · lucide-react · Sonner.

---

## 1. Design principles (the "vibe")

- **Soft, floating, high‑precision SaaS.** White cards on a warm‑grey canvas, deep
  soft shadows, generous whitespace, rounded corners. Nothing flat or boxy.
- **Left‑aligned, structured grids.** Never center the whole app. Readable columns
  with lots of breathing room.
- **Muted periwinkle brand (`#7380b6`)** paired with slate neutrals and crisp status
  colours. Calm and corporate, never loud.
- **Tactile micro‑interactions.** Cards lift on hover, elements fade/float in on load,
  transitions target specific properties (never `transition: all`).
- **Pill‑shaped controls**, segmented tab switches, glassy blurred overlays.
- **Icons: lucide-react only. No emoji as UI icons.**

---

## 2. Fonts

Add to the top of `index.css` (single import):

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

| Role      | Family                         | Usage                                   |
|-----------|--------------------------------|-----------------------------------------|
| Display   | **Outfit**                     | All headings, `.font-display`, big stats |
| Body/UI   | **Plus Jakarta Sans**          | Default body font on `<body>`           |
| Mono      | **JetBrains Mono**             | Code, HTML editor, `code`/`pre`         |

```css
body { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; }
h1, h2, h3, h4, .font-display { font-family: 'Outfit', sans-serif; }
.font-mono, code, pre { font-family: 'JetBrains Mono', monospace; }
```

---

## 3. Colour palette

### Brand (periwinkle) — override Tailwind's `rose` scale so all existing `rose-*` utilities become brand-coloured
```
50  #f3f4fa   100 #e7e9f4   200 #d0d4e8   300 #aab2d4   400 #8f99c5
500 #7380b6   600 #6673ab   700 #545f8f   800 #454d72   900 #3b415e   950 #252a40
```
- **Primary:** `#7380b6`  · **Primary hover:** `#545f8f`

### CSS custom properties
```css
:root {
  --clara-primary: #7380b6;
  --clara-primary-hover: #545f8f;
  --clara-light-bg: #F5F6F8;   /* app canvas */
  --o365-blue: #0078D4;        /* Microsoft/Office 365 accent */
}
```

### Neutrals (Tailwind slate)
| Token            | Value / class            | Use                              |
|------------------|--------------------------|----------------------------------|
| Text primary     | `#0f172a` / `slate-900`  | Headings, key text               |
| Text secondary   | `slate-600` / `slate-500`| Body, descriptions               |
| Text muted/caption | `slate-400`            | Eyebrows, captions, placeholders |
| Border           | `slate-200`              | Card & input borders             |
| Subtle surface   | `slate-100` / `slate-50` | Tab tracks, table headers        |
| App canvas       | `#F5F6F8`                | Page background                  |
| Card surface     | `#FFFFFF`                | Cards, modals, nav               |
| Dark surface     | `#0F172A`                | Dark nav / code editor bg        |

### Status colours
| State            | Background / text / border                                   |
|------------------|--------------------------------------------------------------|
| Success / sent   | `bg-emerald-50 text-emerald-700 border-emerald-200` (#10b981)|
| Sending / warn   | `bg-amber-50 text-amber-700 border-amber-200` (+`animate-pulse`) |
| Error / failed   | `bg-rose-50 text-rose-700 border-rose-200` (brand periwinkle)|
| Info             | `text-indigo-600` (#6366f1)                                  |
| O365 connected   | `#0078D4`                                                    |

---

## 4. Radius, shadow, spacing

```css
--radius: 0.65rem;                 /* shadcn base; md/sm derive from it */

.clara-soft  { box-shadow: 0 4px 24px rgba(2, 6, 23, 0.06); }         /* floating card */
.clara-hover:hover { transform: translateY(-3px);
                     box-shadow: 0 14px 40px rgba(2, 6, 23, 0.09); }  /* lift on hover */
```

- **Cards / modals:** `rounded-3xl` (1.5rem) primary, `rounded-2xl` secondary.
- **Pills / buttons / badges:** `rounded-full`.
- **Inputs:** `rounded-xl`.
- **Padding:** cards `p-5`–`p-6`; page content generous, ~2× comfortable.
- **Shadows come from `.clara-soft`**, not Tailwind `shadow-*`, for the signature soft depth.

---

## 5. Motion

```css
button, a, .clara-trans {
  transition: color .2s ease, background-color .2s ease, border-color .2s ease,
              box-shadow .25s ease, transform .25s cubic-bezier(.22,1,.36,1);
}

@keyframes clara-fade-up { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.clara-fade-up { animation: clara-fade-up .5s cubic-bezier(.22,1,.36,1) both; }

@keyframes clara-float-in { from{opacity:0;transform:translateY(20px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
.clara-float-in { animation: clara-float-in .6s cubic-bezier(.22,1,.36,1) both; }
```

- **Framer Motion** for entrance/stagger: `initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}
  transition={{type:"spring",stiffness:200,damping:22}}`; stagger lists with `delay: i*0.04`.
- **Never** use `transition: all` — always target specific properties.

---

## 6. App shell / layout

- **Top navigation bar** (not a heavy sidebar): white, floating, holds the logo,
  workspace switcher, primary nav links, global search (⌘K), help, and user avatar
  dropdown. Active link uses a filled brand pill.
- **Logo lockup:** chevron mark + thin vertical divider (`h-6 w-px bg-slate-200`) +
  **`Clara Campaigns`** in `font-display font-semibold`.
- **Content container:** app canvas `#F5F6F8`, generous padding, left‑aligned grids,
  comfortable max width.
- **Grids:**
  - Stat/bento row: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
  - Split/analytics: `grid grid-cols-1 lg:grid-cols-3 gap-6`
  - Editor workspace: `grid grid-cols-12 gap-5` (3 / 6 / 3 columns)

---

## 7. Component recipes (copy‑paste classNames)

**Floating card**
```jsx
<div className="bg-white rounded-3xl clara-soft clara-hover clara-trans p-5">…</div>
```

**Primary button (pill)**
```jsx
<button className="px-4 py-2 text-sm font-medium bg-[#7380b6] hover:opacity-90 text-white rounded-full clara-trans disabled:opacity-60">…</button>
```

**Secondary / outline button**
```jsx
<button className="px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50 text-slate-700 clara-trans">…</button>
```

**Segmented tab switch**
```jsx
<div className="flex items-center gap-1 bg-slate-100 rounded-full p-1 w-fit">
  <button className="px-4 py-2 rounded-full text-sm font-medium bg-white shadow-sm text-[#7380b6]">Active</button>
  <button className="px-4 py-2 rounded-full text-sm font-medium text-slate-600">Inactive</button>
</div>
```

**Text input**
```jsx
<input className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7380b6]" />
```

**Status badge**
```jsx
<span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
  <Check className="h-3.5 w-3.5" /> Sent
</span>
```

**Eyebrow / caption label**
```jsx
<div className="text-[11px] uppercase tracking-widest text-[#7380b6] font-bold">Clara</div>
```

**Table**
```jsx
<div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">…</thead>
    <tbody className="divide-y divide-slate-100"> <tr className="hover:bg-slate-50">…</tr> </tbody>
  </table>
</div>
```

**Modal (overlay + panel)**
```jsx
<div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
  <motion.div initial={{opacity:0,y:-10,scale:.98}} animate={{opacity:1,y:0,scale:1}}
    className="bg-white rounded-3xl clara-soft w-full max-w-md p-6">…</motion.div>
</div>
```

**Big stat**
```jsx
<div className="text-[42px] font-display font-bold text-slate-900 leading-none">128</div>
```

---

## 8. Typography scale (as used in‑app)

| Element        | Classes                                                        |
|----------------|----------------------------------------------------------------|
| Page title     | `font-display text-3xl font-bold text-slate-900`               |
| Section head   | `font-display text-lg font-semibold text-slate-900`            |
| Body           | `text-sm text-slate-600 leading-relaxed`                       |
| Caption/eyebrow| `text-[11px] uppercase tracking-widest font-bold text-[#7380b6]`|
| Big stat       | `text-[42px] font-display font-bold`                           |

---

## 9. Toasts (Sonner) — branded style

```css
[data-sonner-toaster] { font-family: 'Plus Jakarta Sans', sans-serif; }
[data-sonner-toast] {
  border-radius: 18px !important;
  border: 1px solid rgba(15,23,42,.06) !important;
  box-shadow: 0 18px 45px rgba(2,6,23,.13) !important;
  padding: 15px 17px !important;
  background: rgba(255,255,255,.94) !important;
  backdrop-filter: blur(12px);
  gap: 12px !important;
}
[data-sonner-toast] [data-title] { font-weight: 600; color: #0f172a; }
[data-sonner-toast] [data-description] { color: #64748b; }
[data-sonner-toast][data-type="success"] { box-shadow: 0 18px 45px rgba(16,185,129,.18), inset 4px 0 0 #10b981 !important; }
[data-sonner-toast][data-type="error"]   { box-shadow: 0 18px 45px rgba(225,29,72,.18),  inset 4px 0 0 #7380b6 !important; }
[data-sonner-toast][data-type="info"]    { box-shadow: 0 18px 45px rgba(99,102,241,.16), inset 4px 0 0 #6366f1 !important; }
```

Custom icons per type (lucide): `CheckCircle2` (success), `XCircle` (error), `Info`,
`Loader2 animate-spin` (loading).

---

## 10. Custom scrollbar

```css
::-webkit-scrollbar { width: 9px; height: 9px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.sidebar-scroll::-webkit-scrollbar-thumb { background: #334155; } /* on dark surfaces */
```

---

## 11. Tailwind config (drop‑in)

`tailwind.config.js` → `theme.extend.colors` (keep the shadcn HSL vars as‑is, add the
brand scale that overrides `rose`):

```js
colors: {
  rose: {
    50:'#f3f4fa',100:'#e7e9f4',200:'#d0d4e8',300:'#aab2d4',400:'#8f99c5',
    500:'#7380b6',600:'#6673ab',700:'#545f8f',800:'#454d72',900:'#3b415e',950:'#252a40',
  },
  // shadcn tokens (unchanged): background, foreground, card, popover, primary,
  // secondary, muted, accent, destructive, border, input, ring, chart.*
},
borderRadius: { lg:'var(--radius)', md:'calc(var(--radius) - 2px)', sm:'calc(var(--radius) - 4px)' },
```
```js
plugins: [require("tailwindcss-animate")],
blocklist: ["overline"],  // prevents an eyebrow-label class from drawing a top border
darkMode: ["class"],
```

shadcn base tokens (`@layer base :root`): `--radius: 0.65rem;` plus standard
`--background 0 0% 100%`, `--foreground 222 47% 11%`, `--border 214 32% 91%`, etc.

---

## 12. Rules (do / don't)

**Do**
- Left‑aligned, structured grids with generous spacing.
- `.clara-soft` for card depth; `.clara-hover` for hover lift.
- Pill buttons, segmented tabs, `rounded-3xl` cards, `rounded-xl` inputs.
- Specific CSS transitions; Framer Motion for staggered reveals.
- A `data-testid` (kebab-case) on **every** interactive element and key info node.
- lucide-react icons; Sonner for all confirmations.

**Don't**
- No `transition: all`.
- No transparent/unstyled native dropdowns, headers, or overlays.
- No emoji as UI icons.
- Don't center the whole app container.
- No generic purple‑gradient "AI‑slop" look; commit to the periwinkle + slate palette.

---

## 13. Minimal starter checklist for a new Emergent project

1. Paste the Google Fonts `@import` + font-family rules into `index.css`.
2. Paste the `:root` Clara variables, `.clara-soft/.clara-hover/.clara-trans`, keyframes,
   scrollbar, and Sonner blocks into `index.css`.
3. Add the `rose` brand scale + `borderRadius` + plugins to `tailwind.config.js`.
4. Build the shell: white floating top nav (logo + divider + bold name), `#F5F6F8` canvas.
5. Use the component recipes in §7 for every card, button, tab, input, table, modal.
6. Add Framer Motion entrance animations and Sonner toasts.
7. Put `data-testid` on everything interactive.
