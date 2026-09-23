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

## Iteration 3 (2026-06) — account, branding, membership, unsubscribe
- Global search spotlight (Cmd/Ctrl+K) across campaigns + contacts.
- Account & Security (moved under avatar dropdown): profile photo upload (object storage), change password, MFA backup codes (generate/status), MFA reset/re-enroll (QR confirm).
- Company Branding page (logo, primary/accent colors, website, name) — auto-applied to newsletter footer; logo attached to real Graph sends. PUBLIC_BASE_URL=campaigns.koodh.com for the "Sent with Clara Campaigns" footer link.
- First-login onboarding modal (non-admin) to set up company branding.
- Multi-user companies: company.member_ids[]; membership-aware scope() and /companies; Admin can link users to companies via PATCH /api/admin/users/{id}/companies.
- Unsubscribe: signed HMAC token (resend-proof, non-enumerable) injected in every email footer; GET /api/unsubscribe/{token} marks contact status=unsubscribed; unsubscribed excluded from sends; invalid token → 404 page.
- Contacts auto-groups: Subscribed / Unsubscribed tabs; dashboard total_unsubscribed.
- Responsive header fix (inline nav at xl; scrollable chip-nav below xl). Admin nav label → 'Administration'. Dashboard page title removed.
- Verified: iteration_3.json — frontend 100% of tested flows; backend 10/10 new (+prior unaffected).

## Backlog / Remaining (updated)
- P1: Login activity digest (what happened while logged out).
- P0 (ops): Provide Azure keys to leave SIMULATION mode for NEWSLETTER sending (MS Graph delegated OAuth). System emails already send via M365 SMTP.

## Changelog — 2026-09-23 (Iteration 5)
- Loading UX: all full-page/section loaders replaced by a full-screen "Clara bear" overlay (BearLoader) with a subtly animated koodh bear + rotating English newsletter tips (lib/tips.js). Kept visible for a MINIMUM ~4s via lib/useLoadingGate.js (Branding, ApiAccess, Analytics, SubscribePage, Contacts CSV import). ProgressOverlay (login/create/send) also shows the bear + rotating tip; Login shows the overlay for its full duration before redirect.
- Admin — Users: edit name/email/role (PATCH /api/admin/users/{id}), delete user with cascade (DELETE /api/admin/users/{id}), send password-reset link to the user (POST /api/admin/users/{id}/send-reset). Admin cannot demote/delete self (400). FIXED: GET /api/admin/users decorator was glued to a comment and never registered — now works.
- Admin — Companies: rename (PATCH /api/admin/companies/{id}).
- Plans: current plan highlighted (ring + "Current plan" badge); switching to Free is INSTANT (POST /api/plan/request {plan:'free'} → license {plan:'free',active:true}); paid plans still open the quote/request flow.
- System emails now send from clara@koodh.com via Microsoft 365 SMTP (email_util.smtp_ready/_send_via_smtp using aiosmtplib, smtp.office365.com:587 STARTTLS). Falls back to Emergent managed email only if SMTP is not configured. Verified live: test send + admin/public reset all accepted by M365.
- Tested: iteration_5.json — 11/11 backend, all frontend flows.

## Changelog — 2026-09-23 (Iteration 6)
- Newsletter personalization / merge tags: in the builder, Title/Text/Button blocks have a "Personalize" chip row that inserts {{first_name}}, {{last_name}}, {{name}} (full name) and {{email}}. On send, server.py `_apply_merge_tags` replaces the tokens per recipient (values HTML-escaped); missing values become empty.
- Send modal warning: if the newsletter uses a name tag and some target recipients have no first/last name filled in, a notice "Name can't be personalized for N contact(s)" lists exactly which contacts (by email) are affected (data-testid personalization-warning + missing-name-<id>). Hidden when no name tag is used or all recipients have names.
- Reset email now carries the Clara header branding (logo mark + vertical divider + bold "Clara Campaigns"); logo hosted on public S3 (assets/clara-mark.png).
- Tested: iteration_6.json — 10/10 backend; chip insertion + send warning verified via UI.
