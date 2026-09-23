"""
Iteration 8 backend tests — Clara Campaigns brand header (logo + wordmark)
in PASSWORD RESET and PLAN CHANGE REQUEST system emails.

Covers:
- email_util.clara_brand_header(on_dark=True/False) contents & colors.
- email_util.reset_email_html contains CLARA_MARK + 'Clara Campaigns' and
  passes the safety gate.
- server._plan_request_html contains CLARA_MARK + 'Clara Campaigns' and
  passes the safety gate.
- CLARA_MARK asset reachable (HTTP 200 + image/*).
- E2E: /api/plan/request {plan:'pro'} (non-admin) returns 200 with
  paid=true, instant=false; /api/auth/forgot-password returns 200;
  /api/admin/users/{id}/send-reset returns 200.
- Regression: ms_graph.personalize_html footer still contains Clara brand.
"""
import os, sys, re, time, pytest, pyotp, requests
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

sys.path.insert(0, "/app/backend")
import email_util  # noqa: E402
from email_util import (  # noqa: E402
    CLARA_MARK, clara_brand_header, reset_email_html, _assert_safe_email,
)
import server  # noqa: E402
from ms_graph import personalize_html  # noqa: E402

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@claracampaigns.com"
ADMIN_PWD = "Admin123!"
ADMIN_TOTP = "UPC5QPTQXSSHNMXXCMSUNFBDBFPBSTEQ"

USER_EMAIL = "onboard_test@clara.nl"
USER_PWD = "Onboard123!"
USER_TOTP = "IYUNR6JWDOD4VR2KLD73NWKCNGJ4TJ7Q"


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


@pytest.fixture(scope="module")
def user_client():
    data = _login(USER_EMAIL, USER_PWD, USER_TOTP)
    return {"token": data["access_token"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


# ---------- Unit: clara_brand_header both modes ----------
class TestClaraBrandHeader:
    def test_on_dark_contains_mark_brand_white_text(self):
        html = clara_brand_header(on_dark=True)
        assert CLARA_MARK in html
        assert "Clara Campaigns" in html
        assert "#ffffff" in html
        # bold Clara Campaigns
        assert re.search(r"font-weight:\s*700[^>]*>\s*Clara Campaigns\s*<", html)

    def test_on_light_contains_mark_brand_dark_text(self):
        html = clara_brand_header(on_dark=False)
        assert CLARA_MARK in html
        assert "Clara Campaigns" in html
        assert "#0f172a" in html
        assert re.search(r"font-weight:\s*700[^>]*>\s*Clara Campaigns\s*<", html)

    def test_white_badge_present_both_modes(self):
        for on_dark in (True, False):
            html = clara_brand_header(on_dark=on_dark)
            # white circular badge background around mark
            assert "background:#ffffff" in html
            assert "border-radius:9999px" in html


# ---------- Unit: reset_email_html has logo + gate passes ----------
class TestResetEmailHtml:
    def test_logo_and_brand_present(self):
        html = reset_email_html("Ada", "https://campaigns.koodh.com/reset?token=abc")
        assert CLARA_MARK in html
        assert "Clara Campaigns" in html
        assert re.search(r"font-weight:\s*700[^>]*>\s*Clara Campaigns\s*<", html)

    def test_safety_gate_passes(self):
        html = reset_email_html("Ada", "https://campaigns.koodh.com/reset?token=abc")
        _assert_safe_email("Reset your Clara Campaigns password", html)  # no raise


# ---------- Unit: _plan_request_html has logo + gate passes ----------
class TestPlanRequestHtml:
    def _out(self):
        return server._plan_request_html(
            "user@example.com", "User Name", "Acme BV",
            "free", "pro", "We want to upgrade please.",
        )

    def test_logo_and_brand_present(self):
        html = self._out()
        assert CLARA_MARK in html
        assert "Clara Campaigns" in html
        assert re.search(r"font-weight:\s*700[^>]*>\s*Clara Campaigns\s*<", html)

    def test_safety_gate_passes(self):
        _assert_safe_email("Plan change request: user@example.com → pro", self._out())

    def test_light_header_dark_text(self):
        # _plan_request_html uses on_dark=False → header text #0f172a
        html = self._out()
        assert "#0f172a" in html


# ---------- Asset reachability ----------
class TestClaraMarkAsset:
    def test_http_200_image(self):
        r = requests.get(CLARA_MARK, timeout=15)
        assert r.status_code == 200, f"CLARA_MARK not reachable: {r.status_code}"
        ctype = r.headers.get("content-type", "").lower()
        assert ctype.startswith("image/"), f"Unexpected content-type: {ctype!r}"
        assert len(r.content) > 0


# ---------- E2E endpoint smokes ----------
class TestPlanRequestEndpoint:
    def test_pro_plan_request_returns_200_paid_not_instant(self, user_client):
        r = requests.post(f"{API}/plan/request",
                          json={"plan": "pro", "message": "TEST_iter8 upgrade"},
                          headers=user_client["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("paid") is True
        assert data.get("instant") is False
        assert data.get("plan") == "pro"


class TestForgotPassword:
    def test_forgot_password_200_existing_user(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": USER_EMAIL})
        assert r.status_code == 200, r.text


class TestAdminSendReset:
    def test_admin_send_reset_200(self, admin):
        # find the non-admin user id
        r = requests.get(f"{API}/admin/users", headers=admin["headers"])
        assert r.status_code == 200, r.text
        users = r.json()
        if isinstance(users, dict):
            users = users.get("users") or users.get("items") or []
        target = next((u for u in users if u.get("email") == USER_EMAIL), None)
        assert target, f"could not find user {USER_EMAIL} in admin list"
        uid = target.get("id") or target.get("_id")
        r = requests.post(f"{API}/admin/users/{uid}/send-reset",
                          headers=admin["headers"])
        assert r.status_code == 200, r.text


# ---------- Regression: newsletter footer branding preserved ----------
class TestNewsletterFooterRegression:
    def test_personalize_html_still_has_clara_brand(self):
        out = personalize_html(
            html="<html><body><p>Hi</p></body></html>",
            track_id="trk-r", backend_url="https://api.example.com",
            company={}, public_base="https://campaigns.koodh.com",
            unsub_url="https://campaigns.koodh.com/u/abc",
        )
        assert CLARA_MARK in out
        assert "Clara Campaigns" in out

    def test_merge_tags_still_applied(self):
        from server import _apply_merge_tags
        html_in = "<html><body>Hi {{first_name|there}} — {{email}}</body></html>"
        merged = _apply_merge_tags(html_in, {"first_name": "Ada", "email": "ada@x.io"})
        out = personalize_html(
            html=merged, track_id="t", backend_url="https://api.example.com",
            company={}, public_base="https://campaigns.koodh.com",
        )
        assert "Hi Ada — ada@x.io" in out
        assert CLARA_MARK in out
