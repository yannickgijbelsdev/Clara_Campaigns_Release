"""Iteration 9 - Verify credentialed CORS fix + regression auth flows."""
import os
import uuid
import pytest
import pyotp
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://inbox-pro-64.preview.emergentagent.com").rstrip("/")
CROSS_ORIGIN = "https://app.example.com"
ADMIN_EMAIL = "admin@claracampaigns.com"
ADMIN_PASSWORD = "Admin123!"
ADMIN_TOTP_SECRET = "UPC5QPTQXSSHNMXXCMSUNFBDBFPBSTEQ"


# ---------- CORS: actual (simple) responses ----------
class TestCORSActualResponses:
    def test_cors_on_get_endpoint(self):
        # /api/auth/me without token still triggers CORS headers on the response
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Origin": CROSS_ORIGIN}, timeout=15)
        aco = r.headers.get("access-control-allow-origin")
        acc = r.headers.get("access-control-allow-credentials")
        print("GET /api/auth/me status", r.status_code, "ACAO=", aco, "ACAC=", acc)
        assert aco == CROSS_ORIGIN, f"Expected reflected origin, got {aco}"
        assert acc == "true"

    def test_cors_on_post_login(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nobody@example.com", "password": "wrong"},
            headers={"Origin": CROSS_ORIGIN, "Content-Type": "application/json"},
            timeout=15,
        )
        aco = r.headers.get("access-control-allow-origin")
        acc = r.headers.get("access-control-allow-credentials")
        print("POST /api/auth/login status", r.status_code, "ACAO=", aco, "ACAC=", acc)
        assert aco == CROSS_ORIGIN
        assert acc == "true"

    def test_cors_on_post_register(self):
        # Use invalid payload to avoid creating an account; header behavior is what we check.
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={},
            headers={"Origin": CROSS_ORIGIN, "Content-Type": "application/json"},
            timeout=15,
        )
        aco = r.headers.get("access-control-allow-origin")
        acc = r.headers.get("access-control-allow-credentials")
        print("POST /api/auth/register status", r.status_code, "ACAO=", aco, "ACAC=", acc)
        assert aco == CROSS_ORIGIN
        assert acc == "true"


# ---------- CORS: preflight ----------
class TestCORSPreflight:
    def test_preflight_login(self):
        r = requests.options(
            f"{BASE_URL}/api/auth/login",
            headers={
                "Origin": CROSS_ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization",
            },
            timeout=15,
        )
        print("OPTIONS status", r.status_code, "hdrs=", dict(r.headers))
        assert r.status_code in (200, 204)
        assert r.headers.get("access-control-allow-origin") == CROSS_ORIGIN
        assert r.headers.get("access-control-allow-credentials") == "true"


# ---------- Regression: registration + first-login MFA setup ----------
@pytest.fixture(scope="module")
def new_user():
    email = f"corstest_{uuid.uuid4().hex[:10]}@example.com"
    password = "TestPass123!"
    name = "CORS Test User"
    return {"email": email, "password": password, "name": name}


class TestAuthRegression:
    def test_register_new_user(self, new_user):
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=new_user,
            headers={"Origin": CROSS_ORIGIN},
            timeout=20,
        )
        print("register:", r.status_code, r.text[:300])
        assert r.status_code == 200, r.text

    def test_first_login_triggers_mfa_setup_and_verify(self, new_user):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": new_user["email"], "password": new_user["password"]},
            headers={"Origin": CROSS_ORIGIN},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        print("first login:", data)
        assert data.get("mfa_setup_required") is True
        secret = data.get("secret")
        mfa_token = data.get("mfa_token")
        assert secret and mfa_token, f"Missing secret/mfa_token: {data}"
        new_user["secret"] = secret

        code = pyotp.TOTP(secret).now()
        v = requests.post(
            f"{BASE_URL}/api/auth/mfa/verify",
            json={"mfa_token": mfa_token, "code": code},
            headers={"Origin": CROSS_ORIGIN}, timeout=20,
        )
        assert v.status_code == 200, f"mfa/verify failed: {v.status_code} {v.text}"
        vd = v.json()
        assert "access_token" in vd
        assert "user" in vd
        new_user["access_token"] = vd["access_token"]

    def test_admin_login_and_mfa(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Origin": CROSS_ORIGIN}, timeout=20,
        )
        assert r.status_code == 200, r.text
        rd = r.json()
        mfa_token = rd.get("mfa_token")
        assert mfa_token, f"No mfa_token in admin login: {rd}"
        code = pyotp.TOTP(ADMIN_TOTP_SECRET).now()
        v = requests.post(
            f"{BASE_URL}/api/auth/mfa/verify",
            json={"mfa_token": mfa_token, "code": code},
            headers={"Origin": CROSS_ORIGIN}, timeout=20,
        )
        assert v.status_code == 200, v.text
        assert "access_token" in v.json()

    def test_auth_me_with_new_user_token(self, new_user):
        token = new_user.get("access_token")
        assert token, "no token from previous test"
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}", "Origin": CROSS_ORIGIN},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        u = data.get("user", data)
        assert u.get("email") == new_user["email"]
