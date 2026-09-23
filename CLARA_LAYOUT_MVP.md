# Clara Campaigns — LAYOUT MVP (exact app-shell to copy)

> This is the **exact** structure of the Clara Campaigns UI: the top navigation,
> logo lockup, workspace pill, page header and buttons. Copy the code below
> verbatim into another Emergent project. Only swap the NAV items, the logo image
> and the app name — keep everything else identical.
>
> ⚠️ Prerequisite: first apply the style tokens from `CLARA_DESIGN_SYSTEM.md`
> (fonts + `tailwind.config.js` + `index.css`). If the font looks different, the
> Google-Fonts `@import` and the `font-family` rules were NOT applied — that is the
> #1 reason another project "looks different".

---

## 0. Why the copy looked wrong (fix these first)

| Symptom in the copy            | Cause                                              | Fix |
|--------------------------------|----------------------------------------------------|-----|
| Font totally different         | Outfit / Plus Jakarta Sans not imported/applied    | Add the `@import` + `body`/`h1..h4`/`.font-display` rules from index.css |
| Menu is centered               | Clara's nav is **left-aligned** right after the workspace pill, inside a `flex-1` row | Use the `<nav>` below, not a centered one |
| Active menu item wrong colour  | Clara uses an **animated dark `bg-slate-900` pill** (Framer `layoutId`) | Use the NavLink block below |
| Buttons are outlined           | Clara's primary is a **solid periwinkle pill** (`bg-rose-600`) | Use `PrimaryButton` below |
| Logo different                 | Clara = small chevron mark + thin divider + wordmark | Use the `Logo` + header lockup below |

---

## 1. Fonts (must-have — this fixes the "different font")

