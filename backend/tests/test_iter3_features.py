"""
Iteration 3 backend tests:
- Account: PUT /auth/password (wrong current), POST /auth/avatar + GET /avatar/{id}
- MFA: POST /auth/mfa/backup-codes (+status), /auth/mfa/reset/start (do NOT confirm on admin)
- Branding: GET/PUT /company/branding, POST /company/logo, GET /company/{id}/logo
- Admin company linking: PATCH /admin/users/{id}/companies
- Contacts: status subscribed/unsubscribed shape
- Unsubscribe public flow: send campaign in simulation -> track_id -> GET /unsubscribe/{track_id}
  -> contact becomes unsubscribed -> subsequent send excludes them
"""
import io
import os
import time
import uuid
import pytest
import pyotp
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://inbox-pro-64.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
mongo = MongoClient("mongodb://localhost:27017")["test_database"]


def _rand_email(prefix="iter3"):
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _mfa_verify(mfa_token, secret, tries=3):
    for _ in range(tries):
        code = pyotp.TOTP(secret).now()
        r = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code})
        if r.status_code == 200:
            return r.json()
        time.sleep(1.5)
    raise AssertionError(f"MFA verify failed: {r.status_code} {r.text}")


def _register_login():
    email = _rand_email()
    pwd = "Password123!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "Iter3 U"})
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
    body = r.json()
    data = _mfa_verify(body["mfa_token"], body["secret"])
    return {"email": email, "password": pwd, "secret": body["secret"],
            "token": data["access_token"], "user_id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


def _login_admin():
    email = "yannick.gijbels@koodh.com"
    pwd = "Koodh2026!"
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
    body = r.json()
    doc = mongo.users.find_one({"email": email})
    data = _mfa_verify(body["mfa_token"], doc["totp_secret"])
    return {"token": data["access_token"], "user_id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


@pytest.fixture(scope="module")
def u():
    return _register_login()


@pytest.fixture(scope="module")
def admin():
    return _login_admin()


PNG_1x1 = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f"
           b"\x00\x01\x01\x01\x00\x1b\xb6\xee\x56\x00\x00\x00\x00IEND\xaeB`\x82")


# ---------------- Password change ----------------
class TestPassword:
    def test_wrong_current_password_400(self, u):
        r = requests.put(f"{API}/auth/password", headers=u["headers"],
                         json={"current_password": "WRONG!!", "new_password": "AnyNew123!"})
        assert r.status_code == 400
        assert "incorrect" in r.text.lower()

    def test_change_and_restore(self, u):
        new_pwd = "NewPwd_" + uuid.uuid4().hex[:6] + "!"
        r = requests.put(f"{API}/auth/password", headers=u["headers"],
                         json={"current_password": u["password"], "new_password": new_pwd})
        assert r.status_code == 200
        # verify old fails
        r = requests.post(f"{API}/auth/login", json={"email": u["email"], "password": u["password"]})
        assert r.status_code in (400, 401)
        # login with new
        r = requests.post(f"{API}/auth/login", json={"email": u["email"], "password": new_pwd})
        assert r.status_code == 200
        # restore
        r = requests.put(f"{API}/auth/password", headers=u["headers"],
                         json={"current_password": new_pwd, "new_password": u["password"]})
        assert r.status_code == 200


# ---------------- Avatar ----------------
class TestAvatar:
    def test_upload_and_fetch(self, u):
        files = {"file": ("a.png", PNG_1x1, "image/png")}
        r = requests.post(f"{API}/auth/avatar", headers=u["headers"], files=files)
        assert r.status_code == 200, r.text
        v = r.json()["avatar_version"]
        assert isinstance(v, int) and v > 0
        r = requests.get(f"{API}/avatar/{u['user_id']}")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/")


# ---------------- MFA backup codes + reset start ----------------
class TestMfa:
    def test_backup_codes_generate(self, u):
        r = requests.post(f"{API}/auth/mfa/backup-codes", headers=u["headers"])
        assert r.status_code == 200
        codes = r.json()["codes"]
        assert isinstance(codes, list) and len(codes) == 10
        assert all(isinstance(c, str) and len(c) >= 6 for c in codes)
        # status
        r = requests.get(f"{API}/auth/mfa/backup-codes/status", headers=u["headers"])
        d = r.json()
        assert d["generated"] is True
        assert d["remaining"] == 10 and d["total"] == 10

    def test_mfa_reset_start_only(self, u):
        # Do not confirm to avoid rotating totp
        r = requests.post(f"{API}/auth/mfa/reset/start", headers=u["headers"])
        assert r.status_code == 200
        d = r.json()
        assert "secret" in d and "otpauth_url" in d and "qr" in d
        assert d["qr"].startswith("data:image/")


# ---------------- Branding ----------------
class TestBranding:
    def test_get_update_persist(self, u):
        # Ensure a company exists
        r = requests.get(f"{API}/companies", headers=u["headers"])
        assert r.status_code == 200
        r = requests.get(f"{API}/company/branding", headers=u["headers"])
        assert r.status_code == 200
        payload = {"name": "TEST_Brand_" + uuid.uuid4().hex[:6], "brand_primary": "#123456",
                   "brand_accent": "#abcdef", "website": "https://example.test"}
        r = requests.put(f"{API}/company/branding", headers=u["headers"], json=payload)
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/company/branding", headers=u["headers"])
        d = r.json()
        assert d["name"] == payload["name"]
        assert d["brand_primary"] == "#123456"
        assert d["brand_accent"] == "#abcdef"
        assert d["website"] == "https://example.test"

    def test_logo_upload_and_fetch(self, u):
        files = {"file": ("logo.png", PNG_1x1, "image/png")}
        r = requests.post(f"{API}/company/logo", headers=u["headers"], files=files)
        assert r.status_code == 200, r.text
        # get active company id
        r = requests.get(f"{API}/companies", headers=u["headers"])
        cid = next(c["id"] for c in r.json())
        r = requests.get(f"{API}/company/{cid}/logo")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/")


# ---------------- Admin: link users to companies ----------------
class TestAdminLink:
    def test_assign_and_revoke(self, admin, u):
        # admin creates a company on their own workspace
        cname = "TEST_LinkCo_" + uuid.uuid4().hex[:6]
        r = requests.post(f"{API}/companies", headers=admin["headers"], json={"name": cname})
        assert r.status_code == 200
        new_cid = r.json()["id"]
        # link the fixture user to it
        r = requests.patch(f"{API}/admin/users/{u['user_id']}/companies",
                           headers=admin["headers"], json={"company_ids": [new_cid]})
        assert r.status_code == 200
        # verify via /admin/users
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        row = next(x for x in r.json() if x["id"] == u["user_id"])
        assert new_cid in row["member_of"]
        # revoke
        r = requests.patch(f"{API}/admin/users/{u['user_id']}/companies",
                           headers=admin["headers"], json={"company_ids": []})
        assert r.status_code == 200
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        row = next(x for x in r.json() if x["id"] == u["user_id"])
        assert new_cid not in row["member_of"]
        # cleanup
        requests.delete(f"{API}/companies/{new_cid}", headers=admin["headers"])


# ---------------- Contacts status ----------------
class TestContactStatus:
    def test_create_contact_defaults_subscribed(self, u):
        r = requests.post(f"{API}/contacts", headers=u["headers"],
                          json={"email": _rand_email("ct"), "first_name": "T"})
        assert r.status_code == 200, r.text
        c = r.json()
        assert c.get("status", "subscribed") == "subscribed"


# ---------------- Unsubscribe end-to-end ----------------
class TestUnsubscribeFlow:
    def test_full_flow(self, admin):
        # admin (has no license gate). Create a fresh company + contact + campaign.
        cname = "TEST_UnsubCo_" + uuid.uuid4().hex[:6]
        r = requests.post(f"{API}/companies", headers=admin["headers"], json={"name": cname})
        assert r.status_code == 200
        cid = r.json()["id"]
        h = dict(admin["headers"]); h["X-Company-Id"] = cid
        try:
            # 2 contacts
            e1 = _rand_email("unsub1"); e2 = _rand_email("unsub2")
            r1 = requests.post(f"{API}/contacts", headers=h, json={"email": e1, "first_name": "U1"})
            r2 = requests.post(f"{API}/contacts", headers=h, json={"email": e2, "first_name": "U2"})
            assert r1.status_code == 200 and r2.status_code == 200
            # campaign
            r = requests.post(f"{API}/campaigns", headers=h,
                              json={"name": "TEST_C", "subject": "Hi", "html": "<p>hi {first_name}</p>"})
            assert r.status_code == 200
            camp_id = r.json()["id"]
            # first send (simulation, admin bypasses license gate)
            r = requests.post(f"{API}/campaigns/{camp_id}/send", headers=h, json={"contact_ids": []})
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("mode") == "simulation"
            assert body.get("recipients") == 2
            # wait for background _run_send to insert deliveries
            deadline = time.time() + 8
            deliveries = []
            while time.time() < deadline:
                deliveries = list(mongo.deliveries.find({"campaign_id": camp_id}))
                if len(deliveries) >= 2 and all(d.get("status") == "sent" for d in deliveries):
                    break
                time.sleep(0.5)
            assert len(deliveries) >= 2, "deliveries not created"
            track_id = deliveries[0]["track_id"]
            unsub_email = deliveries[0]["email"]
            # hit public unsubscribe endpoint
            r = requests.get(f"{API}/unsubscribe/{track_id}")
            assert r.status_code == 200
            assert r.headers["content-type"].startswith("text/html")
            assert "unsubscribed" in r.text.lower()
            # contact status is unsubscribed
            contact_doc = mongo.contacts.find_one({"email": unsub_email})
            assert contact_doc["status"] == "unsubscribed"
            # idempotent unsubscribe -> already message (before 2nd send wipes deliveries)
            r = requests.get(f"{API}/unsubscribe/{track_id}")
            assert r.status_code == 200
            assert "already" in r.text.lower()
            # second send should only include 1 contact now
            r = requests.post(f"{API}/campaigns/{camp_id}/send", headers=h, json={"contact_ids": []})
            assert r.status_code == 200, r.text
            assert r.json().get("recipients") == 1
        finally:
            requests.delete(f"{API}/companies/{cid}", headers=admin["headers"])
