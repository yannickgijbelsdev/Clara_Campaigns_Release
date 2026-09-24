// Generates email-safe HTML from newsletter blocks (table-based, inline styles).

export function renderBlock(b) {
  const p = b.props || {};
  const pad = "padding:8px 24px;";
  switch (b.type) {
    case "logo": {
      const align = p.align || "center";
      const w = p.width || 140;
      const src = p.src || "https://placehold.co/140x50/EEF2FF/4F46E5?text=LOGO";
      return `<tr><td style="padding:20px 24px;text-align:${align};">${
        p.link ? `<a href="${p.link}">` : ""
      }<img src="${src}" alt="${p.alt || "Logo"}" width="${w}" style="max-width:${w}px;height:auto;display:inline-block;border:0;" />${p.link ? "</a>" : ""}</td></tr>`;
    }
    case "title": {
      const level = p.level || "h1";
      const size = level === "h1" ? 30 : level === "h2" ? 24 : 19;
      const align = p.align || "left";
      const color = p.color || "#0F172A";
      return `<tr><td style="padding:14px 24px;"><div style="font-family:'Segoe UI',Arial,sans-serif;font-size:${size}px;line-height:1.25;font-weight:700;color:${color};text-align:${align};">${escapeText(p.text || "Title")}</div></td></tr>`;
    }
    case "text": {
      const align = p.align || "left";
      const color = p.color || "#334155";
      const raw = p.text || "Enter your text here.";
      const isHtml = /<[a-z][\s\S]*>/i.test(raw);
      let body = isHtml ? raw : raw.replace(/\n/g, "<br/>");
      if (isHtml) {
        body = body
          .replace(/<p(\s[^>]*)?>/gi, '<p style="margin:0 0 16px;">')
          .replace(/<p style="margin:0 0 16px;">\s*<\/p>/gi, '<p style="margin:0 0 16px;">&nbsp;</p>');
      }
      return `<tr><td style="padding:8px 24px;"><div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.7;color:${color};text-align:${align};">${body}</div></td></tr>`;
    }
    case "image": {
      const w = p.width || 552;
      const src = p.src || "https://placehold.co/600x260/F1F5F9/94A3B8?text=Afbeelding";
      const img = `<img src="${src}" alt="${p.alt || ""}" width="${w}" style="max-width:100%;height:auto;display:block;border-radius:8px;border:0;" />`;
      return `<tr><td style="padding:12px 24px;text-align:${p.align || "center"};">${p.link ? `<a href="${p.link}">${img}</a>` : img}</td></tr>`;
    }
    case "button": {
      const bg = p.bg || "#4F46E5";
      const color = p.color || "#ffffff";
      const radius = p.radius != null ? p.radius : 8;
      const align = p.align || "center";
      return `<tr><td style="padding:16px 24px;text-align:${align};"><a href="${p.link || "#"}" style="background:${bg};color:${color};text-decoration:none;padding:13px 30px;border-radius:${radius}px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;display:inline-block;">${escapeText(p.text || "Click here")}</a></td></tr>`;
    }
    case "divider":
      return `<tr><td style="${pad}"><div style="border-top:1px solid ${p.color || "#E2E8F0"};margin:6px 0;"></div></td></tr>`;
    case "spacer":
      return `<tr><td style="height:${p.height || 24}px;line-height:${p.height || 24}px;">&nbsp;</td></tr>`;
    default:
      return "";
  }
}

function escapeText(t) {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function generateHtml(blocks, opts = {}) {
  const bg = opts.bg || "#F1F5F9";
  const rows = (blocks || []).map(renderBlock).join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
${rows}
</table>
</td></tr>
</table>
</body></html>`;
}

const CLARA_MARK = "https://koodh-clara.nbg1.your-objectstorage.com/assets/clara-mark.png";

// Mirrors the backend footer injected at send time (email_util.personalize_html),
// so the Builder can show exactly what recipients see.
export function footerHtml(branding, opts = {}) {
  const brand = (branding?.brand_primary || "#7380b6").trim() || "#7380b6";
  const website = (branding?.website || "").trim();
  const publicBase = opts.publicBase || "https://campaigns.koodh.com";
  const logoUrl = opts.logoUrl;
  const logoImg = logoUrl
    ? `<img src="${logoUrl}" alt="" width="120" style="max-width:120px;height:auto;display:block;border:0;margin:0 auto 18px;" />`
    : "";
  const websiteLink = website
    ? `<a href="${website}" style="color:${brand};text-decoration:none;font-weight:600;">${escapeText(website)}</a><br/>`
    : "";
  const claraBrand =
    `<a href="${publicBase}" style="text-decoration:none;color:#64748B;display:inline-block;margin:2px 0;">` +
    `<img src="${CLARA_MARK}" width="16" height="16" alt="Clara Campaigns" style="vertical-align:middle;border:0;display:inline-block;margin-right:6px;width:16px;height:16px;" />` +
    `<span style="vertical-align:middle;font-weight:700;color:#64748B;">Clara Campaigns</span></a>`;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td align="center" style="padding:22px 24px 16px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#94A3B8;line-height:1.7;">` +
    `${logoImg}${websiteLink}` +
    `<span style="color:#94A3B8;">Sent with </span>${claraBrand}<br/><br/>` +
    `<a href="#" style="display:inline-block;padding:9px 22px;border:1px solid ${brand};border-radius:9999px;color:${brand};text-decoration:none;font-size:12px;font-weight:600;">Unsubscribe</a>` +
    `</td></tr></table>`
  );
}

export const BLOCK_DEFAULTS = {
  logo: { src: "", alt: "Logo", width: 140, align: "center", link: "" },
  title: { text: "Welcome to our newsletter", level: "h1", align: "left", color: "#0F172A" },
  text: { text: "Write your message here. Share updates, offers or news with your readers.", align: "left", color: "#334155" },
  image: { src: "", alt: "", width: 552, align: "center", link: "" },
  button: { text: "Read more", link: "https://", bg: "#7380b6", color: "#ffffff", radius: 8, align: "center" },
  divider: { color: "#E2E8F0" },
  spacer: { height: 24 },
};
