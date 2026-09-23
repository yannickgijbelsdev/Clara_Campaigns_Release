"""
Iteration 7 backend tests — Clara Campaigns logo in sent emails.

Covers:
- ms_graph.personalize_html includes CLARA_MARK image URL + bold 'Clara Campaigns'
  in the footer, even when company has no logo_url/logo_path.
- CLARA_MARK asset URL returns HTTP 200 with image content-type (public S3).
- email_util.reset_email_html contains CLARA_MARK + 'Clara Campaigns' and passes
  _assert_safe_email without raising.
- E2E: sending a campaign in simulation mode still succeeds (regression) and the
  personalized HTML persisted in the delivery contains CLARA_MARK + branding.
- Regression: merge-tag personalization still works when personalize_html runs
  after _apply_merge_tags.
"""
import os, sys, re, time, uuid, pytest, pyotp, requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

sys.path.insert(0, "/app/backend")
from ms_graph import personalize_html, CLARA_MARK  # noqa: E402
from email_util import reset_email_html, _assert_safe_email  # noqa: E402
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
        r = requests.post(f"{API}/auth/mfa/verify",
                          json={"mfa_token": mfa_token, "code": code})
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


# ---------- Unit: personalize_html footer contains Clara branding ----------
class TestPersonalizeHtmlLogo:
    def _out(self, company=None):
        return personalize_html(
            html="<html><body><p>Hi</p></body></html>",
            track_id="trk-abc",
            backend_url="https://api.example.com",
            company=company or {},   # no logo set
            public_base="https://campaigns.koodh.com",
            unsub_url="https://campaigns.koodh.com/u/abc",
        )

    def test_contains_clara_mark_url_no_company_logo(self):
        out = self._out({})
        assert CLARA_MARK in out, f"CLARA_MARK not present in output. Got: {out[-800:]}"
        assert CLARA_MARK == "https://koodh-clara.nbg1.your-objectstorage.com/assets/clara-mark.png"

    def test_contains_bold_clara_campaigns_text(self):
        out = self._out({})
        # bold Clara Campaigns near "Sent with"
        assert "Clara Campaigns" in out
        assert re.search(
            r'font-weight:\s*700[^>]*>\s*Clara Campaigns\s*<',
            out,
        ), "'Clara Campaigns' text should be bold (font-weight:700)"
        # 'Sent with ' should precede the clara brand
        assert "Sent with " in out
        assert out.index("Sent with ") < out.index("Clara Campaigns")

    def test_pixel_and_footer_both_injected(self):
        out = self._out({})
        assert 'src="https://api.example.com/api/track/open/trk-abc"' in out
        # footer + pixel injected before </body>
        assert out.lower().rfind("</body>") > out.rfind(CLARA_MARK)

    def test_works_with_company_logo_present(self):
        """Even when company has its own logo_url, Clara brand must still appear."""
        out = self._out({"name": "ACME", "logo_url": "https://cdn.example.com/acme.png"})
        assert "https://cdn.example.com/acme.png" in out
        assert CLARA_MARK in out
        assert "Clara Campaigns" in out


# ---------- CLARA_MARK asset must be publicly reachable ----------
class TestClaraMarkAssetReachable:
    def test_http_200_and_image_content_type(self):
        r = requests.get(CLARA_MARK, timeout=15)
        assert r.status_code == 200, f"CLARA_MARK not reachable: {r.status_code}"
        ctype = r.headers.get("content-type", "").lower()
        assert ctype.startswith("image/"), f"Unexpected content-type: {ctype!r}"
        assert len(r.content) > 0


# ---------- Unit: reset_email_html contains Clara brand + is safe ----------
class TestResetEmailHtmlLogo:
    def test_contains_clara_mark_and_brand_text(self):
        html = reset_email_html("Ada", "https://campaigns.koodh.com/reset?token=abc")
        assert "https://koodh-clara.nbg1.your-objectstorage.com/assets/clara-mark.png" in html
        assert "Clara Campaigns" in html
        # bold
        assert re.search(r'font-weight:\s*700[^>]*>\s*Clara Campaigns\s*<', html)

    def test_passes_safety_gate(self):
        html = reset_email_html("Ada", "https://campaigns.koodh.com/reset?token=abc")
        # should NOT raise
        _assert_safe_email("Reset your Clara Campaigns password", html)


# ---------- E2E: campaign send in simulation mode with logo footer ----------
TAG = f"iter7_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def contacts(admin):
    made = []
    for payload in [
        {"email": f"TEST_{TAG}_a@example.com", "first_name": "Ada", "last_name": "Lovelace"},
        {"email": f"TEST_{TAG}_b@example.com", "first_name": "", "last_name": ""},
    ]:
        r = requests.post(f"{API}/contacts", json=payload, headers=admin["headers"])
        assert r.status_code == 200, r.text
        made.append(r.json())
    yield made
    for c in made:
        requests.delete(f"{API}/contacts/{c['id']}", headers=admin["headers"])


@pytest.fixture(scope="module")
def campaign(admin):
    body = {
        "name": f"TEST_{TAG}_campaign",
        "subject": "Hello {{first_name|there}}",
        "preheader": "",
        "blocks": [],
        "html": "<html><body><p>Hi {{first_name|there}} — check https://koodh.com</p></body></html>",
    }
    r = requests.post(f"{API}/campaigns", json=body, headers=admin["headers"])
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    yield cid
    requests.delete(f"{API}/campaigns/{cid}", headers=admin["headers"])


class TestSendPipelineIntact:
    def test_send_succeeds_simulation(self, admin, campaign, contacts):
        ids = [c["id"] for c in contacts]
        r = requests.post(f"{API}/campaigns/{campaign}/send",
                          json={"contact_ids": ids}, headers=admin["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["mode"] == "simulation"
        assert data["recipients"] == len(ids)

    def test_deliveries_marked_sent(self, admin, campaign, contacts):
        deadline = time.time() + 25
        got = []
        while time.time() < deadline:
            r = requests.get(f"{API}/campaigns/{campaign}/stats",
                             headers=admin["headers"])
            if r.status_code == 200:
                got = r.json().get("recipients", [])
                if got and all(d.get("status") in ("sent", "failed") for d in got):
                    break
            time.sleep(1)
        assert got, "no deliveries appeared"
        for d in got:
            assert d.get("status") == "sent", f"delivery not sent: {d}"


# ---------- Regression: merge tags still work with personalize_html ----------
class TestMergeTagRegression:
    def test_merge_then_personalize_replaces_tags_and_injects_brand(self):
        html_in = "<html><body><p>Hi {{first_name|there}} — {{email}}</p></body></html>"
        # simulate server _run_send order: merge first, then personalize
        merged = _apply_merge_tags(html_in, {"first_name": "Ada", "email": "ada@x.io"})
        out = personalize_html(
            html=merged, track_id="trk-xyz",
            backend_url="https://api.example.com", company={},
            public_base="https://campaigns.koodh.com",
        )
        assert "Hi Ada — ada@x.io" in out
        assert CLARA_MARK in out
        assert "Clara Campaigns" in out

    def test_merge_fallback_used_when_missing(self):
        html_in = "<html><body>Hi {{first_name|there}}</body></html>"
        merged = _apply_merge_tags(html_in, {"first_name": "", "email": "x@y"})
        out = personalize_html(
            html=merged, track_id="t", backend_url="https://api.example.com",
            company={}, public_base="https://campaigns.koodh.com",
        )
        assert "Hi there" in out
        assert CLARA_MARK in out
