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

## Changelog — 2026-09-23 (Iterations 7 & 8) — Logo in emails
- Newsletter footer (ms_graph.personalize_html) now shows the Clara Campaigns logo mark + bold "Clara Campaigns" next to "Sent with", alongside any company logo. (iteration_7)
- Shared brand lockup email_util.clara_brand_header(on_dark): Clara logo in a WHITE circular badge + vertical divider + bold "Clara Campaigns" — visible on dark & light headers.
- Password-reset email (reset_email_html) and plan-change-request email (server._plan_request_html) now both carry this branded logo header. CLARA_MARK asset hosted on public S3 (assets/clara-mark.png, HTTP 200). All templates pass _assert_safe_email.
- Verified: iteration_8.json — 14/14 backend tests; logo present in reset, plan-change and newsletter footer; plan/request + forgot-password + admin send-reset all 200.

## Changelog — 2026-09-23 (Iteration 9) — Production auth CORS fix
- FIXED production login/registration failure ("Er ging iets mis, probeer opnieuw"). Root cause: CORSMiddleware returned wildcard `Access-Control-Allow-Origin: *` together with `allow_credentials=true` on actual responses, which browsers reject for credentialed (withCredentials:true) cross-origin requests. Preview worked because it is same-origin.
- Fix (server.py ~L1283): when CORS_ORIGINS='*', use allow_origin_regex='.*' with allow_credentials=True so the caller Origin is reflected on both preflight and actual responses; explicit comma list still uses allow_origins.
- Requires a production redeploy to take effect.
- Verified: iteration_9.json — 8/8 backend (CORS reflection + register + first-login MFA + admin login + /auth/me).

## Changelog — 2026-09-23 (Iteration 10) — Production 502 backend crash hardening
- PRODUCTION diagnosis: campaigns.koodh.com returned HTTP 502 on ALL /api routes (frontend / = 200) → the production backend process was down / crash-looping at startup. This produced the "Er ging iets mis" on login/register.
- Fix 1 (ms_graph.py): removed module-level Fernet(os.environ["TOKEN_ENCRYPTION_KEY"]) — now lazy via _get_fernet(). A missing TOKEN_ENCRYPTION_KEY in prod can no longer crash the import/startup.
- Fix 2 (server.py startup): wrapped index creation and _seed_admin in try/except so a failing create_index or seed logs and continues instead of aborting FastAPI lifespan startup (the 502 crash-loop).
- Requires a production REDEPLOY. If it still 502s afterwards, read the deployed backend logs for the specific startup exception (now logged, not fatal).
- Verified: iteration_10.json — 8/8 backend (boots without TOKEN_ENCRYPTION_KEY; register + MFA + admin login + /me + CORS all pass).

## Changelog — 2026-09-23 (Iteration 11) — Guaranteed admin seed
- Production had NO admin (both logins 401) because the startup seed returned early when ADMIN_* env vars weren't present in the production environment.
- Fix: _seed_admin now falls back to hardcoded defaults; startup seeds ONLY yannick.gijbels@koodh.com / KYLovie13monx (admin@claracampaigns.com seed removed per user request). Admin is now always created/updated on startup regardless of env.
- Requires a production REDEPLOY. On the fresh prod DB, yannick is created with mfa_enabled=false → first login shows the MFA setup QR.
- Verified: iteration_11.json — 4/4 backend (login+MFA as admin, old password rejected, only-yannick seed, seed works without env vars).

## Changelog — 2026-09-23 (Iteration 12) — Microsoft 365 keys via UI
- Admins can now paste the Azure app registration keys (Client ID, Client Secret, Tenant ID) directly in the app: Integrations page → "Azure app credentials" card (admin-only). Previously the keys had to be set as backend env vars.
- Backend: GET/PUT/DELETE /api/admin/ms-config; stored in db.app_settings {_id:'ms_graph'} with the secret Fernet-encrypted (TOKEN_ENCRYPTION_KEY); secret is never returned by the API. ms_graph reads creds from a runtime cache (DB first, env fallback), loaded at startup and refreshed on save. No redeploy needed — takes effect immediately.
- Verified: iteration_12.json — 12/12 backend + frontend (auth gating, encryption-at-rest, secret preservation on partial update, validation, DELETE, SMTP regression).

## Changelog — 2026-09-23 (Iteration 13) — Setup checkmarks in nav
- The top-nav menu items now show a green checkmark when correctly configured: Microsoft 365 (mailbox connected), Branding (company logo uploaded → has_logo), API (subscribe API connected or a website linked). Frontend-only in AppLayout.js using existing /mailbox, /subscribe/settings, /company/branding; data-testids nav-check-integrations / nav-check-branding / nav-check-developers. Renders on desktop + mobile nav.
- Verified: iteration_13.json — 100% frontend (checks show when configured, absent when not, both viewports).

