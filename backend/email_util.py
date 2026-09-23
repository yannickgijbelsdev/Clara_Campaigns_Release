import os
import re
import ipaddress
import logging
import html as _html
import httpx
import aiosmtplib
from email.message import EmailMessage
from email.utils import formataddr
from html.parser import HTMLParser
from urllib.parse import urlparse, quote
from cryptography.fernet import Fernet
from fastapi import HTTPException

logger = logging.getLogger("clara.email")


def _get_fernet():
    key = os.environ.get("TOKEN_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY is not configured")
    return Fernet(key.encode())


def encrypt_secret(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    return _get_fernet().decrypt(value.encode()).decode()

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Clara Campaigns")
EMAIL_SENDER = os.environ.get("EMAIL_SENDER", "")
CLARA_MARK = "https://koodh-clara.nbg1.your-objectstorage.com/assets/clara-mark.png"


def clara_brand_header(on_dark: bool = True) -> str:
    """Clara Campaigns lockup for email headers: logo mark in a white badge +
    vertical divider + bold 'Clara Campaigns'. White badge keeps the mark visible
    on any background."""
    text_color = "#ffffff" if on_dark else "#0f172a"
    divider = "#334155" if on_dark else "#cbd5e1"
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:6px"><tr>'
        '<td style="vertical-align:middle">'
        '<span style="display:inline-block;width:36px;height:36px;background:#ffffff;'
        'border-radius:9999px;text-align:center;line-height:36px;box-shadow:0 1px 3px rgba(0,0,0,0.15)">'
        f'<img src="{CLARA_MARK}" width="20" height="20" alt="Clara Campaigns" '
        'style="vertical-align:middle;border:0;width:20px;height:20px" /></span></td>'
        f'<td style="vertical-align:middle;padding:0 14px"><div style="width:1px;height:26px;'
        f'background:{divider};font-size:0;line-height:26px">&nbsp;</div></td>'
        f'<td style="vertical-align:middle"><span style="font-size:19px;font-weight:700;'
        f'color:{text_color};font-family:Arial,Helvetica,sans-serif;letter-spacing:0.2px">Clara Campaigns</span></td>'
        '</tr></table>'
    )

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host):
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown, real):
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject, html):
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened/numeric-host/credential URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real host {real!r} (G3)")


def smtp_ready() -> bool:
    """SMTP (Microsoft 365) sending from EMAIL_SENDER is configured."""
    return bool(
        os.environ.get("SMTP_HOST")
        and os.environ.get("SMTP_USER")
        and os.environ.get("SMTP_PASSWORD")
        and os.environ.get("EMAIL_SENDER")
    )


async def _send_via_smtp(*, to, subject, html):
    """Send a system email FROM EMAIL_SENDER (clara@koodh.com) via Microsoft 365
    SMTP (smtp.office365.com:587, STARTTLS)."""
    msg = EmailMessage()
    msg["From"] = formataddr((EMAIL_FROM_NAME, os.environ["EMAIL_SENDER"]))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("Please view this email in an HTML-capable email client.")
    msg.add_alternative(html, subtype="html")
    smtp = aiosmtplib.SMTP(
        hostname=os.environ["SMTP_HOST"],
        port=int(os.environ.get("SMTP_PORT", "587")),
        start_tls=False, use_tls=False, timeout=30,
    )
    await smtp.connect()
    try:
        await smtp.starttls()
        await smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        await smtp.send_message(msg)
    finally:
        if smtp.is_connected:
            await smtp.quit()


async def send_email(*, to, subject, html):
    _assert_safe_email(subject, html)
    # Prefer sending system emails from EMAIL_SENDER (clara@koodh.com) via the
    # customer's own Microsoft 365 SMTP when configured.
    if smtp_ready():
        try:
            await _send_via_smtp(to=to, subject=subject, html=html)
            return "smtp"
        except Exception as e:
            logger.error(f"System email via Microsoft 365 SMTP failed: {e}")
            raise HTTPException(status_code=502, detail="Failed to send email")
    # Fallback (before Microsoft 365 SMTP is configured): Emergent managed email.
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY}, json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=502, detail="Failed to send email")


