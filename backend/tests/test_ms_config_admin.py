"""Tests for admin Azure MS Graph config endpoints (/api/admin/ms-config).

Covers: GET/PUT/DELETE authorization, encryption at rest, field validation,
secret preservation on partial update, and SMTP regression via forgot-password.
"""
import os
import pytest
import requests
import pyotp
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@claracampaigns.com"
ADMIN_PASS = "Admin123!"
ADMIN_TOTP = "UPC5QPTQXSSHNMXXCMSUNFBDBFPBSTEQ"

NON_ADMIN_EMAIL = "onboard_test@clara.nl"
NON_ADMIN_PASS = "Onboard123!"
NON_ADMIN_TOTP = "IYUNR6JWDOD4VR2KLD73NWKCNGJ4TJ7Q"

TEST_CID = "11111111-2222-3333-4444-555555555555"
TEST_TENANT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
TEST_SECRET = "TEST_super_secret_value_xyz"


def _login(email, password, totp_secret):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    mfa_token = body.get("mfa_token")
    assert mfa_token, f"no mfa_token: {body}"
    code = pyotp.TOTP(totp_secret).now()
    r2 = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code})
    assert r2.status_code == 200, f"mfa verify failed: {r2.status_code} {r2.text}"
    return r2.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS, ADMIN_TOTP)


@pytest.fixture(scope="module")
def non_admin_token():
    return _login(NON_ADMIN_EMAIL, NON_ADMIN_PASS, NON_ADMIN_TOTP)


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def user_h(non_admin_token):
    return {"Authorization": f"Bearer {non_admin_token}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup_ms_config(admin_h):
    # Ensure clean slate before and after
    requests.delete(f"{API}/admin/ms-config", headers=admin_h)
    yield
    requests.delete(f"{API}/admin/ms-config", headers=admin_h)


class TestMsConfigAuth:
    def test_get_requires_admin(self, user_h):
        r = requests.get(f"{API}/admin/ms-config", headers=user_h)
        assert r.status_code == 403

    def test_put_requires_admin(self, user_h):
        r = requests.put(f"{API}/admin/ms-config", headers=user_h,
                         json={"client_id": TEST_CID, "client_secret": TEST_SECRET, "tenant": TEST_TENANT})
        assert r.status_code == 403

    def test_delete_requires_admin(self, user_h):
        r = requests.delete(f"{API}/admin/ms-config", headers=user_h)
        assert r.status_code == 403


class TestMsConfigCrud:
    def test_get_initial_no_secret_field(self, admin_h):
        r = requests.get(f"{API}/admin/ms-config", headers=admin_h)
        assert r.status_code == 200
        data = r.json()
        for k in ["client_id", "tenant", "has_secret", "configured", "system_mail_ready", "redirect_uri"]:
            assert k in data, f"missing key {k}"
        assert "client_secret" not in data
        assert "client_secret_enc" not in data

    def test_put_validation_blank_client_id(self, admin_h):
        r = requests.put(f"{API}/admin/ms-config", headers=admin_h,
                         json={"client_id": "  ", "client_secret": TEST_SECRET, "tenant": TEST_TENANT})
        assert r.status_code == 400

    def test_put_validation_blank_tenant(self, admin_h):
        r = requests.put(f"{API}/admin/ms-config", headers=admin_h,
                         json={"client_id": TEST_CID, "client_secret": TEST_SECRET, "tenant": " "})
        assert r.status_code == 400

    def test_put_save_and_get(self, admin_h):
        r = requests.put(f"{API}/admin/ms-config", headers=admin_h,
                         json={"client_id": TEST_CID, "client_secret": TEST_SECRET, "tenant": TEST_TENANT})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("configured") is True
        assert body.get("system_mail_ready") is True

        g = requests.get(f"{API}/admin/ms-config", headers=admin_h)
        assert g.status_code == 200
        d = g.json()
        assert d["client_id"] == TEST_CID
        assert d["tenant"] == TEST_TENANT
        assert d["has_secret"] is True
        assert d["configured"] is True
        assert "client_secret" not in d

    def test_secret_encrypted_at_rest(self):
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        assert mongo_url and db_name
        cli = MongoClient(mongo_url)
        doc = cli[db_name].app_settings.find_one({"_id": "ms_graph"})
        assert doc is not None
        assert "client_secret_enc" in doc
        assert doc["client_secret_enc"] != TEST_SECRET
        assert TEST_SECRET not in str(doc.get("client_secret_enc", ""))
        # plaintext client_secret must NOT be stored
        assert doc.get("client_secret") in (None, "")

    def test_put_without_secret_preserves(self, admin_h):
        # Update client_id/tenant only, omit client_secret -> secret preserved
        new_cid = "22222222-2222-3333-4444-555555555555"
        r = requests.put(f"{API}/admin/ms-config", headers=admin_h,
                         json={"client_id": new_cid, "tenant": TEST_TENANT})
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["configured"] is True
        assert b["system_mail_ready"] is True

        g = requests.get(f"{API}/admin/ms-config", headers=admin_h).json()
        assert g["client_id"] == new_cid
        assert g["has_secret"] is True
        assert g["configured"] is True

    def test_put_blank_secret_preserves(self, admin_h):
        r = requests.put(f"{API}/admin/ms-config", headers=admin_h,
                         json={"client_id": TEST_CID, "client_secret": "", "tenant": TEST_TENANT})
        assert r.status_code == 200
        g = requests.get(f"{API}/admin/ms-config", headers=admin_h).json()
        assert g["has_secret"] is True
        assert g["configured"] is True

    def test_delete_clears(self, admin_h):
        r = requests.delete(f"{API}/admin/ms-config", headers=admin_h)
        assert r.status_code == 200
        g = requests.get(f"{API}/admin/ms-config", headers=admin_h).json()
        assert g["configured"] is False
        assert g["has_secret"] is False


class TestSmtpRegression:
    def test_forgot_password_still_ok(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL})
        assert r.status_code == 200
