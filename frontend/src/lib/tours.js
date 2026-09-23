// Per-page guided tours, narrated by the koodh bear.
// Each entry maps a route to an ordered list of driver.js steps.

const el = (testid) => `[data-testid="${testid}"]`;

export const TOURS = {
  "/dashboard": [
    {
      popover: {
        title: "Hi, I'm Koodh! 👋",
        description: "Welcome to Clara Campaigns — your home for beautiful newsletters. Let me show you around this page. You can replay this tour anytime with the <b>Help</b> button.",
      },
    },
    { element: el("new-campaign-btn"), popover: { title: "Create a newsletter", description: "Click here to start a brand-new campaign in the drag-and-drop builder.", side: "bottom", align: "start" } },
    { element: el("dashboard-search"), popover: { title: "Find a campaign", description: "Quickly search through your campaigns by name or subject.", side: "bottom", align: "end" } },
    { element: el("workspace-switcher"), popover: { title: "Your workspaces", description: "Each company is a separate workspace with its own campaigns and contacts. Switch or add one here.", side: "bottom", align: "start" } },
    { element: el("global-search-btn"), popover: { title: "Search everything", description: "Press ⌘K / Ctrl+K anywhere to search campaigns and contacts in a flash.", side: "bottom", align: "end" } },
    { element: el("help-tour-btn"), popover: { title: "Need a hand?", description: "Tap Help on any page and I'll walk you through it. See you around!", side: "bottom", align: "end" } },
  ],
  "/campaigns": [
    { popover: { title: "Your campaigns", description: "This is where all your newsletters live — drafts, scheduled and sent." } },
    { element: el("new-campaign-btn"), popover: { title: "New campaign", description: "Start a fresh newsletter here.", side: "bottom", align: "end" } },
  ],
  "/contacts": [
    { popover: { title: "Your audience", description: "Manage everyone who receives your newsletters here." } },
    { element: el("group-tab-all"), popover: { title: "Automatic groups", description: "Filter between everyone, Subscribed and Unsubscribed contacts.", side: "bottom", align: "start" } },
    { element: el("import-csv-btn"), popover: { title: "Import contacts", description: "Bulk-add contacts from a CSV file (email, first name, last name, company, tags).", side: "bottom", align: "end" } },
    { element: el("add-contact-btn"), popover: { title: "Add one contact", description: "Or add a single contact by hand.", side: "bottom", align: "end" } },
    { element: el("export-csv-btn"), popover: { title: "Export", description: "Download your whole list as a CSV whenever you need it.", side: "bottom", align: "start" } },
  ],
  "/branding": [
    { popover: { title: "Make it yours", description: "Your logo, colours and website are applied automatically to every newsletter this company sends." } },
    { element: el("upload-logo-btn"), popover: { title: "Upload your logo", description: "Add your company logo — it appears in the footer of every email.", side: "right", align: "start" } },
    { element: el("brand-primary-picker"), popover: { title: "Brand colours", description: "Pick your primary and accent colours to match your identity.", side: "top", align: "start" } },
    { element: el("branding-website"), popover: { title: "Website", description: "Link your website so readers can find you.", side: "top", align: "start" } },
    { element: el("save-branding-btn"), popover: { title: "Save", description: "Hit save and your branding is live.", side: "top", align: "start" } },
  ],
  "/integrations": [
    { popover: { title: "Send from Microsoft 365", description: "Connect your Microsoft 365 mailbox so newsletters go out from your own address." } },
    { element: el("connect-o365-btn"), popover: { title: "Connect", description: "Click here to authorise Clara with Microsoft. Until then, sends run in a safe simulation mode.", side: "bottom", align: "start" } },
  ],
  "/settings": [
    { popover: { title: "Account & security", description: "Manage your profile photo, password and two-factor authentication here." } },
    { element: el("upload-avatar-btn"), popover: { title: "Profile photo", description: "Upload a photo — otherwise you get me, the koodh bear. 🐻", side: "right", align: "start" } },
    { element: el("regen-backup-codes-btn"), popover: { title: "Backup codes", description: "Generate one-time codes in case you lose your authenticator app.", side: "left", align: "start" } },
    { element: el("reset-mfa-btn"), popover: { title: "Reset two-factor", description: "Set up a new authenticator device by scanning a fresh QR code.", side: "left", align: "start" } },
  ],
  "/admin": [
    { popover: { title: "Administration", description: "As an admin you manage users, licenses and workspaces." } },
    { element: el("admin-tab-users"), popover: { title: "Users", description: "Assign licenses and link users to the right companies.", side: "bottom", align: "start" } },
  ],
};

export function getTourSteps(pathname) {
  const key = Object.keys(TOURS).find((k) => pathname === k || pathname.startsWith(k + "/"));
  return key ? TOURS[key] : null;
}
