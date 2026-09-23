import os
import re
import time
import html as html_lib
from urllib.parse import quote
import msal
import httpx
from cryptography.fernet import Fernet
from db import db

SCOPES = ["User.Read", "Mail.Send"]
GRAPH = "https://graph.microsoft.com/v1.0"
AUTHORITY_BASE = "https://login.microsoftonline.com"
CLARA_MARK = "https://koodh-clara.nbg1.your-objectstorage.com/assets/clara-mark.png"

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


# Runtime Microsoft app credentials (set from DB via the admin UI; env is fallback).
_creds = {"client_id": None, "client_secret": None, "tenant": None}


def set_creds(client_id, client_secret, tenant):
    global _app_cca
    _creds["client_id"] = (client_id or "").strip() or None
    _creds["client_secret"] = (client_secret or "").strip() or None
    _creds["tenant"] = (tenant or "").strip() or None
    _app_cca = None  # reset the cached app-only client


async def load_ms_creds_from_db():
    doc = await db.app_settings.find_one({"_id": "ms_graph"})
    if not doc:
        return
    secret = ""
    if doc.get("client_secret_enc"):
        try:
            secret = decrypt_secret(doc["client_secret_enc"])
        except Exception:
            secret = ""
    set_creds(doc.get("client_id"), secret, doc.get("tenant"))


def _cid():
    return _creds["client_id"] or os.environ.get("MS_CLIENT_ID")


def _csecret():
    return _creds["client_secret"] or os.environ.get("MS_CLIENT_SECRET")


def _tenant_id():
    return _creds["tenant"] or os.environ.get("MS_TENANT") or "organizations"


def is_configured() -> bool:
    return bool(_cid() and _csecret())


def system_mail_ready() -> bool:
    """App-only (client credentials) sending as EMAIL_SENDER is ready.
    Requires a concrete tenant GUID/domain — not 'organizations'/'common'."""
    tenant = (_tenant_id() or "").strip().lower()
    return bool(
        _cid() and _csecret() and os.environ.get("EMAIL_SENDER")
        and tenant and tenant not in ("organizations", "common", "consumers")
    )


_app_cca = None


def _app_client():
    global _app_cca
    if _app_cca is None:
        _app_cca = msal.ConfidentialClientApplication(
            _cid(),
            authority=f"{AUTHORITY_BASE}/{_tenant_id()}",
            client_credential=_csecret(),
        )
    return _app_cca


def get_app_token() -> str:
    result = _app_client().acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError(f"App token failed: {result.get('error')}: {result.get('error_description')}")
    return result["access_token"]


async def send_system_mail(*, to: str, subject: str, html: str):
    """Send a transactional system email FROM EMAIL_SENDER (e.g. clara@koodh.com)
    using application permissions (Graph /users/{sender}/sendMail)."""
    token = get_app_token()
    sender = os.environ["EMAIL_SENDER"]
    body = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": html},
            "toRecipients": [{"emailAddress": {"address": to}}],
        },
        "saveToSentItems": True,
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{GRAPH}/users/{quote(sender)}/sendMail",
                         headers={"Authorization": f"Bearer {token}"}, json=body)
    if r.status_code == 202:
        return True
    raise RuntimeError(f"Graph system sendMail {r.status_code}: {r.text[:300]}")


def _authority() -> str:
    return f"{AUTHORITY_BASE}/{_tenant_id()}"


def _redirect_uri() -> str:
    base = os.environ.get("PUBLIC_BASE_URL") or os.environ["BACKEND_URL"]
    return f"{base}/api/oauth/microsoft/callback"


def redirect_uri_public() -> str:
    return _redirect_uri()


def msal_app(cache=None):
    return msal.ConfidentialClientApplication(
        _cid(),
        authority=_authority(),
        client_credential=_csecret(),
        token_cache=cache,
    )


async def load_cache(user_id: str):
    row = await db.mailboxes.find_one({"user_id": user_id})
    cache = msal.SerializableTokenCache()
    if row and row.get("token_cache"):
        cache.deserialize(_get_fernet().decrypt(row["token_cache"].encode()).decode())
    return cache, row


async def save_cache(user_id: str, cache, email=None):
    if cache.has_state_changed:
        encrypted = _get_fernet().encrypt(cache.serialize().encode()).decode()
        update = {"token_cache": encrypted, "updated_at": time.time()}
        if email:
            update["email"] = email
        await db.mailboxes.update_one(
            {"user_id": user_id}, {"$set": update}, upsert=True
        )


def build_auth_flow(state: str):
    flow = msal_app().initiate_auth_code_flow(
        scopes=SCOPES, redirect_uri=_redirect_uri(), state=state
    )
    return flow


def redeem_code(flow: dict, code: str, state: str):
    cache = msal.SerializableTokenCache()
    result = msal_app(cache).acquire_token_by_auth_code_flow(
        flow, {"code": code, "state": state}
    )
    return result, cache


async def get_access_token(user_id: str):
    cache, row = await load_cache(user_id)
    if not row:
        return None
    client = msal_app(cache)
    accounts = client.get_accounts()
    if not accounts:
        return None
    result = client.acquire_token_silent(SCOPES, account=accounts[0])
    await save_cache(user_id, cache)
    if not result or "access_token" not in result:
        return None
    return result["access_token"]


async def send_mail(token: str, sender: str, subject: str, html: str, to_email: str, to_name: str = None, attachments=None):
    message = {
        "subject": subject,
        "body": {"contentType": "HTML", "content": html},
        "toRecipients": [{"emailAddress": {"address": to_email, **({"name": to_name} if to_name else {})}}],
    }
    if attachments:
        message["attachments"] = [{
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": a["name"],
            "contentType": a.get("content_type", "application/octet-stream"),
            "contentBytes": a["content_b64"],
        } for a in attachments]
    body = {"message": message, "saveToSentItems": True}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{GRAPH}/me/sendMail", headers={"Authorization": f"Bearer {token}"}, json=body)
        if r.status_code == 202:
            return True
        raise RuntimeError(f"Graph {r.status_code}: {r.text[:300]}")


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
        logo_img = (f'<img src="{company.get("logo_url")}" alt="{html_lib.escape(company.get("name",""))}" '
                    f'width="120" style="max-width:120px;height:auto;display:inline-block;border:0;margin:0 auto 10px;" />')
    elif company.get("logo_path") and cid:
        logo_img = (f'<img src="{backend_url}/api/company/{cid}/logo" alt="{html_lib.escape(company.get("name",""))}" '
                    f'width="120" style="max-width:120px;height:auto;display:inline-block;border:0;margin:0 auto 10px;" />')
    website_link = (f'<a href="{website}" style="color:#94A3B8;text-decoration:none;">{html_lib.escape(website)}</a><br/>'
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
