import os
import re
import ipaddress
import logging
import httpx
import aiosmtplib
from email.message import EmailMessage
from email.utils import formataddr
from html.parser import HTMLParser
from urllib.parse import urlparse
from fastapi import HTTPException

logger = logging.getLogger("clara.email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Clara Campaigns")
EMAIL_SENDER = os.environ.get("EMAIL_SENDER", "")

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
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#0f172a;padding:32px 0;font-family:Arial,Helvetica,sans-serif">'
        '<tr><td align="center">'
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="background:#111827;border-radius:20px;overflow:hidden;max-width:520px">'
        '<tr><td style="padding:36px 40px 8px">'
        '<div style="font-size:26px;font-weight:700;color:#ffffff">Password Reset</div>'
        '<div style="font-size:14px;color:#9ca3af;margin-top:2px">Clara Campaigns</div>'
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
