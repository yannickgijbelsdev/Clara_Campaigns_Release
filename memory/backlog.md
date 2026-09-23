# Clara Campaigns — Active Backlog (fork)

## Batch A — in progress
1. [DONE, unverified] Global search modal (Cmd+K) — campaigns + contacts, active workspace
2. [DONE, unverified] Modernize the two amber banners (simulation + Azure not configured) to Clara style
3. [TODO] Move "Security" tab out of main nav → into dropdown under avatar/name
4. [TODO] Avatar upload (object storage) — storage.py done, endpoints pending
5. [TODO] Change password (authenticated)
6. [TODO] Remove Dashboard page title header ("Dashboard / Your newsletter workspace at a glance")
7. [TODO] MFA backup codes generate/regenerate (auth helpers done, endpoints pending)
8. [TODO] MFA reset / re-enroll (new secret + QR, confirm, regenerate backup codes)

## Batch B — new
9. Email footer "Send with Clara Campaigns" must link to https://campaigns.koodh.com
10. Attach the Clara logo to the email (inline/attachment)
11. Unsubscribe link for every recipient → track unsubscribe stats → remove from active sending list
12. Automatic groups/segments: Subscribed vs Unsubscribed (auto)
13. On login: activity digest of what happened while logged out (opens/clicks/unsubscribes/sends)

## Global settings
- Centralize PUBLIC_BASE_URL = https://campaigns.koodh.com (used for email footer link, unsubscribe links, subscribe redirect, and other public settings)

## Batch C — new (public subscription API + hosted form + categories)
14. Public subscription API embeddable on external websites; base URL campaigns.koodh.com
15. After connecting the API to a site → show a "connected" checkmark in the dashboard
16. Hosted subscribe form at campaigns.koodh.com: collects last name, first name, email, city/municipality
17. Form shows clearly what they are subscribing to; checkboxes to pick which categories they want mail about
18. Dashboard: create/manage Categories; link categories when sending a newsletter (target by category)