## Changelog — 2026-06 (Iteration 14) — Zachtere blauwe nav-vinkjes
- De integratie-vinkjes in de top-nav (desktop + mobiel) zijn nu een klein, subtiel blauw vinkje (#7380b6 @ 70%) ZONDER gevulde achtergrondcirkel, i.p.v. het felle groene badge-bolletje. Op de actieve (donkere) desktop-pill wordt het vinkje wit/80 zodat het leesbaar blijft. Alleen AppLayout.js gewijzigd; data-testids ongewijzigd (nav-check-*).

## Changelog — 2026-06 (Iteration 15) — Login redesign (vdc-stijl)
- Login volledig omgebouwd naar de vdc.koodh.com/login-stijl: één gecentreerde witte kaart (rounded-[28px], zachte schaduw, subtiele top-gradient) midden op de pagina, met de bijgeleverde Koodh-beren pixelart als paginavullende achtergrond (/clara-bear-bg.png in public/).
- Header-lockup (logo + divider + "Clara Campaigns") en "Welcome back" + subtitel zijn gecentreerd; inputs rounded-xl op bg-slate-50; Sign in-knop in sitekleur #7380b6 (hover #616fa6). Alle accenten/links/focus-rings nu #7380b6 i.p.v. rose.
- Zwevende feature-bubbels en split-layout verwijderd. Login/register/MFA/forgot-flows en alle data-testids ongewijzigd. Alleen Login.js gewijzigd + achtergrond-asset toegevoegd. Geverifieerd via screenshot (desktop).

## Changelog — 2026-06 (Iteration 16) — Microsoft 365 → simpele SMTP
- De volledige Microsoft 365 Graph/OAuth-verzendmethode voor nieuwsbrieven is vervangen door een SMTP-configuratie PER werkruimte. Verwijderd: ms_graph.py, alle /oauth/microsoft/*, /mailbox, /admin/ms-config endpoints, de Connect-knop en Azure-uitleg, MsConfigInput.
- Nieuw backend: GET/PUT/DELETE /api/company/smtp + POST /api/company/smtp/test (scoped via scope()). Config opgeslagen op company.smtp {host, port, security(starttls/ssl/none), username, from_email, from_name, password_enc}. Wachtwoord Fernet-versleuteld (TOKEN_ENCRYPTION_KEY), nooit teruggegeven; behouden bij partiële update. Verzenden gaat via email_util.send_newsletter_via_smtp; zonder config → simulatiemodus (mode 'smtp' vs 'simulation'). personalize_html + encrypt/decrypt verplaatst naar email_util.py.
- Nieuw frontend: /integrations herschreven naar Nederlandstalige SMTP-config (velden + testknop + verwijderen), nav-label 'E-mail / SMTP', nav-vinkje + simulatiebanner + Builder-waarschuwing op basis van smtp.configured. tours.js en Plans.js teksten bijgewerkt.
- Systeem-e-mails (reset, plan-aanvraag) ONGEWIJZIGD (blijven env-var M365 SMTP via email_util.send_email).
- Getest: iteration_14.json — 11/11 backend (CRUD, verborgen wachtwoord, behoud bij partiële update, test-fout op nep-host, oude MS-endpoints 404, forgot-password 200, simulation send). 100% frontend e2e.

## Changelog — 2026-06 (Iteration 18) — Search sync + scheduled countdown
- Fixed: the top-menu global search (⌘K) navigating to a contact now updates the Contacts page live via the ?q= URL param (Contacts syncs its search box to the URL). The Contacts page's own search box was already fine and is unchanged.
- Added: Campaigns list shows a live countdown badge ("Sends in Xd Yh Zm") + scheduled date on any campaign with status 'scheduled' (ScheduledCountdown, ticks every second). Verified via testing agent (12/12).

## Changelog — 2026-06 (Iteration 17) — Send test, import tags/overwrite, timezone, campaign thumbnails
- Send modal: "Send test to myself" button (POST /campaigns/{id}/test via SMTP); tag/category targeting retained.
- Contacts CSV import: pick categories to assign + two-step analyze→overwrite/skip prompt (POST /contacts/import mode=analyze|import, category_ids, overwrite). Result: "X added, Y updated, Z skipped".
- Timezone selector under Email/SMTP (PUT /company/timezone; GET /company/smtp returns timezone). Scheduling uses workspace timezone.
- Campaigns list: letter avatar replaced by a live iframe thumbnail of the newsletter HTML.

## Changelog — 2026-06 (Iteration 19) — Public form loader + prod env safety + TinyMCE
- Fixed: the PUBLIC subscribe form (/subscribe/:apiKey) no longer shows the internal Koodh BearLoader or the 4s loading gate — now a tiny neutral spinner then the form. Verified via testing agent (no bearloader, ~53ms render, invalid key → Form unavailable).
- Prod stability: hardened all `os.environ["BACKEND_URL"]`/`PUBLIC_BASE_URL`/`FRONTEND_URL` accesses (added `_public_base()` + `.get` fallbacks) so /subscribe/settings, /campaigns/{id}/test and sends can't 500 when those env vars are unset (root cause of production "Something went wrong"). Generic API error message switched to English. NOTE: production needs a REDEPLOY, and ideally PUBLIC_BASE_URL set to https://campaigns.koodh.com for correct public/tracking links.
- Newsletter editor: text block now uses TinyMCE (self-hosted via jsDelivr CDN, GPL license, no API key) for bold/italic/underline, lists, links, colors, alignment. (Implemented + compiles; full functional test still pending.)

## Changelog — 2026-06 (Iteration 20) — Email links/footer/unsubscribe + TinyMCE spacing
- TinyMCE text block: editor formatting (bold) and paragraph/enter spacing now MATCH the Preview (p{margin:0 0 16px} in both editor content_style and the email render via inline <p> styles).
- Email footer: removed 'Manage your preferences'; footer now shows only an 'Unsubscribe' pill button.
- Unsubscribe is now a PUBLIC two-step page: GET /api/unsubscribe/{token} shows a confirmation page with an Unsubscribe button (does NOT unsubscribe); POST performs the unsubscribe. Invalid token → 404 page.
- Absolute links: _public_base() falls back to https://campaigns.koodh.com; _run_send + /campaigns/{id}/test use it, so tracking/unsub/pixel hrefs are always absolute (fixes the `[relative-url]text` rendering in mail clients). Verified via testing agent (iteration_20).
- NOTE: production still needs a REDEPLOY for all the above + earlier env-safety fixes to take effect; ideally set PUBLIC_BASE_URL on prod too.

## Known deployment findings (backlog, not blocking auth)
- Integrations.js hardcodes the Microsoft OAuth redirect URL (campaigns.koodh.com) — fine for the koodh production domain but should be env-driven for portability.
- GET /api/campaigns runs N+1 count queries for stats — consider an aggregation pipeline for scale.

## Changelog — 2026-09-23 (Iteration 6b)
- Merge-tag fallback: tokens now support {{first_name|there}} syntax — when the contact's value is empty the fallback text is used instead (server.py _apply_merge_tags, regex captures optional |fallback; values HTML-escaped).
- Builder: the "Personalize" panel has a "Fallback when empty" input; chips insert {{key|fallback}} when a fallback is typed, otherwise {{key}}.
- Send warning now only appears when a name tag is used WITHOUT a fallback and some recipients lack the name; a fallback suppresses the notice. Verified via UI.

## Changelog — 2026-06 (Iteration 21) — TinyMCE focus frame + header horizontal scroll + email footer alignment
- TinyMCE: removed the annoying focus framing/outline. Inner iframe body outline:none (Builder.js content_style); outer container `.tox-edit-area::before` accent border removed and focus border set to subtle #7380b6 (index.css).
- Fixed page-level horizontal scroll (zijwaartse scroll) that appeared at ~1280–1440px: the top header (AppLayout.js) pushed the right group ~150px out of view. Brand name "Clara Campaigns" text + gem/lock decorative chips now defer to the `2xl` breakpoint so the full nav fits with no overflow. Verified scrollWidth===clientWidth at 1281/1366/1440/1500/1536/1920.
- Email footer alignment: logo changed from display:inline-block → display:block (margin:0 auto 18px) in email_util.personalize_html, so footer now stacks centered: logo → website → "Sent with Clara Campaigns" → Unsubscribe. Verified by rendering footer HTML in browser.

## Changelog — 2026-06 (Iteration 22) — Footer adopts workspace brand color
- email_util.personalize_html now reads company.brand_primary (fallback #7380b6) and applies it to the footer website link (colored + bold) and the Unsubscribe pill (brand-colored border + text). "Sent with Clara Campaigns" stays neutral grey (product credit). Verified rendering with #7380b6 and #e11d48 workspaces. NOTE: backend change — production needs a REDEPLOY to appear in live emails.
