"""
Tests for new iteration features: Admin role, Licensing, Companies/Workspaces, X-Company-Id scoping.
"""
import os
import uuid
import time
import pytest
import pyotp
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://inbox-pro-64.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"
mongo = MongoClient(MONGO_URL)[DB_NAME]


def _rand_email(prefix="test"):
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _register_and_login(name="Test"):
    email = _rand_email()
    pwd = "Password123!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": name})
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
    body = r.json()
    secret = body["secret"]
    code = pyotp.TOTP(secret).now()
    r = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": body["mfa_token"], "code": code})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email.lower(), "password": pwd, "secret": secret,
            "token": data["access_token"], "user_id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


def _login_yannick():
    """Login as seeded admin yannick using totp secret from mongo."""
    email = "yannick.gijbels@koodh.com"
    pwd = "Koodh2026!"
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
    assert r.status_code == 200, r.text
    body = r.json()
    # Fetch TOTP from mongo (needed if mfa_required)
    doc = mongo.users.find_one({"email": email})
    secret = doc["totp_secret"]
    code = pyotp.TOTP(secret).now()
    mfa_token = body["mfa_token"]
    # Retry TOTP verify a couple times for boundary
    for _ in range(2):
        r2 = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code})
        if r2.status_code == 200:
            break
        time.sleep(1.5)
        code = pyotp.TOTP(secret).now()
    assert r2.status_code == 200, r2.text
    data = r2.json()
    return {"email": email, "token": data["access_token"], "user_id": data["user"]["id"],
            "role": data["user"].get("role"),
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


@pytest.fixture(scope="module")
def admin():
    return _login_yannick()


@pytest.fixture(scope="module")
def normal_user():
    return _register_and_login("Normal U")


@pytest.fixture(scope="module")
def normal_user2():
    return _register_and_login("Normal U2")


# ========== ADMIN LOGIN & ROLE ==========
class TestAdminLogin:
    def test_yannick_is_admin(self, admin):
        r = requests.get(f"{API}/auth/me", headers=admin["headers"])
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["role"] == "admin"
        assert u.get("license", {}).get("plan") == "enterprise"
        assert u.get("license", {}).get("active") is True


# ========== ADMIN USERS ENDPOINT ==========
class TestAdminUsers:
    def test_admin_can_list_users(self, admin):
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        first = rows[0]
        for k in ("id", "email", "role", "license", "companies"):
            assert k in first

    def test_non_admin_forbidden(self, normal_user):
        r = requests.get(f"{API}/admin/users", headers=normal_user["headers"])
        assert r.status_code == 403

    def test_unauth_forbidden(self):
        r = requests.get(f"{API}/admin/users")
        assert r.status_code == 401


# ========== LICENSING ==========
class TestLicensing:
    def test_assign_and_revoke_license(self, admin, normal_user):
        uid = normal_user["user_id"]
        # Assign pro/active
        r = requests.patch(f"{API}/admin/users/{uid}/license",
                           json={"plan": "pro", "active": True}, headers=admin["headers"])
        assert r.status_code == 200
        assert r.json()["license"]["plan"] == "pro"
        assert r.json()["license"]["active"] is True
        # Verify via list
        rows = requests.get(f"{API}/admin/users", headers=admin["headers"]).json()
        me = next(u for u in rows if u["id"] == uid)
        assert me["license"]["plan"] == "pro"
        assert me["license"]["active"] is True
        assert me["license"].get("assigned_by")

        # Revoke
        r = requests.patch(f"{API}/admin/users/{uid}/license",
                           json={"plan": "free", "active": False}, headers=admin["headers"])
        assert r.status_code == 200
        assert r.json()["license"]["active"] is False

    def test_non_admin_cannot_assign(self, normal_user, normal_user2):
        r = requests.patch(f"{API}/admin/users/{normal_user2['user_id']}/license",
                           json={"plan": "pro", "active": True}, headers=normal_user["headers"])
        assert r.status_code == 403

    def test_send_requires_active_license(self, admin, normal_user2):
        # Ensure license is revoked
        requests.patch(f"{API}/admin/users/{normal_user2['user_id']}/license",
                       json={"plan": "free", "active": False}, headers=admin["headers"])
        # Create contact
        r = requests.post(f"{API}/contacts", json={"email": _rand_email("lic")},
                          headers=normal_user2["headers"])
        assert r.status_code == 200
        # Create campaign
        r = requests.post(f"{API}/campaigns",
                          json={"name": "LicTest", "subject": "s", "blocks": [], "html": "<p>Hi</p>"},
                          headers=normal_user2["headers"])
        assert r.status_code == 200
        cid = r.json()["id"]
        # Send should 403
        r = requests.post(f"{API}/campaigns/{cid}/send", json={"contact_ids": None},
                          headers=normal_user2["headers"])
        assert r.status_code == 403
        assert "license" in r.json().get("detail", "").lower()

        # Now activate
        requests.patch(f"{API}/admin/users/{normal_user2['user_id']}/license",
                       json={"plan": "pro", "active": True}, headers=admin["headers"])
        r = requests.post(f"{API}/campaigns/{cid}/send", json={"contact_ids": None},
                          headers=normal_user2["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["mode"] == "simulation"


# ========== COMPANIES / WORKSPACES ==========
class TestCompanies:
    def test_default_company_on_register(self, normal_user):
        r = requests.get(f"{API}/companies", headers=normal_user["headers"])
        assert r.status_code == 200
        rows = r.json()
        # Should have at least the default workspace
        assert len(rows) >= 1
        assert any("Workspace" in c["name"] for c in rows)

    def test_admin_sees_all_companies(self, admin, normal_user):
        r = requests.get(f"{API}/companies", headers=admin["headers"])
        assert r.status_code == 200
        rows = r.json()
        # admin should see the normal_user's company too
        assert len(rows) >= 2

    def test_create_and_delete_company(self, normal_user):
        r = requests.post(f"{API}/companies", json={"name": "TEST_Co"},
                          headers=normal_user["headers"])
        assert r.status_code == 200
        cid = r.json()["id"]
        assert r.json()["name"] == "TEST_Co"
        # List
        rows = requests.get(f"{API}/companies", headers=normal_user["headers"]).json()
        assert any(c["id"] == cid for c in rows)
        # Delete
        r = requests.delete(f"{API}/companies/{cid}", headers=normal_user["headers"])
        assert r.status_code == 200
        rows = requests.get(f"{API}/companies", headers=normal_user["headers"]).json()
        assert not any(c["id"] == cid for c in rows)

    def test_cannot_delete_other_users_company(self, normal_user, normal_user2):
        r = requests.post(f"{API}/companies", json={"name": "TEST_Owned"},
                          headers=normal_user["headers"])
        cid = r.json()["id"]
        r2 = requests.delete(f"{API}/companies/{cid}", headers=normal_user2["headers"])
        assert r2.status_code == 403
        # cleanup
        requests.delete(f"{API}/companies/{cid}", headers=normal_user["headers"])


# ========== X-COMPANY-ID SCOPING ==========
class TestCompanyScoping:
    def test_scoping_by_header(self, admin):
        # Create two companies as admin
        a = requests.post(f"{API}/companies", json={"name": "TEST_A"}, headers=admin["headers"]).json()
        b = requests.post(f"{API}/companies", json={"name": "TEST_B"}, headers=admin["headers"]).json()
        aid, bid = a["id"], b["id"]

        h_a = {**admin["headers"], "X-Company-Id": aid}
        h_b = {**admin["headers"], "X-Company-Id": bid}

        # Create a campaign scoped to A
        r = requests.post(f"{API}/campaigns",
                          json={"name": "camp_A", "subject": "s", "blocks": [], "html": "<p>x</p>"},
                          headers=h_a)
        assert r.status_code == 200
        camp_a_id = r.json()["id"]

        # Create campaign scoped to B
        r = requests.post(f"{API}/campaigns",
                          json={"name": "camp_B", "subject": "s", "blocks": [], "html": "<p>x</p>"},
                          headers=h_b)
        assert r.status_code == 200
        camp_b_id = r.json()["id"]

        # List with header A - should only include camp_A
        camps_a = requests.get(f"{API}/campaigns", headers=h_a).json()
        ids_a = {c["id"] for c in camps_a}
        assert camp_a_id in ids_a
        assert camp_b_id not in ids_a

        camps_b = requests.get(f"{API}/campaigns", headers=h_b).json()
        ids_b = {c["id"] for c in camps_b}
        assert camp_b_id in ids_b
        assert camp_a_id not in ids_b

        # Dashboard scoped
        d_a = requests.get(f"{API}/dashboard", headers=h_a).json()
        d_b = requests.get(f"{API}/dashboard", headers=h_b).json()
        assert d_a["total_campaigns"] >= 1
        assert d_b["total_campaigns"] >= 1

        # Cleanup
        requests.delete(f"{API}/companies/{aid}", headers=admin["headers"])
        requests.delete(f"{API}/companies/{bid}", headers=admin["headers"])

    def test_normal_user_fallback_on_foreign_company_id(self, normal_user, normal_user2):
        # normal_user2 creates a company
        c = requests.post(f"{API}/companies", json={"name": "TEST_Foreign"},
                          headers=normal_user2["headers"]).json()
        foreign_id = c["id"]

        # normal_user sends X-Company-Id of foreign company => should fall back to own default
        h = {**normal_user["headers"], "X-Company-Id": foreign_id}
        # Create a contact — should end up in normal_user's own default company
        email = _rand_email("scope")
        r = requests.post(f"{API}/contacts", json={"email": email}, headers=h)
        assert r.status_code == 200
        # normal_user2 should NOT see this contact
        contacts_u2 = requests.get(f"{API}/contacts",
                                    headers={**normal_user2["headers"], "X-Company-Id": foreign_id}).json()
        assert not any(c["email"] == email for c in contacts_u2)

        # cleanup
        requests.delete(f"{API}/companies/{foreign_id}", headers=normal_user2["headers"])
