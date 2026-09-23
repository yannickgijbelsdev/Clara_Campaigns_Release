"""Backend tests for Batch C: categories, subscribe API, public form, plans, category-targeted send."""
import os
import time
import pytest
import requests
import pyotp
from pymongo import MongoClient

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # fallback: read frontend .env
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                BASE = ln.split("=", 1)[1].strip().strip('"')
API = f"{BASE}/api"

ADMIN_EMAIL = "yannick.gijbels@koodh.com"
ADMIN_PW = "Koodh2026!"
ADMIN_API_KEY = "clr_Ed0z2JcUxEhJNGA8nXLDs8e1NnIh1p2M"

mongo = MongoClient("mongodb://localhost:27017")
db = mongo["test_database"]


def _mfa_login(email, password, totp_secret=None):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    j = r.json()
    if "access_token" in j:
        return j["access_token"]
    mfa_token = j["mfa_token"]
    if not totp_secret:
        u = db.users.find_one({"email": email})
        totp_secret = u["totp_secret"]
    code = pyotp.TOTP(totp_secret).now()
    r2 = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code})
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _mfa_login(ADMIN_EMAIL, ADMIN_PW)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    # discover company id for the api_key
    comp = db.companies.find_one({"api_key": ADMIN_API_KEY})
    assert comp, "expected company with the seed api_key present"
    return {"Authorization": f"Bearer {admin_token}", "X-Company-Id": str(comp["_id"])}, str(comp["_id"])


