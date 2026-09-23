"""
Iteration 5 backend tests:
- GET /admin/users (list many users)
- PATCH /admin/users/{id}  (edit name, edit role, self-demote prevented)
- POST /admin/users/{id}/send-reset (email via Emergent fallback)
- DELETE /admin/users/{id} (with disposable user, self-delete prevented)
- PATCH /admin/companies/{id} (rename)
- POST /plan/request instant free (non-admin) + paid pro/enterprise not-instant
"""
import os, time, uuid, pytest, pyotp, requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
mongo = MongoClient("mongodb://localhost:27017")["test_database"]

ADMIN_EMAIL = "admin@claracampaigns.com"
ADMIN_PWD = "Admin123!"
ADMIN_TOTP = "UPC5QPTQXSSHNMXXCMSUNFBDBFPBSTEQ"

NONADMIN_EMAIL = "onboard_test@clara.nl"
NONADMIN_PWD = "Onboard123!"
NONADMIN_TOTP = "IYUNR6JWDOD4VR2KLD73NWKCNGJ4TJ7Q"


def _mfa_verify(mfa_token, secret, tries=3):
    r = None
    for _ in range(tries):
        code = pyotp.TOTP(secret).now()
        r = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code})
        if r.status_code == 200:
            return r.json()
        time.sleep(1.5)
    raise AssertionError(f"MFA verify failed: {r.status_code} {r.text}")


def _login(email, pwd, secret):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
    assert r.status_code == 200, r.text
    body = r.json()
    if "access_token" in body:
        return body
    return _mfa_verify(body["mfa_token"], secret)


@pytest.fixture(scope="module")
def admin():
    data = _login(ADMIN_EMAIL, ADMIN_PWD, ADMIN_TOTP)
    return {"token": data["access_token"], "user_id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


@pytest.fixture(scope="module")
def nonadmin():
    data = _login(NONADMIN_EMAIL, NONADMIN_PWD, NONADMIN_TOTP)
    return {"token": data["access_token"], "user_id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


def _register(email, pwd="Password123!"):
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "Iter5 Disp"})
    assert r.status_code == 200, r.text
    doc = mongo.users.find_one({"email": email})
    return {"id": str(doc["_id"]), "email": email}


class TestAdminUsersList:
    def test_list(self, admin):
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        emails = [x["email"] for x in rows]
        assert ADMIN_EMAIL in emails


class TestAdminEditUser:
    def test_edit_name(self, admin, nonadmin):
        new_name = "Iter5 TEST_" + uuid.uuid4().hex[:6]
        r = requests.patch(f"{API}/admin/users/{nonadmin['user_id']}",
                           headers=admin["headers"], json={"name": new_name})
        assert r.status_code == 200, r.text
        # verify via list
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        row = next(x for x in r.json() if x["id"] == nonadmin["user_id"])
        assert row["name"] == new_name

    def test_edit_role_toggle(self, admin, nonadmin):
        # promote to admin
        r = requests.patch(f"{API}/admin/users/{nonadmin['user_id']}",
                           headers=admin["headers"], json={"role": "admin"})
        assert r.status_code == 200
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        assert next(x for x in r.json() if x["id"] == nonadmin["user_id"])["role"] == "admin"
        # demote back
        r = requests.patch(f"{API}/admin/users/{nonadmin['user_id']}",
                           headers=admin["headers"], json={"role": "user"})
        assert r.status_code == 200
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        assert next(x for x in r.json() if x["id"] == nonadmin["user_id"])["role"] == "user"

    def test_self_demote_forbidden(self, admin):
        r = requests.patch(f"{API}/admin/users/{admin['user_id']}",
                           headers=admin["headers"], json={"role": "user"})
        assert r.status_code == 400

    def test_self_delete_forbidden(self, admin):
        r = requests.delete(f"{API}/admin/users/{admin['user_id']}", headers=admin["headers"])
        assert r.status_code == 400


class TestAdminSendReset:
    def test_send_reset(self, admin, nonadmin):
        r = requests.post(f"{API}/admin/users/{nonadmin['user_id']}/send-reset",
                          headers=admin["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True and d["email"] == NONADMIN_EMAIL
        # verify token created
        tok = mongo.password_reset_tokens.find_one({"user_id": nonadmin["user_id"]})
        assert tok is not None


class TestAdminDeleteUser:
    def test_create_and_delete(self, admin):
        email = f"test_test_disposable_{uuid.uuid4().hex[:8]}@example.com"
        u = _register(email)
        r = requests.delete(f"{API}/admin/users/{u['id']}", headers=admin["headers"])
        assert r.status_code == 200, r.text
        # verify gone
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        assert u["id"] not in [x["id"] for x in r.json()]


class TestAdminRenameCompany:
    def test_rename(self, admin):
        r = requests.get(f"{API}/admin/companies", headers=admin["headers"])
        assert r.status_code == 200
        comps = r.json()
        assert comps, "no companies to rename"
        target = comps[0]
        original = target["name"]
        new_name = "TEST_Renamed_" + uuid.uuid4().hex[:6]
        r = requests.patch(f"{API}/admin/companies/{target['id']}",
                           headers=admin["headers"], json={"name": new_name})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name
        r = requests.get(f"{API}/admin/companies", headers=admin["headers"])
        assert next(x for x in r.json() if x["id"] == target["id"])["name"] == new_name
        # restore
        requests.patch(f"{API}/admin/companies/{target['id']}",
                       headers=admin["headers"], json={"name": original})


class TestPlanRequest:
    def test_paid_pro_not_instant(self, nonadmin):
        r = requests.post(f"{API}/plan/request", headers=nonadmin["headers"],
                          json={"plan": "pro"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paid"] is True
        assert d.get("instant") in (False, None)
        assert d["plan"] == "pro"

    def test_paid_enterprise_not_instant(self, nonadmin):
        r = requests.post(f"{API}/plan/request", headers=nonadmin["headers"],
                          json={"plan": "enterprise"})
        assert r.status_code == 200
        d = r.json()
        assert d["paid"] is True and d["plan"] == "enterprise"

    def test_free_instant(self, nonadmin):
        r = requests.post(f"{API}/plan/request", headers=nonadmin["headers"],
                          json={"plan": "free"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("instant") is True
        assert d["plan"] == "free"
        assert d["paid"] is False
        # Verify user license updated
        doc = mongo.users.find_one({"email": NONADMIN_EMAIL})
        lic = doc.get("license") or {}
        assert lic.get("plan") == "free"
        assert lic.get("active") is True
