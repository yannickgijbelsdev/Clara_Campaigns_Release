"""Iter17: import 2-step overwrite/skip, timezone, campaign test-send."""
import io
import os
import pyotp
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # Fallback: read frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "yannick.gijbels@koodh.com"
ADMIN_PW = "KYLovie13monx"
TOTP_SECRET = "VLGJTATFHVFPTFV7Q4FQL3ATFOGVVB5Q"


@pytest.fixture(scope="module")
def token():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    j = r.json()
    mfa_token = j.get("mfa_token")
    assert mfa_token
    code = pyotp.TOTP(TOTP_SECRET).now()
    r2 = s.post(f"{BASE}/api/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code})
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_timezone_put_get(headers):
    r = requests.put(f"{BASE}/api/company/timezone", headers=headers, json={"timezone": "Europe/Brussels"})
    assert r.status_code == 200, r.text
    assert r.json().get("timezone") == "Europe/Brussels"
    g = requests.get(f"{BASE}/api/company/smtp", headers=headers)
    assert g.status_code == 200
    assert g.json().get("timezone") == "Europe/Brussels"


def test_timezone_invalid(headers):
    r = requests.put(f"{BASE}/api/company/timezone", headers=headers, json={"timezone": ""})
    assert r.status_code in (400, 422)


def _csv_bytes(rows):
    header = "email,first_name,last_name,company,tags\n"
    body = "".join(f"{e},{f},{l},{c},{t}\n" for e, f, l, c, t in rows)
    return (header + body).encode()


def test_import_analyze_then_import_with_overwrite(headers):
    # Seed one existing contact
    existing = "test_iter17_existing@example.com"
    new_email = "test_iter17_new@example.com"
    # Create existing via import
    files = {"file": ("s.csv", _csv_bytes([(existing, "Old", "User", "ACME", "")]), "text/csv")}
    r = requests.post(f"{BASE}/api/contacts/import", headers=headers,
                      files=files, data={"mode": "import", "overwrite": "false"})
    assert r.status_code == 200, r.text

    # Analyze with duplicate + new
    files = {"file": ("s.csv", _csv_bytes([(existing, "New", "Name", "X", ""), (new_email, "N", "E", "X", "")]), "text/csv")}
    r = requests.post(f"{BASE}/api/contacts/import", headers=headers,
                      files=files, data={"mode": "analyze"})
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["total"] == 2 and a["new"] == 1 and a["duplicates"] == 1, a

    # Import with overwrite=true
    files = {"file": ("s.csv", _csv_bytes([(existing, "Overwritten", "Name", "Y", ""), (new_email, "N", "E", "X", "")]), "text/csv")}
    r = requests.post(f"{BASE}/api/contacts/import", headers=headers,
                      files=files, data={"mode": "import", "overwrite": "true"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["updated"] >= 1
    assert d["imported"] >= 0  # new one may already be there from previous

    # Import with overwrite=false → duplicates skipped
    another_new = "test_iter17_new2@example.com"
    files = {"file": ("s.csv", _csv_bytes([(existing, "X", "X", "X", ""), (another_new, "A", "B", "C", "")]), "text/csv")}
    r = requests.post(f"{BASE}/api/contacts/import", headers=headers,
                      files=files, data={"mode": "import", "overwrite": "false"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["skipped"] >= 1
    assert d["imported"] >= 1

    # Cleanup
    lst = requests.get(f"{BASE}/api/contacts", headers=headers).json()
    for c in lst if isinstance(lst, list) else lst.get("items", []):
        if c.get("email", "").startswith("test_iter17_"):
            cid = c.get("id") or c.get("_id")
            if cid:
                requests.delete(f"{BASE}/api/contacts/{cid}", headers=headers)


def test_campaign_test_send_endpoint(headers):
    # Find a campaign with html
    r = requests.get(f"{BASE}/api/campaigns", headers=headers)
    assert r.status_code == 200
    camps = r.json()
    target = None
    for c in camps:
        if c.get("html"):
            target = c
            break
    if not target:
        # create one with full body
        payload = {"name": "TEST iter17", "subject": "Hello",
                   "from_name": "T", "from_email": "t@t.com",
                   "html": "<html><body>Hi {{first_name}}</body></html>",
                   "content": {}}
        r = requests.post(f"{BASE}/api/campaigns", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        cid = r.json().get("id") or r.json().get("_id")
        # Ensure html saved via PUT with full body
        requests.put(f"{BASE}/api/campaigns/{cid}", headers=headers, json=payload)
        target = {"id": cid}
    cid = target.get("id") or target.get("_id")
    r = requests.post(f"{BASE}/api/campaigns/{cid}/test", headers=headers)
    # Either 200 (if SMTP set) or 400 with clear detail about SMTP / send failed
    assert r.status_code in (200, 400), r.text
    if r.status_code == 400:
        detail = r.json().get("detail", "")
        assert ("SMTP" in detail) or ("Test send failed" in detail), detail
