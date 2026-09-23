// Per-page guided tours, narrated by the koodh bear.
// Each entry maps a route to an ordered list of driver.js steps.
// Selectors that start with ^= match the first element of a repeated list.

const el = (testid) => `[data-testid="${testid}"]`;
const first = (prefix) => `[data-testid^="${prefix}"]`;

export const TOURS = {
  "/dashboard": [
    {
      popover: {
        title: "Hi, I'm Koodh! 👋",
        description: "Welcome to Clara Campaigns. I'll point out <b>every button</b> so you know exactly what each one does. You can replay this on any page with the <b>Help</b> button (the ? icon).",
      },
    },
    { element: el("brand-logo"), popover: { title: "Home logo", description: "Click the koodh · clara logo anywhere to jump back to this dashboard.", side: "bottom", align: "start" } },
    { element: el("plan-chip"), popover: { title: "Your plan", description: "This gem shows your current license — hover it to see Free, Pro or Enterprise.", side: "bottom", align: "start" } },
    { element: el("workspace-switcher"), popover: { title: "Workspace switcher", description: "Each company is a separate workspace with its own campaigns and contacts. Click to switch companies or add a new one.", side: "bottom", align: "start" } },
    { element: el("nav-dashboard"), popover: { title: "Dashboard tab", description: "Your overview at a glance — totals and recent campaigns.", side: "bottom", align: "start" } },
    { element: el("nav-campaigns"), popover: { title: "Campaigns tab", description: "Create, edit, send and track all your newsletters here.", side: "bottom", align: "start" } },
    { element: el("nav-contacts"), popover: { title: "Contacts tab", description: "Manage your recipients, groups and CSV import/export.", side: "bottom", align: "start" } },
    { element: el("nav-branding"), popover: { title: "Branding tab", description: "Set the logo, colours and website that appear in every email.", side: "bottom", align: "start" } },
    { element: el("nav-integrations"), popover: { title: "E-mail / SMTP tab", description: "Set up your SMTP server so newsletters send from your own address.", side: "bottom", align: "start" } },
    { element: el("global-search-btn"), popover: { title: "Search button", description: "Find any campaign or contact instantly. Tip: press ⌘K / Ctrl+K anywhere.", side: "bottom", align: "end" } },
    { element: el("help-tour-btn"), popover: { title: "Help button", description: "That's me! Tap this ? on any page to replay its tour.", side: "bottom", align: "end" } },
    { element: el("user-menu-btn"), popover: { title: "Your account", description: "Open your profile photo, password, two-factor settings and sign out.", side: "bottom", align: "end" } },
    { element: el("new-campaign-btn"), popover: { title: "New campaign", description: "The big button — starts a brand-new newsletter in the drag-and-drop builder.", side: "bottom", align: "start" } },
    { element: el("dashboard-search"), popover: { title: "Search campaigns", description: "Filter the list below by campaign name or subject.", side: "bottom", align: "end" } },
  ],

  "/campaigns": [
    { popover: { title: "Campaigns", description: "Every newsletter lives here — drafts, scheduled and sent. Let me name each button." } },
    { element: el("new-campaign-btn"), popover: { title: "New campaign", description: "Opens the builder to create a fresh newsletter.", side: "bottom", align: "end" } },
    { element: first("analytics-"), popover: { title: "Analytics button", description: "Opens open- and click-statistics for that campaign.", side: "left", align: "start" } },
    { element: first("edit-"), popover: { title: "Edit button", description: "Reopens the builder so you can change the content.", side: "left", align: "start" } },
    { element: first("delete-"), popover: { title: "Delete button", description: "Permanently removes that campaign (it asks for confirmation first).", side: "left", align: "start" } },
  ],

  "/campaigns/builder": [
    { popover: { title: "The newsletter builder", description: "This is where you design your email. I'll name every control." } },
    { element: el("campaign-name-input"), popover: { title: "Campaign name", description: "An internal name for you — recipients never see it.", side: "bottom", align: "start" } },
    { element: el("campaign-subject-input"), popover: { title: "Subject line", description: "The subject your recipients see in their inbox.", side: "bottom", align: "start" } },
    { element: el("mode-visual"), popover: { title: "Visual mode", description: "Build with drag-and-drop blocks — no code needed.", side: "bottom", align: "start" } },
    { element: el("mode-html"), popover: { title: "HTML mode", description: "Prefer code? Paste or edit raw HTML here instead.", side: "bottom", align: "start" } },
    { element: first("add-block-"), popover: { title: "Content blocks", description: "Add pre-made blocks: logo, title, text, image, button, divider and spacer. Click one to drop it in.", side: "right", align: "start" } },
    { element: el("preview-btn"), popover: { title: "Preview", description: "See exactly how your email will look before sending.", side: "bottom", align: "end" } },
    { element: el("save-btn"), popover: { title: "Save", description: "Saves your campaign as a draft so you can finish later.", side: "bottom", align: "end" } },
    { element: el("send-btn"), popover: { title: "Send", description: "Choose recipients and send now — or schedule it for later.", side: "bottom", align: "end" } },
  ],

  "/contacts": [
    { popover: { title: "Contacts", description: "Everyone who receives your newsletters. Here's what each button does." } },
    { element: el("group-tab-all"), popover: { title: "Automatic groups", description: "Switch between All, Subscribed and Unsubscribed. Unsubscribed people are never emailed again.", side: "bottom", align: "start" } },
    { element: el("contact-search"), popover: { title: "Search contacts", description: "Find a contact by email, name or company.", side: "bottom", align: "start" } },
    { element: el("export-csv-btn"), popover: { title: "Export", description: "Download your whole list as a CSV file.", side: "bottom", align: "end" } },
    { element: el("import-csv-btn"), popover: { title: "Import CSV", description: "Bulk-add contacts from a CSV (email, first name, last name, company, tags).", side: "bottom", align: "end" } },
    { element: el("delete-all-btn"), popover: { title: "Delete all", description: "Removes every contact in this workspace — use with care.", side: "bottom", align: "end" } },
    { element: el("add-contact-btn"), popover: { title: "Add contact", description: "Add a single contact by hand.", side: "bottom", align: "end" } },
    { element: first("history-contact-"), popover: { title: "History icon", description: "See which campaigns this contact received, opened and clicked.", side: "left", align: "start" } },
    { element: first("delete-contact-"), popover: { title: "Delete icon", description: "Removes just this one contact.", side: "left", align: "start" } },
  ],

  "/branding": [
    { popover: { title: "Company branding", description: "Your logo, colours and website are applied automatically to every newsletter this company sends." } },
    { element: el("branding-name"), popover: { title: "Company name", description: "Shown to your team and used across the app.", side: "bottom", align: "start" } },
    { element: el("upload-logo-btn"), popover: { title: "Upload logo", description: "Your logo appears in the footer of every email you send.", side: "right", align: "start" } },
    { element: el("brand-primary-picker"), popover: { title: "Primary colour", description: "Your main brand colour — used for buttons and accents.", side: "top", align: "start" } },
    { element: el("brand-accent-picker"), popover: { title: "Accent colour", description: "A secondary colour for headings and details.", side: "top", align: "start" } },
    { element: el("branding-website"), popover: { title: "Website", description: "Linked in your email footer so readers can find you.", side: "top", align: "start" } },
    { element: el("save-branding-btn"), popover: { title: "Save branding", description: "Saves everything and applies it to future newsletters.", side: "top", align: "start" } },
  ],

  "/integrations": [
    { popover: { title: "E-mail / SMTP", description: "Set up your own SMTP server to send real emails from your own address." } },
    { element: el("smtp-config-card"), popover: { title: "SMTP settings", description: "Enter your host, port, security, login and sender. Until it's set up, sends run safely in simulation mode (no real emails, tracking still works).", side: "bottom", align: "start" } },
    { element: el("test-smtp-config"), popover: { title: "Test connection", description: "Check your SMTP credentials work before sending a real campaign.", side: "bottom", align: "start" } },
  ],

  "/settings": [
    { popover: { title: "Account & security", description: "Everything about your personal account lives here." } },
    { element: el("upload-avatar-btn"), popover: { title: "Profile photo", description: "Upload a photo — without one you get me, the koodh bear. 🐻", side: "right", align: "start" } },
    { element: el("current-password"), popover: { title: "Change password", description: "Enter your current password, then a new one twice, to update it.", side: "right", align: "start" } },
    { element: el("save-password-btn"), popover: { title: "Update password", description: "Saves your new password.", side: "top", align: "start" } },
    { element: el("regen-backup-codes-btn"), popover: { title: "Backup codes", description: "Generate one-time codes to log in if you lose your authenticator app.", side: "left", align: "start" } },
    { element: el("reset-mfa-btn"), popover: { title: "Reset two-factor", description: "Set up a new authenticator device by scanning a fresh QR code.", side: "left", align: "start" } },
  ],

  "/admin": [
    { popover: { title: "Administration", description: "As an admin you manage users, licenses and workspaces." } },
    { element: el("admin-tab-users"), popover: { title: "Users tab", description: "See all users, assign or revoke licenses and link them to companies.", side: "bottom", align: "start" } },
    { element: el("admin-tab-companies"), popover: { title: "Companies tab", description: "Browse and manage every workspace on the platform.", side: "bottom", align: "start" } },
    { element: first("license-plan-"), popover: { title: "License dropdown", description: "Pick a plan (Free, Pro, Enterprise) for a user.", side: "left", align: "start" } },
    { element: first("assign-companies-"), popover: { title: "Workspaces button", description: "Link this user to the companies they should be able to access.", side: "left", align: "start" } },
  ],

  "/analytics": [
    { popover: { title: "Campaign analytics", description: "See how this newsletter performed — total sent, open rate, click rate, the most-clicked links and a per-recipient breakdown." } },
  ],
};

export function getTourSteps(pathname) {
  if (/^\/campaigns\/[^/]+\/analytics$/.test(pathname)) return TOURS["/analytics"];
  if (pathname === "/campaigns/new" || /^\/campaigns\/[^/]+$/.test(pathname)) return TOURS["/campaigns/builder"];
  const keys = Object.keys(TOURS)
    .filter((k) => !k.startsWith("/campaigns/") && k !== "/analytics" && (pathname === k || pathname.startsWith(k + "/")))
    .sort((a, b) => b.length - a.length);
  return keys.length ? TOURS[keys[0]] : null;
}
