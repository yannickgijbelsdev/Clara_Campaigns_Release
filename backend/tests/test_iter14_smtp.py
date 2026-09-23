"""Iteration 14 - Per-workspace SMTP config replacing MS Graph.

Tests:
  - /company/smtp GET/PUT/DELETE/test
  - password hidden on GET; preserved on partial PUT
  - Old MS Graph endpoints removed (404)
  - System email path (POST /api/auth/forgot-password) still works
  - Campaign send returns mode simulation when SMTP not configured
"""
import os
import time
import pyotp
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://inbox-pro-64.preview.emergentagent.com"
ADMIN_EMAIL = "yannick.gijbels@koodh.com"
ADMIN_PASSWORD = "KYLovie13monx"
ADMIN_TOTP = "VLGJTATFHVFPTFV7Q4FQL3ATFOGVVB5Q"


# ---------- auth helper ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "mfa_token" in body, body
    code = pyotp.TOTP(ADMIN_TOTP).now()
    r2 = requests.post(f"{BASE}/api/auth/mfa/verify",
                       json={"mfa_token": body["mfa_token"], "code": code}, timeout=15)
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def company_id(h):
    # discover a company_id for X-Company-Id via /companies or /admin/companies
    r = requests.get(f"{BASE}/api/admin/companies", headers=h, timeout=15)
    assert r.status_code == 200, r.text
    companies = r.json()
    assert companies, "no companies found"
    return companies[0]["id"]


@pytest.fixture(scope="module")
def hc(h, company_id):
    return {**h, "X-Company-Id": company_id}


# ---------- old endpoints must be gone ----------
class TestOldEndpointsRemoved:
    def test_mailbox_gone(self, hc):
        r = requests.get(f"{BASE}/api/mailbox", headers=hc, timeout=10)
        assert r.status_code == 404, r.status_code

    def test_ms_config_gone(self, h):
        r = requests.get(f"{BASE}/api/admin/ms-config", headers=h, timeout=10)
        assert r.status_code == 404

    def test_oauth_ms_start_gone(self, hc):
        r = requests.get(f"{BASE}/api/oauth/microsoft/start", headers=hc, timeout=10, allow_redirects=False)
        assert r.status_code == 404


