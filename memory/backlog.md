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