# ---- Categories CRUD ----
class TestCategories:
    created_id = None

    def test_create_category(self, admin_headers):
        headers, _ = admin_headers
        r = requests.post(f"{API}/categories",
                          headers=headers, json={"name": "TEST_Batch_C_Cat", "description": "batch c test"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["name"] == "TEST_Batch_C_Cat"
        assert "id" in j
        TestCategories.created_id = j["id"]

    def test_list_includes_new(self, admin_headers):
        headers, _ = admin_headers
        r = requests.get(f"{API}/categories", headers=headers)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert TestCategories.created_id in ids

    def test_delete_category(self, admin_headers):
        headers, _ = admin_headers
        r = requests.delete(f"{API}/categories/{TestCategories.created_id}", headers=headers)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/categories", headers=headers)
        ids = [c["id"] for c in r2.json()]
        assert TestCategories.created_id not in ids


# ---- Subscribe settings ----
class TestSubscribeSettings:
    def test_get_settings(self, admin_headers):
        headers, _ = admin_headers
        r = requests.get(f"{API}/subscribe/settings", headers=headers)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["api_key"] == ADMIN_API_KEY
        assert j["public_url"].startswith("https://campaigns.koodh.com/subscribe/")
        assert ADMIN_API_KEY in j["public_url"]

    def test_update_and_persist(self, admin_headers):
        headers, _ = admin_headers
        payload = {"website": "https://uibrand.example",
                   "form_title": "TEST title", "form_intro": "TEST intro",
                   "form_thankyou": "TEST thanks", "collect_city": False, "active": True}
        r = requests.put(f"{API}/subscribe/settings", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["form_title"] == "TEST title"
        assert j["collect_city"] is False
        # reload
        r2 = requests.get(f"{API}/subscribe/settings", headers=headers)
        j2 = r2.json()
        assert j2["form_title"] == "TEST title"
        assert j2["form_intro"] == "TEST intro"
        assert j2["collect_city"] is False
        # restore collect_city true for later tests
        requests.put(f"{API}/subscribe/settings", headers=headers, json={"collect_city": True})


# ---- Public form (no auth) ----
class TestPublicForm:
    def test_public_form_get(self):
        r = requests.get(f"{API}/public/form/{ADMIN_API_KEY}")
        assert r.status_code == 200, r.text
        j = r.json()
        assert "company_name" in j
        assert isinstance(j["categories"], list)

    def test_invalid_api_key_404(self):
        r = requests.get(f"{API}/public/form/clr_invalid_bogus_key_xyz")
        assert r.status_code == 404

    def test_public_subscribe_creates_contact(self, admin_headers):
        headers, company_id = admin_headers
        # create category for targeting
        rc = requests.post(f"{API}/categories", headers=headers,
                           json={"name": "TEST_PubSubCat", "description": ""})
        cat_id = rc.json()["id"]
        try:
            email = f"test_pubsub_{int(time.time())}@example.com"
            body = {"first_name": "Pub", "last_name": "Sub", "email": email,
                    "city": "Amsterdam", "category_ids": [cat_id]}
            r = requests.post(f"{API}/public/subscribe/{ADMIN_API_KEY}", json=body)
            assert r.status_code == 200, r.text
            assert r.json().get("ok") is True
            # verify contact exists via authed API
            r2 = requests.get(f"{API}/contacts", headers=headers)
            assert r2.status_code == 200
            match = [c for c in r2.json() if c["email"] == email]
            assert match, f"contact {email} not created"
            c = match[0]
            assert c.get("status") == "subscribed"
            assert cat_id in (c.get("categories") or [])
            # cleanup
            requests.delete(f"{API}/contacts/{c['id']}", headers=headers)
        finally:
            requests.delete(f"{API}/categories/{cat_id}", headers=headers)

    def test_public_subscribe_invalid_key_404(self):
        r = requests.post(f"{API}/public/subscribe/clr_bad_bogus",
                          json={"first_name": "a", "last_name": "b", "email": "x@y.com"})
        assert r.status_code == 404

    def test_connection_flag_after_public_call(self, admin_headers):
        # already called public_form / public_subscribe above
        headers, _ = admin_headers
        r = requests.get(f"{API}/subscribe/settings", headers=headers)
        assert r.json().get("connected") is True


# ---- Plan endpoint ----
class TestPlans:
    def test_request_free_no_popup(self, admin_headers):
        headers, _ = admin_headers
        r = requests.post(f"{API}/plan/request", headers=headers,
                          json={"plan": "free", "message": "TEST"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["paid"] is False
        assert j["plan"] == "free"

    def test_request_pro_paid_true(self, admin_headers):
        headers, _ = admin_headers
        r = requests.post(f"{API}/plan/request", headers=headers,
                          json={"plan": "pro", "message": "TEST quote pls"})
        assert r.status_code == 200, r.text
        assert r.json()["paid"] is True

    def test_request_enterprise_paid_true(self, admin_headers):
        headers, _ = admin_headers
        r = requests.post(f"{API}/plan/request", headers=headers,
                          json={"plan": "enterprise", "message": "TEST"})
        assert r.status_code == 200
        assert r.json()["paid"] is True


# ---- Category-targeted send filter ----
class TestCategorySendFilter:
    def test_send_targets_only_category_and_excludes_unsubscribed(self, admin_headers):
        headers, company_id = admin_headers
        # Category A + B
        rA = requests.post(f"{API}/categories", headers=headers, json={"name": "TEST_SendA"}).json()
        rB = requests.post(f"{API}/categories", headers=headers, json={"name": "TEST_SendB"}).json()
        catA, catB = rA["id"], rB["id"]
        # Contact in A (subscribed), in A (unsubscribed), in B
        # Use public subscribe (writes `categories` field expected by _start_send)
        ts = int(time.time())
        e1, e2, e3 = f"testa1_{ts}@e.com", f"testa2_{ts}@e.com", f"testb1_{ts}@e.com"
        for em, cat in [(e1, catA), (e2, catA), (e3, catB)]:
            r = requests.post(f"{API}/public/subscribe/{ADMIN_API_KEY}",
                              json={"first_name": "TEST", "last_name": "X",
                                    "email": em, "category_ids": [cat]})
            assert r.status_code == 200, r.text
        # look up ids
        c1 = db.contacts.find_one({"company_id": company_id, "email": e1})
        c2 = db.contacts.find_one({"company_id": company_id, "email": e2})
        c3 = db.contacts.find_one({"company_id": company_id, "email": e3})
        assert c1 and c2 and c3
        db.contacts.update_one({"_id": c2["_id"]}, {"$set": {"status": "unsubscribed"}})
        c1 = {"id": str(c1["_id"])}; c2 = {"id": str(c2["_id"])}; c3 = {"id": str(c3["_id"])}
        # create campaign with html
        cam = requests.post(f"{API}/campaigns", headers=headers,
                            json={"name": "TEST_batch_c_send", "subject": "s", "html": "<p>hi</p>"}).json()
        try:
            r = requests.post(f"{API}/campaigns/{cam['id']}/send", headers=headers,
                              json={"contact_ids": [], "category_ids": [catA]})
            assert r.status_code == 200, r.text
            j = r.json()
            # Should only include c1 (subscribed in catA); not c2 (unsubscribed), not c3 (catB)
            assert j["recipients"] == 1, f"expected 1 recipient, got {j}"
        finally:
            for cid in (c1["id"], c2["id"], c3["id"]):
                requests.delete(f"{API}/contacts/{cid}", headers=headers)
            requests.delete(f"{API}/campaigns/{cam['id']}", headers=headers)
            requests.delete(f"{API}/categories/{catA}", headers=headers)
            requests.delete(f"{API}/categories/{catB}", headers=headers)


# ---- Regenerate api key ----
class TestRegenKey:
    def test_regen_key_changes_and_resets_connected(self, admin_headers):
        headers, company_id = admin_headers
        # ensure connected flipped first
        requests.get(f"{API}/public/form/{ADMIN_API_KEY}")
        before = requests.get(f"{API}/subscribe/settings", headers=headers).json()
        old_key = before["api_key"]
        r = requests.post(f"{API}/subscribe/regenerate-key", headers=headers)
        assert r.status_code == 200, r.text
        new_key = r.json()["api_key"]
        assert new_key != old_key
        assert r.json().get("connected") is False
        # restore original api_key so other tests / UI keep working
        db.companies.update_one({"_id": __import__("bson").ObjectId(company_id)},
                                {"$set": {"api_key": ADMIN_API_KEY}})