def reset_email_html(name, reset_url):
    from html import escape
    brand_row = clara_brand_header(on_dark=True)
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#0f172a;padding:32px 0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center">'
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="background:#111827;border-radius:20px;overflow:hidden;max-width:520px">'
        '<tr><td style="padding:32px 40px 4px">'
        f'{brand_row}'
        '<div style="font-size:24px;font-weight:700;color:#ffffff;margin-top:14px">Password Reset</div>'
        '</td></tr>'
        f'<tr><td style="padding:16px 40px 0;color:#cbd5e1;font-size:15px;line-height:1.6">'
        f'<p style="margin:0 0 12px">Hello {escape(name)},</p>'
        '<p style="margin:0 0 24px">A password reset was requested for your account. '
        'Click the button below to set a new password. This link is valid for one hour '
        'and can be used once.</p></td></tr>'
        '<tr><td align="center" style="padding:8px 40px 8px">'
        f'<a href="{reset_url}" style="display:inline-block;background:#7380b6;color:#ffffff;'
        'text-decoration:none;padding:14px 34px;border-radius:9999px;font-size:15px;'
        'font-weight:600">Reset your password</a></td></tr>'
        '<tr><td style="padding:24px 40px 0;color:#f43f5e;font-size:13px;line-height:1.5">'
        "If you didn't request this, you can safely ignore this email — your password "
        'will stay the same.</td></tr>'
        '<tr><td style="padding:28px 40px 32px;color:#6b7280;font-size:12px">'
        'Clara Campaigns · We never ask for your password by email.'
        '</td></tr></table></td></tr></table>'
    )



async def send_newsletter_via_smtp(*, cfg, subject, html, to_email, to_name=None):
    """Send a single newsletter email through a company's own SMTP server.
    cfg keys: host, port, security (ssl|starttls|none), username, password,
    from_email, from_name."""
    from_email = cfg["from_email"]
    from_name = cfg.get("from_name") or from_email
    msg = EmailMessage()
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = formataddr((to_name, to_email)) if to_name else to_email
    msg["Subject"] = subject
    msg.set_content("Please view this email in an HTML-capable email client.")
    msg.add_alternative(html, subtype="html")

    security = (cfg.get("security") or "starttls").lower()
    use_tls = security in ("ssl", "tls")           # implicit TLS (usually port 465)
    do_starttls = security == "starttls"           # upgrade after connect (usually 587)
    port = int(cfg.get("port") or (465 if use_tls else 587))

    smtp = aiosmtplib.SMTP(
        hostname=cfg["host"], port=port,
        use_tls=use_tls, start_tls=False, timeout=30,
    )
    await smtp.connect()
    try:
        if do_starttls:
            await smtp.starttls()
        if cfg.get("username"):
            await smtp.login(cfg["username"], cfg.get("password") or "")
        await smtp.send_message(msg)
    finally:
        if smtp.is_connected:
            await smtp.quit()


async def smtp_test_connection(cfg):
    """Verify SMTP credentials by connecting + logging in (no email sent)."""
    security = (cfg.get("security") or "starttls").lower()
    use_tls = security in ("ssl", "tls")
    do_starttls = security == "starttls"
    port = int(cfg.get("port") or (465 if use_tls else 587))
    smtp = aiosmtplib.SMTP(hostname=cfg["host"], port=port, use_tls=use_tls, start_tls=False, timeout=20)
    await smtp.connect()
    try:
        if do_starttls:
            await smtp.starttls()
        if cfg.get("username"):
            await smtp.login(cfg["username"], cfg.get("password") or "")
    finally:
        if smtp.is_connected:
            await smtp.quit()


def smtp_test_email_html(workspace_name: str) -> str:
    from html import escape
    brand_row = clara_brand_header(on_dark=True)
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#0f172a;padding:32px 0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center">'
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="background:#111827;border-radius:20px;overflow:hidden;max-width:520px">'
        '<tr><td style="padding:32px 40px 4px">'
        f'{brand_row}'
        '<div style="font-size:24px;font-weight:700;color:#ffffff;margin-top:14px">Your SMTP works! 🎉</div>'
        '</td></tr>'
        '<tr><td style="padding:16px 40px 0;color:#cbd5e1;font-size:15px;line-height:1.6">'
        f'<p style="margin:0 0 12px">This is a test email from <b style="color:#ffffff">{escape(workspace_name)}</b>.</p>'
        '<p style="margin:0 0 24px">If you are reading this in your inbox, your SMTP server is configured '
        'correctly and Clara Campaigns can send newsletters from your own address.</p></td></tr>'
        '<tr><td style="padding:8px 40px 8px">'
        '<span style="display:inline-block;background:#7380b6;color:#ffffff;'
        'padding:12px 28px;border-radius:9999px;font-size:14px;font-weight:600">Connection verified</span></td></tr>'
        '<tr><td style="padding:28px 40px 32px;color:#6b7280;font-size:12px">'
        'Clara Campaigns · You received this because someone tested the SMTP settings for this workspace.'
        '</td></tr></table></td></tr></table>'
    )


