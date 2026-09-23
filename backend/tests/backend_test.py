"""
Backend integration tests for Clara Campaigns.
Covers: Auth (register/MFA/login/brute force), Contacts CRUD + import + isolation,
Campaigns CRUD, Send (simulation), Tracking (open/click), Stats, Dashboard, Mailbox.
"""
import os
import io
import time
import uuid
import pytest
import pyotp
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://inbox-pro-64.preview.emergentagent.com"
API = f"{BASE_URL}/api"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

mongo = MongoClient(MONGO_URL)[DB_NAME]


def _rand_email(prefix="test"):
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _register_and_login(name="Test User"):
    """Register a new user, complete MFA setup, return (email, access_token, secret)."""
    email = _rand_email()
    pwd = "Password123!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": name})
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("mfa_setup_required") is True
    secret = body["secret"]
    mfa_token = body["mfa_token"]
    code = pyotp.TOTP(secret).now()
    r = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data["user"]["email"] == email.lower()
    return email.lower(), pwd, secret, data["access_token"]


@pytest.fixture(scope="module")
def user_a():
    email, pwd, secret, token = _register_and_login("User A")
    return {"email": email, "password": pwd, "secret": secret, "token": token,
            "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def user_b():
    email, pwd, secret, token = _register_and_login("User B")
    return {"email": email, "password": pwd, "secret": secret, "token": token,
            "headers": {"Authorization": f"Bearer {token}"}}


# ---------- AUTH ----------
class TestAuth:
    def test_register_login_mfa_setup(self, user_a):
        r = requests.get(f"{API}/auth/me", headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["user"]["email"] == user_a["email"]

    def test_second_login_requires_mfa_only(self, user_a):
        r = requests.post(f"{API}/auth/login", json={"email": user_a["email"], "password": user_a["password"]})
        assert r.status_code == 200
        data = r.json()
        assert data.get("mfa_required") is True
        assert "secret" not in data
        code = pyotp.TOTP(user_a["secret"]).now()
        r2 = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": data["mfa_token"], "code": code})
        assert r2.status_code == 200
        assert "access_token" in r2.json()

    def test_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nobody-xyz@example.com", "password": "wrong"})
        assert r.status_code == 401

    def test_brute_force_lockout(self):
        # Fresh user for isolation
        email, pwd, _, _ = _register_and_login("Brute")
        for i in range(5):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "WRONG"})
            assert r.status_code == 401, f"attempt {i}: {r.status_code}"
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "WRONG"})
        assert r.status_code == 429, r.text
        # Even with correct pwd should be locked
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert r.status_code == 429

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- CONTACTS ----------
class TestContacts:
    def test_create_list_delete(self, user_a):
        payload = {"email": _rand_email("c"), "first_name": "A", "last_name": "B",
                   "company": "Acme", "tags": ["vip"]}
        r = requests.post(f"{API}/contacts", json=payload, headers=user_a["headers"])
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        assert r.json()["email"] == payload["email"]

        r = requests.get(f"{API}/contacts", headers=user_a["headers"])
        assert r.status_code == 200
        assert any(c["id"] == cid for c in r.json())

        r = requests.delete(f"{API}/contacts/{cid}", headers=user_a["headers"])
        assert r.status_code == 200
        r = requests.get(f"{API}/contacts", headers=user_a["headers"])
        assert not any(c["id"] == cid for c in r.json())

    def test_duplicate_contact_rejected(self, user_a):
        email = _rand_email("dup")
        r = requests.post(f"{API}/contacts", json={"email": email}, headers=user_a["headers"])
        assert r.status_code == 200
        r = requests.post(f"{API}/contacts", json={"email": email}, headers=user_a["headers"])
        assert r.status_code == 400

    def test_per_user_isolation(self, user_a, user_b):
        email = _rand_email("iso")
        r = requests.post(f"{API}/contacts", json={"email": email}, headers=user_a["headers"])
        assert r.status_code == 200
        # User B should NOT see it
        r = requests.get(f"{API}/contacts", headers=user_b["headers"])
        assert r.status_code == 200
        assert not any(c["email"] == email for c in r.json())

    def test_csv_import(self, user_a):
        csv_content = "email,first_name,last_name,company,tags\n"
        e1, e2 = _rand_email("csv1"), _rand_email("csv2")
        csv_content += f"{e1},John,Doe,Acme,vip,tag2\n"  # extra col ignored by DictReader
        csv_content += f"{e2},Jane,Doe,Beta,\"vip,promo\"\n"
        csv_content += f"invalid-email,x,y,z,\n"
        csv_content += f"{e1},dup,dup,dup,dup\n"  # duplicate

        files = {"file": ("contacts.csv", csv_content, "text/csv")}
        r = requests.post(f"{API}/contacts/import", files=files, headers=user_a["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["imported"] == 2
        assert data["skipped"] == 2

        # re-import same should skip all
        files = {"file": ("contacts.csv", csv_content, "text/csv")}
        r = requests.post(f"{API}/contacts/import", files=files, headers=user_a["headers"])
        assert r.json()["imported"] == 0


# ---------- CAMPAIGNS & SEND ----------
class TestCampaigns:
    def _create_campaign(self, user):
        payload = {
            "name": "TEST_Campaign", "subject": "Hello",
            "preheader": "pre", "blocks": [],
            "html": "<html><body><h1>Hi {{first_name}}</h1><a href='https://example.com'>Click</a></body></html>",
        }
        r = requests.post(f"{API}/campaigns", json=payload, headers=user["headers"])
        assert r.status_code == 200, r.text
        return r.json()

    def test_crud(self, user_a):
        c = self._create_campaign(user_a)
        cid = c["id"]

        r = requests.get(f"{API}/campaigns", headers=user_a["headers"])
        assert r.status_code == 200
        assert any(x["id"] == cid for x in r.json())
        assert "stats" in r.json()[0]

        r = requests.get(f"{API}/campaigns/{cid}", headers=user_a["headers"])
        assert r.status_code == 200

        r = requests.put(f"{API}/campaigns/{cid}",
                         json={"name": "TEST_Updated", "subject": "S", "blocks": [], "html": "<p>x</p>"},
                         headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Updated"

        r = requests.delete(f"{API}/campaigns/{cid}", headers=user_a["headers"])
        assert r.status_code == 200
        r = requests.get(f"{API}/campaigns/{cid}", headers=user_a["headers"])
        assert r.status_code == 404

    def test_send_simulation_and_tracking(self, user_a):
        # Grant license (new iteration requires active license for send)
        mongo.users.update_one({"email": user_a["email"]},
                                {"$set": {"license": {"plan": "pro", "active": True}}})
        # Ensure at least 1 contact
        email = _rand_email("send")
        requests.post(f"{API}/contacts", json={"email": email, "first_name": "Rec"},
                      headers=user_a["headers"])

        c = self._create_campaign(user_a)
        cid = c["id"]

        r = requests.post(f"{API}/campaigns/{cid}/send", json={"contact_ids": None},
                          headers=user_a["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["mode"] == "simulation"
        assert body["recipients"] >= 1

        # Wait for background task
        time.sleep(2)

        # Find a delivery via mongo
        delivery = mongo.deliveries.find_one({"campaign_id": cid, "email": email})
        assert delivery is not None
        assert delivery["status"] == "sent"
        track_id = delivery["track_id"]

        # Open tracking
        r = requests.get(f"{API}/track/open/{track_id}")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/gif")
        d = mongo.deliveries.find_one({"track_id": track_id})
        assert d["opened"] is True and d["open_count"] >= 1

        # Click tracking
        r = requests.get(f"{API}/track/click/{track_id}",
                         params={"u": "https://example.com"}, allow_redirects=False)
        assert r.status_code in (302, 307)
        d = mongo.deliveries.find_one({"track_id": track_id})
        assert d["clicked"] is True
        assert "https://example.com" in d["clicked_links"]

        # Stats
        r = requests.get(f"{API}/campaigns/{cid}/stats", headers=user_a["headers"])
        assert r.status_code == 200
        s = r.json()
        assert s["totals"]["sent"] >= 1
        assert s["totals"]["opened"] >= 1
        assert s["totals"]["clicked"] >= 1
        assert s["totals"]["open_rate"] > 0
        assert isinstance(s["top_links"], list)
        assert any(l["url"] == "https://example.com" for l in s["top_links"])
        assert len(s["recipients"]) >= 1

    def test_send_no_recipients_400(self, user_a):
        mongo.users.update_one({"email": user_a["email"]},
                                {"$set": {"license": {"plan": "pro", "active": True}}})
        c = self._create_campaign(user_a)
        r = requests.post(f"{API}/campaigns/{c['id']}/send",
                          json={"contact_ids": ["507f1f77bcf86cd799439011"]},
                          headers=user_a["headers"])
        assert r.status_code == 400

    def test_campaign_isolation(self, user_a, user_b):
        c = self._create_campaign(user_a)
        r = requests.get(f"{API}/campaigns/{c['id']}", headers=user_b["headers"])
        assert r.status_code == 404


# ---------- DASHBOARD & MAILBOX ----------
class TestDashboardAndMailbox:
    def test_dashboard(self, user_a):
        r = requests.get(f"{API}/dashboard", headers=user_a["headers"])
        assert r.status_code == 200
        d = r.json()
        for k in ("total_campaigns", "total_contacts", "total_sent",
                  "total_opened", "total_clicked", "recent_campaigns"):
            assert k in d

    def test_mailbox_not_configured(self, user_a):
        r = requests.get(f"{API}/mailbox", headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json() == {"configured": False, "connected": False}

    def test_oauth_start_not_configured(self, user_a):
        r = requests.get(f"{API}/oauth/microsoft/start", headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json() == {"configured": False}