# ---------- SMTP CRUD ----------
class TestSmtpCrud:
    def test_delete_then_get_empty(self, hc):
        requests.delete(f"{BASE}/api/company/smtp", headers=hc, timeout=10)
        r = requests.get(f"{BASE}/api/company/smtp", headers=hc, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["configured"] is False
        assert body["has_password"] is False
        assert body["host"] == ""

    def test_put_without_password_fails(self, hc):
        requests.delete(f"{BASE}/api/company/smtp", headers=hc, timeout=10)
        payload = {"host": "smtp.example.com", "port": 587, "security": "starttls",
                   "username": "u", "password": "", "from_email": "a@b.com", "from_name": "X"}
        r = requests.put(f"{BASE}/api/company/smtp", headers=hc, json=payload, timeout=10)
        assert r.status_code == 400, r.text

    def test_put_success_and_password_hidden(self, hc):
        payload = {"host": "smtp.example.com", "port": 587, "security": "starttls",
                   "username": "test-user", "password": "s3cret!", "from_email": "sender@example.com",
                   "from_name": "Sender"}
        r = requests.put(f"{BASE}/api/company/smtp", headers=hc, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("configured") is True

        r2 = requests.get(f"{BASE}/api/company/smtp", headers=hc, timeout=10)
        assert r2.status_code == 200
        b = r2.json()
        assert b["configured"] is True
        assert b["has_password"] is True
        assert b["host"] == "smtp.example.com"
        assert b["username"] == "test-user"
        assert b["from_email"] == "sender@example.com"
        # password must NEVER be returned
        assert "password" not in b or b.get("password") in (None, "", False)

    def test_partial_update_preserves_password(self, hc):
        # change port only, no password
        payload = {"host": "smtp.example.com", "port": 465, "security": "ssl",
                   "username": "test-user", "password": "", "from_email": "sender@example.com",
                   "from_name": "Sender"}
        r = requests.put(f"{BASE}/api/company/smtp", headers=hc, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{BASE}/api/company/smtp", headers=hc, timeout=10)
        b = r2.json()
        assert b["has_password"] is True, "password should be preserved"
        assert b["port"] == 465
        assert b["security"] == "ssl"

    def test_smtp_test_bad_host(self, hc):
        # ensure smtp saved to a fake host so test connection fails
        payload = {"host": "smtp.fake-nonexistent-xyz.invalid", "port": 587, "security": "starttls",
                   "username": "u", "password": "pw", "from_email": "a@b.com", "from_name": "X"}
        requests.put(f"{BASE}/api/company/smtp", headers=hc, json=payload, timeout=10)
        r = requests.post(f"{BASE}/api/company/smtp/test", headers=hc, timeout=30)
        assert r.status_code == 400, r.text
        assert "SMTP" in r.text or "connection" in r.text.lower()

    def test_delete_clears(self, hc):
        r = requests.delete(f"{BASE}/api/company/smtp", headers=hc, timeout=10)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE}/api/company/smtp", headers=hc, timeout=10)
        assert r2.json()["configured"] is False


# ---------- system email path still works ----------
class TestSystemEmailUnchanged:
    def test_forgot_password_200(self):
        r = requests.post(f"{BASE}/api/auth/forgot-password",
                          json={"email": "nonexistent-user-xyz@example.com"}, timeout=20)
        # should always return 200 to not leak account existence
        assert r.status_code == 200, r.text


# ---------- campaign send returns simulation mode when no SMTP ----------
class TestCampaignSimulationMode:
    def test_send_simulation(self, hc, company_id):
        # ensure smtp is deleted
        requests.delete(f"{BASE}/api/company/smtp", headers=hc, timeout=10)

        # create a contact (fetch existing if already there)
        uniq = f"TEST_sim_{int(time.time())}@example.com"
        c = requests.post(f"{BASE}/api/contacts", headers=hc,
                          json={"email": uniq, "first_name": "T", "last_name": "T"},
                          timeout=10)
        if c.status_code not in (200, 201):
            # look it up
            lst = requests.get(f"{BASE}/api/contacts", headers=hc, timeout=10).json()
            match = [x for x in lst if x.get("email") == uniq]
            if not match:
                pytest.skip(f"could not create contact: {c.status_code} {c.text}")
            contact_id = match[0].get("id") or match[0].get("_id")
        else:
            contact_id = c.json().get("id") or c.json().get("_id")

        # create a campaign
        camp = requests.post(f"{BASE}/api/campaigns", headers=hc,
                             json={"name": "TEST_sim_camp", "subject": "hi", "html": "<p>hello {{first_name}}</p>"},
                             timeout=10)
        if camp.status_code not in (200, 201):
            pytest.skip(f"could not create campaign: {camp.status_code} {camp.text}")
        cid = camp.json().get("id") or camp.json().get("_id")

        # send
        r = requests.post(f"{BASE}/api/campaigns/{cid}/send", headers=hc,
                          json={"contact_ids": [contact_id]}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("mode") == "simulation", body
        assert body.get("recipients") == 1

        # give background task a moment
        time.sleep(1.5)

        # deliveries should exist with simulated=true
        d = requests.get(f"{BASE}/api/campaigns/{cid}/deliveries", headers=hc, timeout=10)
        if d.status_code == 200:
            rows = d.json()
            assert rows, "expected at least one delivery"
            assert all(row.get("simulated") is True for row in rows), rows

        # cleanup
        requests.delete(f"{BASE}/api/campaigns/{cid}", headers=hc, timeout=10)
        requests.delete(f"{BASE}/api/contacts/{contact_id}", headers=hc, timeout=10)
