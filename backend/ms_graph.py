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

fernet = Fernet(os.environ["TOKEN_ENCRYPTION_KEY"].encode())


def is_configured() -> bool:
    return bool(os.environ.get("MS_CLIENT_ID") and os.environ.get("MS_CLIENT_SECRET"))


def _authority() -> str:
    tenant = os.environ.get("MS_TENANT", "organizations")
    return f"{AUTHORITY_BASE}/{tenant}"


def _redirect_uri() -> str:
    return f"{os.environ['BACKEND_URL']}/api/oauth/microsoft/callback"


def msal_app(cache=None):
    return msal.ConfidentialClientApplication(
        os.environ["MS_CLIENT_ID"],
        authority=_authority(),
        client_credential=os.environ["MS_CLIENT_SECRET"],
        token_cache=cache,
    )


async def load_cache(user_id: str):
    row = await db.mailboxes.find_one({"user_id": user_id})
    cache = msal.SerializableTokenCache()
    if row and row.get("token_cache"):
        cache.deserialize(fernet.decrypt(row["token_cache"].encode()).decode())
    return cache, row


async def save_cache(user_id: str, cache, email=None):
    if cache.has_state_changed:
        encrypted = fernet.encrypt(cache.serialize().encode()).decode()
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


async def send_mail(token: str, sender: str, subject: str, html: str, to_email: str, to_name: str = None):
    body = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": html},
            "toRecipients": [{"emailAddress": {"address": to_email, **({"name": to_name} if to_name else {})}}],
        },
        "saveToSentItems": True,
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{GRAPH}/me/sendMail", headers={"Authorization": f"Bearer {token}"}, json=body)
        if r.status_code == 202:
            return True
        raise RuntimeError(f"Graph {r.status_code}: {r.text[:300]}")


def personalize_html(html: str, track_id: str, backend_url: str) -> str:
    """Rewrite links for click tracking and inject an open-tracking pixel."""
    def repl(m):
        quote_char = m.group(1)
        url = m.group(2)
        if url.startswith("#") or url.startswith("mailto:") or "track/click" in url:
            return m.group(0)
        tracked = f"{backend_url}/api/track/click/{track_id}?u={quote(url, safe='')}"
        return f"href={quote_char}{tracked}{quote_char}"

    html = re.sub(r'href=(["\'])(.*?)\1', repl, html, flags=re.IGNORECASE)
    pixel = f'<img src="{backend_url}/api/track/open/{track_id}" width="1" height="1" alt="" style="display:none" />'
    if "</body>" in html.lower():
        idx = html.lower().rfind("</body>")
        html = html[:idx] + pixel + html[idx:]
    else:
        html = html + pixel
    return html