`src/index.css` first line:
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```
```css
body { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; background: #F5F6F8; }
h1, h2, h3, h4, .font-display { font-family: 'Outfit', sans-serif; }
.font-mono, code, pre { font-family: 'JetBrains Mono', monospace; }
```

---

## 2. Logo (`src/components/Logo.jsx`)

Small chevron mark image (32px). Put your mark at `public/favicon-32.png`.
```jsx
export function Logo({ className = "" }) {
  return (
    <img src="/favicon-32.png" alt="logo" draggable="false"
      className={`h-6 w-6 object-contain ${className}`} />
  );
}
```

---

## 3. The app shell (`src/components/AppLayout.jsx`)

The whole page lives inside this. Key facts baked in:
- Canvas `bg-[#F5F6F8]`; sticky translucent header `bg-[#F5F6F8]/90 backdrop-blur-xl`, height `h-16`, centered container `max-w-[1400px] mx-auto px-6`.
- **Left cluster**: logo → `h-5 w-px bg-slate-200/70` divider → wordmark (`font-display font-semibold text-[15px]`) → workspace pill.
- **Nav (left-aligned, `flex-1`)**: pill links; the ACTIVE one gets an animated dark pill via `layoutId="nav-pill"`.
- **Right cluster (`ml-auto`)**: search icon, help icon, then avatar + chevron.
- Main content: `max-w-[1400px] mx-auto px-6 py-8`, page-enter fade/slide.

```jsx
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Globe, ChevronDown, Search, HelpCircle } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/contacts", label: "Contacts" },
  // ...swap in your own items
];

export default function AppLayout({ children, title, subtitle, actions }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <header className="sticky top-0 z-30 bg-[#F5F6F8]/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-3">

          {/* LEFT: logo lockup */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button onClick={() => navigate("/dashboard")}><Logo /></button>
            <div className="hidden sm:block h-5 w-px bg-slate-200/70" />
            <span className="hidden sm:block font-display font-semibold text-slate-900 text-[15px] whitespace-nowrap">
              Clara Campaigns
            </span>
          </div>

          {/* workspace pill (optional) */}
          <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors max-w-[220px]">
            <Globe className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm font-medium text-slate-800 truncate">Workspace</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {/* NAV — left aligned, animated dark active pill */}
          <nav className="hidden xl:flex items-center gap-0.5 ml-3 flex-1">
            {NAV.map(({ to, label }) => {
              const active = location.pathname === to || location.pathname.startsWith(to + "/");
              return (
                <NavLink key={to} to={to}
                  className="relative flex items-center px-3.5 py-2 rounded-full text-sm font-medium transition-colors hover:text-slate-900 whitespace-nowrap">
                  {active && (
                    <motion.span layoutId="nav-pill"
                      className="absolute inset-0 bg-slate-900 rounded-full shadow-lg shadow-slate-900/25"
                      transition={{ type: "spring", stiffness: 400, damping: 34 }} />
                  )}
                  <span className={`relative z-10 ${active ? "text-white" : "text-slate-500"}`}>{label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* RIGHT: search, help, avatar */}
          <div className="flex items-center gap-3 ml-auto">
            <button className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
              <HelpCircle className="h-[19px] w-[19px]" />
            </button>
            <div className="pl-3 border-l border-slate-200/60">
              <button className="flex items-center gap-2 rounded-full pr-1.5 py-1 pl-1 hover:bg-slate-100/70 transition-colors">
                <span className="h-9 w-9 rounded-full bg-rose-50 overflow-hidden shadow-sm">
                  <img src="/avatar.png" alt="" className="h-full w-full object-cover" />
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* mobile nav */}
        <nav className="xl:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `flex items-center px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${isActive ? "bg-slate-900 text-white" : "text-slate-600 bg-slate-100"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* MAIN */}
      <motion.main key={location.pathname}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="max-w-[1400px] mx-auto px-6 py-8">
        {(title || subtitle || actions) && (
          <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
            <div>
              {title && <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{title}</h1>}
              {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
        )}
        {children}
      </motion.main>
    </div>
  );
}
```

---

## 4. Buttons (solid periwinkle primary — NOT outline)

```jsx
import { motion } from "framer-motion";
export function PrimaryButton({ children, onClick, icon: Icon, ...props }) {
  return (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      onClick={onClick} {...props}
      className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors disabled:opacity-60">
      {Icon && <Icon className="h-4 w-4" />}{children}
    </motion.button>
  );
}
// Secondary (outline): px-4 py-2 text-sm border border-slate-200 rounded-full hover:bg-slate-50 text-slate-700
```
Usage in a page header:
```jsx
<AppLayout title="Campaigns" subtitle="5 campaign(s)"
  actions={<PrimaryButton icon={Plus}>New campaign</PrimaryButton>}>
  ...
</AppLayout>
```

---

## 5. Segmented filter tabs (the "CUSTOMER: All / …" row)

Clara active filter = filled brand pill; inactive = plain.
```jsx
<div className="flex items-center gap-2 flex-wrap">
  <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mr-1">Customer</span>
  {tabs.map((t) => (
    <button key={t.id} onClick={() => setActive(t.id)}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active === t.id ? "bg-[#7380b6] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
      {t.label}
    </button>
  ))}
</div>
```

---

## 6. List row / card (as in the Campaigns list)

```jsx
<div className="bg-white rounded-3xl clara-soft clara-hover clara-trans p-5 flex items-center gap-4">
  <span className="h-12 w-12 rounded-full bg-gradient-to-br from-[#8f99c5] to-[#545f8f] text-white flex items-center justify-center font-bold text-lg shrink-0">
    {name.slice(0,1)}
  </span>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2">
      <span className="font-semibold text-slate-900 truncate">{name}</span>
      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Draft</span>
    </div>
    <div className="text-sm text-slate-500 truncate">{subject}</div>
  </div>
  <div className="flex items-center gap-2 shrink-0">
    <button className="px-3 py-1.5 rounded-full text-sm border border-slate-200 hover:bg-slate-50">Analytics</button>
    <button className="px-3 py-1.5 rounded-full text-sm border border-slate-200 hover:bg-slate-50">Edit</button>
  </div>
</div>
```

---

## 7. Banner (alert card)

```jsx
<div className="mb-6 flex items-center gap-4 bg-white/70 backdrop-blur-md rounded-2xl clara-soft px-4 py-3.5 ring-1 ring-amber-100/70">
  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 shrink-0">
    <AlertCircle className="h-[18px] w-[18px]" />
  </span>
  <div className="text-sm text-slate-600 flex-1 leading-snug">
    <b className="text-slate-900">Heads up.</b> Your message here.
  </div>
  <button className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-full px-4 py-2">
    Action
  </button>
</div>
```

---

## 8. Non-negotiable layout rules (checklist)

- [ ] Google Fonts imported; body = Plus Jakarta Sans, headings/`.font-display` = Outfit.
- [ ] Canvas `bg-[#F5F6F8]`; header sticky + `backdrop-blur-xl`; container `max-w-[1400px] mx-auto px-6`.
- [ ] Logo lockup = mark + `h-5 w-px bg-slate-200/70` divider + `font-display font-semibold text-[15px]` wordmark.
- [ ] Nav is **left-aligned** (inside `flex-1`), NOT centered.
- [ ] Active nav item = animated `bg-slate-900` pill (`layoutId="nav-pill"`), white text; inactive `text-slate-500`.
- [ ] Avatar on the far right WITH a `ChevronDown`.
- [ ] Page title `font-display text-3xl font-bold`; actions right-aligned.
- [ ] Primary button = **solid** `bg-rose-600` pill (periwinkle), not outline.
- [ ] Cards `rounded-3xl clara-soft`; pills `rounded-full`; inputs `rounded-xl`.
- [ ] lucide-react icons only; Framer Motion for the page-enter and nav pill.
