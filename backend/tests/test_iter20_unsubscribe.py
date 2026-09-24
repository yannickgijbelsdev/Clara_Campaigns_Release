"""Iteration 20 - Verify unsubscribe two-step flow, footer content, absolute tracking links."""
import os
import sys
import re
import pytest
import pyotp
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://inbox-pro-64.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "yannick.gijbels@koodh.com"
ADMIN_PASS = "KYLovie13monx"
TOTP_SECRET = "VLGJTATFHVFPTFV7Q4FQL3ATFOGVVB5Q"

# Make backend module importable for auth.make_unsub_token + email_util direct call
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    # login
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    mfa_token = r.json()["mfa_token"]
    code = pyotp.TOTP(TOTP_SECRET).now()
    r = s.post(f"{BASE_URL}/api/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code})
    assert r.status_code == 200, f"mfa failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def company_id(session):
    # get first company
    r = session.get(f"{BASE_URL}/api/companies")
    assert r.status_code == 200
    comps = r.json()
    assert comps, "no companies"
    return comps[0]["id"]


# -------- Backend footer content (personalize_html) --------
def test_footer_has_unsubscribe_no_manage_prefs():
    import email_util
    sample = "<html><body><p>Hi</p></body></html>"
    unsub_url = "https://campaigns.koodh.com/api/unsubscribe/tok123"
    out = email_util.personalize_html(
        sample, "tok123", "https://campaigns.koodh.com",
        {"name": "Test"}, "https://campaigns.koodh.com", unsub_url,
    )
    assert "Manage your preferences" not in out, "footer must not contain 'Manage your preferences'"
    assert "Unsubscribe" in out, "footer must contain 'Unsubscribe'"
    assert unsub_url in out, "unsub URL missing"


# -------- Backend absolute click-track links --------
def test_click_tracking_absolute_https():
    import email_util
    html_in = '<html><body><a href="https://example.com/page">Visit</a></body></html>'
    out = email_util.personalize_html(
        html_in, "tokABC", "https://campaigns.koodh.com",
        {"name": "T"}, "https://campaigns.koodh.com",
        "https://campaigns.koodh.com/api/unsubscribe/tokABC",
    )
    m = re.search(r'href="(https://campaigns\.koodh\.com/api/track/click/tokABC\?u=[^"]+)"', out)
    assert m, f"absolute tracking href not found. Output: {out[:600]}"


# -------- Backend unsubscribe two-step flow --------
def test_unsubscribe_get_then_post(session, company_id):
    import auth as A
    headers = {"X-Company-Id": company_id}
    email = f"test_unsub_{os.urandom(3).hex()}@example.com"
    # create contact
    r = session.post(f"{BASE_URL}/api/contacts",
                     json={"name": "TEST Unsub", "email": email, "category_ids": []},
                     headers=headers)
    assert r.status_code == 200, f"create contact failed: {r.status_code} {r.text}"
    contact_id = r.json()["id"]

    token = A.make_unsub_token(company_id, contact_id)

    # GET should show confirmation page with Unsubscribe button, NOT unsubscribe yet
    r = requests.get(f"{BASE_URL}/api/unsubscribe/{token}")
    assert r.status_code == 200
    body = r.text
    assert "<button" in body.lower() and "unsubscribe" in body.lower()
    assert "form" in body.lower() and 'method="post"' in body.lower()

    # verify contact still subscribed
    r = session.get(f"{BASE_URL}/api/contacts", headers=headers)
    contact = next((c for c in r.json() if c["id"] == contact_id), None)
    assert contact is not None
    assert contact.get("status") == "subscribed", f"contact should still be subscribed, got {contact.get('status')}"

    # POST should actually unsubscribe
    r = requests.post(f"{BASE_URL}/api/unsubscribe/{token}")
    assert r.status_code == 200
    assert "unsubscribed" in r.text.lower()

    # verify contact now unsubscribed
    r = session.get(f"{BASE_URL}/api/contacts", headers=headers)
    contact = next((c for c in r.json() if c["id"] == contact_id), None)
    assert contact.get("status") == "unsubscribed", f"status should be unsubscribed, got {contact.get('status')}"

    # cleanup
    session.delete(f"{BASE_URL}/api/contacts/{contact_id}", headers=headers)


def test_unsubscribe_invalid_token():
    r = requests.get(f"{BASE_URL}/api/unsubscribe/thisisnotarealtoken12345")
    assert r.status_code == 404
    assert "invalid" in r.text.lower()
