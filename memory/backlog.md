# Clara Campaigns — Active Backlog (fork)

## DONE & verified (iteration_3.json)
- Global search spotlight modal (Cmd/Ctrl+K) — campaigns + contacts, active workspace
- Modernized amber banners (simulation + Azure not configured)
- Security moved into avatar dropdown; avatar upload; change password
- MFA backup codes (generate/status) + MFA reset/re-enroll (QR confirm)
- Dashboard page title header removed
- Admin nav label '<' → 'Administration'
- Responsive header fix (inline nav at xl, scroll chip-nav below xl) — verified 1920/1280/1024/390
- Company Branding page (logo upload, primary/accent colors, website, name) — applied to newsletter footer
- First-login onboarding modal for non-admin users (branding setup)
- Admin can link users to companies (member_ids); membership-aware scope/list
- Contacts auto-groups: Subscribed / Unsubscribed tabs + badge
- Unsubscribe: signed HMAC token (resend-proof, non-enumerable); marks contact unsubscribed; excluded from sends; invalid token → 404
- Email footer injected at send: company logo + website + "Sent with Clara Campaigns" (→ campaigns.koodh.com) + unsubscribe; logo attached to real Graph sends
- Dashboard total_unsubscribed count

## Global settings
- PUBLIC_BASE_URL = https://campaigns.koodh.com (footer brand link)

## TODO — next
13. Login activity digest ("what happened while you were logged out": new opens/clicks/unsubscribes/sends since last login) — pop-up after login

## Batch C — public subscription API + hosted form + categories (NOT STARTED)
14. Public subscription API embeddable on external websites; base URL campaigns.koodh.com
15. After connecting the API to a site → "connected" checkmark in dashboard
16. Hosted subscribe form at campaigns.koodh.com: last name, first name, email, city/municipality
17. Form shows what they subscribe to; checkboxes to pick categories
18. Dashboard: create/manage Categories; target categories when sending a newsletter

## DONE (this session, extra)
- Uploads migrated to Hetzner S3 (bucket koodh-clara, public-read) — avatars + company logos; verified public URL 200. storage.py uses boto3, no Emergent object storage.
- Email links (tracking, unsubscribe, footer), OAuth redirect URI and post-callback redirect now use PUBLIC_BASE_URL = https://campaigns.koodh.com (no Emergent URLs in emails/instructions). Integrations page shows campaigns.koodh.com redirect URI.
- All browser window.confirm replaced by custom Clara ConfirmDialog (Campaigns delete, Contacts delete-all, Settings regen backup codes, Admin delete company).
- Workspace switch shows the ProgressOverlay checklist instead of a hard reload.
- Newsletter builder pre-applies company branding: new campaign seeds the company logo; Logo/Button/Title block defaults use company logo/website + primary/accent colours (still editable).

## NEXT BIG EPIC — Batch C (public subscription API + docs + editable form + categories)
- Separate "API" / "Subscribe" menu item with: manual/docs, explanation, the API key + endpoint + embed snippet to put on a website.
- Generate per-company API key; show it; "connected" checkmark once a site calls the API.
- Warning/error banner everywhere when the API/subscribe form isn't set up (no website linked).
- Show the hosted subscribe form URL (campaigns.koodh.com/subscribe/<slug>) + preview.
- Editable subscribe form (like the newsletter builder): fields last name, first name, email, city; category checkboxes; shows what they subscribe to.
- Categories CRUD in dashboard; contacts carry categories; target categories when sending.

## DONE (Batch F)
- Fixed category_ids→categories mismatch in create_contact (iter_4 bug); source tag added (imported/manual/subscribe_form).
- Contacts list shows tags: status (Subscribed/Unsubscribed), source (Imported/Form/Manual) and category names (as tags).
- Send modal: target by tag/category (send-cat-<id>); backend filters by category_ids, excludes unsubscribed. Live count of matching subscribers.
- Subscribe form live preview now shows labeled fields (First/Last name, Email, City).
- Email footer now includes a "Manage your preferences" button (links to the public subscribe form) + unsubscribe.
- Default email sender EMAIL_SENDER=clara@koodh.com (used as fallback; real Graph send uses the connected mailbox).

## STILL OPEN / PARTIAL (Batch F)
- Editable field LABELS on the subscribe form (rename "First name" etc.) — currently labels are fixed; only title/intro/thankyou/collect-city editable.
- "clara@koodh.com" as the true FROM: needs the clara@koodh.com mailbox connected in Microsoft 365 (real sends use that mailbox); the plan-request email via Emergent Resend still shows the Emergent from-domain (needs domain verification to change).
- Targeting by the "imported" tag specifically (status subscribed/unsubscribed already handled).
