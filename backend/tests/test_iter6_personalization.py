"""
Iteration 6 backend tests — newsletter personalization (merge tags).

Covers:
- _apply_merge_tags(html, contact) helper directly (unit test).
- End-to-end: create contacts (with & without names), create a campaign whose
  html contains {{first_name}} / {{name}} / {{email}}, POST /campaigns/{id}/send
  and verify the async simulation-mode send completes and delivery rows are
  created with mode=simulation (missing names must NOT crash).
- Regression: campaign create/update, send with all recipients still works.
"""
import os, sys, time, uuid, pytest, pyotp, requests

sys.path.insert(0, "/app/backend")
from server import _apply_merge_tags  # noqa: E402

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@claracampaigns.com"
ADMIN_PWD = "Admin123!"
ADMIN_TOTP = "UPC5QPTQXSSHNMXXCMSUNFBDBFPBSTEQ"


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
    return {"token": data["access_token"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


# ---------- Unit: _apply_merge_tags ----------
class TestApplyMergeTags:
    def test_replaces_first_last_email_name(self):
        html = "Hi {{first_name}} {{last_name}} <{{email}}>! Full: {{name}}"
        out = _apply_merge_tags(html, {"first_name": "Ada", "last_name": "Lovelace", "email": "ada@x.io"})
        assert out == "Hi Ada Lovelace <ada@x.io>! Full: Ada Lovelace"

    def test_missing_values_become_empty(self):
        html = "Dear {{first_name}} {{last_name}}, email={{email}}, full={{name}}"
        out = _apply_merge_tags(html, {"email": "anon@x.io"})
        # first_name/last_name become empty; name is empty too (trimmed)
        assert out == "Dear  , email=anon@x.io, full="

    def test_whitespace_in_tag(self):
        assert _apply_merge_tags("A={{ first_name }}", {"first_name": "Zed"}) == "A=Zed"

    def test_case_insensitive_key(self):
        assert _apply_merge_tags("{{First_Name}}", {"first_name": "Zed"}) == "Zed"

    def test_unknown_tag_untouched(self):
        # {{unknown}} is not in the values dict → the regex match returns m.group(0)
        assert _apply_merge_tags("keep {{unknown}} raw", {}) == "keep {{unknown}} raw"

    def test_no_tags_passthrough(self):
        assert _apply_merge_tags("<p>Hello world</p>", {"first_name": "x"}) == "<p>Hello world</p>"


# ---------- Integration: send campaign with merge tags ----------
TAG = f"iter6_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def contacts(admin):
    """Create three contacts: with-name, missing-first, all-empty."""
    made = []
    for payload in [
        {"email": f"TEST_{TAG}_named@example.com", "first_name": "Ada", "last_name": "Lovelace"},
        {"email": f"TEST_{TAG}_nofirst@example.com", "first_name": "", "last_name": "Solo"},
        {"email": f"TEST_{TAG}_blank@example.com", "first_name": "", "last_name": ""},
    ]:
        r = requests.post(f"{API}/contacts", json=payload, headers=admin["headers"])
        assert r.status_code == 200, r.text
        made.append(r.json())
    yield made
    # teardown: delete
    for c in made:
        requests.delete(f"{API}/contacts/{c['id']}", headers=admin["headers"])


@pytest.fixture(scope="module")
def campaign(admin):
    body = {
        "name": f"TEST_{TAG}_campaign",
        "subject": "Hi {{first_name}}",
        "preheader": "",
        "blocks": [],
        "html": "<p>Hello {{first_name}} {{last_name}} (full: {{name}}) — {{email}}</p>",
    }
    r = requests.post(f"{API}/campaigns", json=body, headers=admin["headers"])
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    yield cid
    requests.delete(f"{API}/campaigns/{cid}", headers=admin["headers"])


class TestSendWithPersonalization:
    def test_send_returns_simulation_mode(self, admin, campaign, contacts):
        ids = [c["id"] for c in contacts]
        r = requests.post(f"{API}/campaigns/{campaign}/send",
                          json={"contact_ids": ids}, headers=admin["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["recipients"] == len(ids)
        # Microsoft 365 intentionally not connected → simulation mode
        assert data["mode"] == "simulation"

    def test_deliveries_completed(self, admin, campaign, contacts):
        # send is async → poll deliveries
        ids = [c["id"] for c in contacts]
        deadline = time.time() + 20
        got = []
        while time.time() < deadline:
            r = requests.get(f"{API}/campaigns/{campaign}/stats",
                             headers=admin["headers"])
            if r.status_code == 200:
                got = r.json().get("recipients", [])
                statuses = [d.get("status") for d in got]
                if got and all(s in ("sent", "failed") for s in statuses):
                    break
            time.sleep(1)
        assert got, "no deliveries appeared"
        # Every contact we sent to should have a delivery row that finished as 'sent'
        emails = {d["email"]: d for d in got}
        for c in contacts:
            assert c["email"] in emails, f"missing delivery for {c['email']}"
            d = emails[c["email"]]
            assert d.get("status") == "sent", f"{c['email']} delivery not sent: {d}"


# ---------- Regression: campaign CRUD & second send with no merge tags ----------
class TestRegression:
    def test_campaign_update_persists(self, admin, campaign):
        r = requests.put(f"{API}/campaigns/{campaign}",
                         json={"name": f"TEST_{TAG}_renamed", "subject": "s",
                               "preheader": "", "blocks": [], "html": "<p>plain</p>"},
                         headers=admin["headers"])
        assert r.status_code == 200
        assert r.json()["name"] == f"TEST_{TAG}_renamed"
        assert r.json()["html"] == "<p>plain</p>"

    def test_plain_send_still_works(self, admin, campaign, contacts):
        ids = [c["id"] for c in contacts]
        r = requests.post(f"{API}/campaigns/{campaign}/send",
                          json={"contact_ids": ids}, headers=admin["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["recipients"] == len(ids)
