# Clara Campaigns — PRD

## Original Problem Statement
Platform (Dutch) om nieuwsbrieven te versturen vanuit Office365-mailboxen (Microsoft Graph OAuth). Nieuwsbrieven maken met HTML-editor en voorgeprogrammeerde blokken (afbeelding, logo, tekstblok met keuze titel/gewone tekst, knoppen). Login met MFA. Volledige statistieken (wie opende/klikte). Ontvangers importeerbaar via CSV.

## User Choices
- Sending: Microsoft 365 OAuth (Microsoft Graph API), delegated Mail.Send.
- MFA: Authenticator app (TOTP).
- Stats: sent, opened (open tracking), clicked (click tracking).
- Isolation: per-user data.
- Branding: "Clara Campaigns", layout reference clr.koodh.com (dark sidebar + light content).

## Architecture
- Backend: FastAPI + Motor (MongoDB). Modules: server.py (routes), auth.py (JWT+bcrypt+TOTP), ms_graph.py (MSAL/Graph send + tracking html transform), models.py, db.py.
- Frontend: React (CRA) + Tailwind + shadcn + framer-motion + recharts + sonner. Pages: Login, Dashboard, Campaigns, Builder, Contacts, Integrations, Settings, Analytics.
- Auth: JWT Bearer (+cookie), mandatory TOTP MFA set up on first login.

## Implemented (2026-06-23)
- Login/register with mandatory TOTP MFA (QR enrollment + verify), brute-force lockout (X-Forwarded-For + email key).
- Drag/add newsletter builder: blocks Logo, Title (h1/h2/h3), Text, Image, Button, Divider, Spacer; visual + raw HTML editor modes with live iframe preview; email-safe HTML generation.
- Contacts: CRUD + CSV import (flexible header mapping, dedup) + search; scoped per company.
- Office365 integration UI + backend OAuth (MSAL) — needs Azure keys; SIMULATION mode when unconfigured. Step-by-step Microsoft 365 connection guide on the Integrations page.
- Campaign send with per-recipient deliveries; open tracking (pixel) + click tracking (link rewrite/redirect).
- Analytics: KPI cards, bar chart, top links, per-recipient open/click log; dashboard aggregates.
- Verified end-to-end via testing agent (iteration_1: fixes applied; iteration_2: 27/27 backend + frontend flows pass).

## Iteration 2 (2026-06-23) — koodh/clara redesign + admin
- Full UI redesign to English + crimson/rose theme with a top navigation bar (koodh/clara reference look), "clara campaigns" wordmark, and striped login with floating feature bubbles.
- Framer-motion animations: sliding active-nav pill (layoutId), page transitions, staggered lists, button micro-interactions.
- Companies / Workspaces: each has its own campaigns & contacts; workspace switcher in top nav; scoping via X-Company-Id header; default workspace auto-created on register.
- Admin role (yannick.gijbels@koodh.com): Admin page to view ALL users and assign/revoke licenses (free/pro/enterprise), and manage companies. Non-admins are redirected away from /admin.
- Licensing: sending a campaign requires an active license (admins exempt); unlicensed users get 403.

## Admin accounts
- yannick.gijbels@koodh.com / Koodh2026! (Administrator, enterprise license)
- admin@claracampaigns.com / Admin123! (Administrator)

## Backlog / Remaining
- P0: Provide Azure App Registration keys (MS_CLIENT_ID/SECRET/TENANT) to enable real Office365 sending (currently SIMULATION).
- P1: Durable send queue/worker (currently asyncio task); scheduled sends; unsubscribe handling.
- P2: Rich-text formatting in text block; template library; register rate-limiting/CAPTCHA; MFA recovery codes.

## Test Credentials
See /app/memory/test_credentials.md (admin@claracampaigns.com / Admin123!).