def personalize_html(html: str, track_id: str, backend_url: str, company: dict = None, public_base: str = None, unsub_url: str = None) -> str:
    """Rewrite links for click tracking, inject open pixel and a branded footer."""
    def repl(m):
        quote_char = m.group(1)
        url = m.group(2)
        if url.startswith("#") or url.startswith("mailto:") or "track/click" in url:
            return m.group(0)
        tracked = f"{backend_url}/api/track/click/{track_id}?u={quote(url, safe='')}"
        return f"href={quote_char}{tracked}{quote_char}"

    html = re.sub(r'href=(["\'])(.*?)\1', repl, html, flags=re.IGNORECASE)

    company = company or {}
    public_base = public_base or "https://campaigns.koodh.com"
    website = (company.get("website") or "").strip()
    cid = str(company.get("_id")) if company.get("_id") else None
    logo_img = ""
    if company.get("logo_url"):
        logo_img = (f'<img src="{company.get("logo_url")}" alt="{_html.escape(company.get("name",""))}" '
                    f'width="120" style="max-width:120px;height:auto;display:inline-block;border:0;margin:0 auto 10px;" />')
    elif company.get("logo_path") and cid:
        logo_img = (f'<img src="{backend_url}/api/company/{cid}/logo" alt="{_html.escape(company.get("name",""))}" '
                    f'width="120" style="max-width:120px;height:auto;display:inline-block;border:0;margin:0 auto 10px;" />')
    website_link = (f'<a href="{website}" style="color:#94A3B8;text-decoration:none;">{_html.escape(website)}</a><br/>'
                    if website else "")
    unsub_url = unsub_url or f"{backend_url}/api/unsubscribe/{track_id}"
    prefs_url = company.get("subscribe_url") or (f"{public_base}/subscribe/{company.get('api_key')}" if company.get("api_key") else None)
    prefs_btn = (
        f'<a href="{prefs_url}" style="display:inline-block;margin:0 0 12px;padding:9px 20px;'
        f'background:{company.get("brand_primary") or "#7380b6"};color:#ffffff;border-radius:9999px;'
        f'text-decoration:none;font-size:13px;font-weight:600;">Manage your preferences</a><br/>'
        if prefs_url else "")
    clara_brand = (
        f'<a href="{public_base}" style="text-decoration:none;color:#64748B;display:inline-block;margin:2px 0;">'
        f'<img src="{CLARA_MARK}" width="16" height="16" alt="Clara Campaigns" '
        f'style="vertical-align:middle;border:0;display:inline-block;margin-right:6px;width:16px;height:16px;" />'
        f'<span style="vertical-align:middle;font-weight:700;color:#64748B;">Clara Campaigns</span></a>'
    )
    footer = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td align="center" style="padding:22px 24px 8px;font-family:\'Segoe UI\',Arial,sans-serif;font-size:12px;color:#94A3B8;line-height:1.7;">'
        f'{logo_img}{prefs_btn}{website_link}'
        f'<span style="color:#94A3B8;">Sent with </span>{clara_brand}<br/>'
        f'<a href="{unsub_url}" style="color:#94A3B8;text-decoration:underline;">Unsubscribe from these emails</a>'
        '</td></tr></table>'
    )
    pixel = f'<img src="{backend_url}/api/track/open/{track_id}" width="1" height="1" alt="" style="display:none" />'
    inject = footer + pixel
    if "</body>" in html.lower():
        idx = html.lower().rfind("</body>")
        html = html[:idx] + inject + html[idx:]
    else:
        html = html + inject
    return html
