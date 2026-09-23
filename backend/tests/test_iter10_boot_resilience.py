"""Iteration 10 - Boot resilience + auth regression after ms_graph lazy Fernet + startup try/except hardening."""
import os
import subprocess
import sys
import uuid
import pyotp
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@claracampaigns.com"
ADMIN_PW = "Admin123!"
ADMIN_TOTP = "UPC5QPTQXSSHNMXXCMSUNFBDBFPBSTEQ"


# --- Backend health ---
def test_backend_up_me_returns_401():
    r = requests.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"


# --- Boot resilience via subprocess (does NOT touch running server env) ---
def test_import_server_without_token_encryption_key():
    code = (
        "import os,sys;"
        "sys.path.insert(0,'/app/backend');"
        "from dotenv import load_dotenv; load_dotenv('/app/backend/.env');"
        "os.environ.pop('TOKEN_ENCRYPTION_KEY', None);"
        "import server;"
        "print('OK_IMPORT')"
    )
    proc = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True, text=True, timeout=60,
        cwd="/app/backend",
    )
    assert "OK_IMPORT" in proc.stdout, f"import failed. stdout={proc.stdout}\nstderr={proc.stderr}"


# --- Code review assertions ---
def test_startup_wraps_index_and_seed_in_try_except():
    src = open("/app/backend/server.py").read()
    # locate startup function block
    idx = src.find("async def startup(")
    assert idx != -1
    block = src[idx: idx + 2500]
    assert "create_index" in block
    assert "_seed_admin" in block
    # both should be preceded by try:
    assert block.count("try:") >= 2, "startup() should wrap index + seed in try/except"
    assert "except Exception" in block


def test_msgraph_uses_lazy_fernet():
    src = open("/app/backend/ms_graph.py").read()
    assert "_get_fernet" in src
    # ensure no module-level Fernet(os.environ[...])
    for line in src.splitlines():
        stripped = line.strip()
        if stripped.startswith("fernet") and "Fernet(" in stripped and "os.environ" in stripped:
            pytest.fail(f"module-level Fernet found: {line}")


# --- Auth regression ---
@pytest.fixture(scope="module")
def fresh_user():
    email = f"bootfix_{uuid.uuid4().hex[:10]}@example.com"
    pw = "TestPass123!"
    name = "Boot Fix Tester"
    return {"email": email, "password": pw, "name": name}


def test_register_returns_ok(fresh_user):
    r = requests.post(f"{API}/auth/register", json=fresh_user, timeout=20)
    assert r.status_code == 200, f"{r.status_code}: {r.text}"
    data = r.json()
    assert data.get("ok") is True


def test_first_login_mfa_setup_and_verify(fresh_user):
    r = requests.post(f"{API}/auth/login", json={
        "email": fresh_user["email"], "password": fresh_user["password"]
    }, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("mfa_setup_required") is True
    assert data.get("mfa_token")
    assert data.get("secret")
    code = pyotp.TOTP(data["secret"]).now()
    v = requests.post(f"{API}/auth/mfa/verify", json={
        "mfa_token": data["mfa_token"], "code": code
    }, timeout=20)
    assert v.status_code == 200, v.text
    vd = v.json()
    assert vd.get("access_token")
    assert vd.get("user", {}).get("email") == fresh_user["email"]

    # GET /me
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {vd['access_token']}"}, timeout=15)
    assert me.status_code == 200, me.text
    body = me.json()
    email = body.get("email") or body.get("user", {}).get("email")
    assert email == fresh_user["email"]


def test_admin_login_mfa():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("mfa_required") or data.get("mfa_setup_required")
    mfa_token = data.get("mfa_token")
    assert mfa_token
    code = pyotp.TOTP(ADMIN_TOTP).now()
    v = requests.post(f"{API}/auth/mfa/verify", json={"mfa_token": mfa_token, "code": code}, timeout=20)
    assert v.status_code == 200, v.text
    assert v.json().get("access_token")


# --- CORS credentialed regression ---
def test_cors_reflects_origin_with_credentials():
    origin = "https://campaigns.koodh.com"
    # Preflight
    pre = requests.options(
        f"{API}/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=15,
    )
    acao = pre.headers.get("access-control-allow-origin", "")
    acac = pre.headers.get("access-control-allow-credentials", "")
    assert acao == origin, f"expected reflected origin, got '{acao}'"
    assert acac.lower() == "true", f"expected credentials true, got '{acac}'"

    # Actual POST
    r = requests.post(
        f"{API}/auth/login",
        json={"email": "nouser@example.com", "password": "x"},
        headers={"Origin": origin},
        timeout=15,
    )
    acao2 = r.headers.get("access-control-allow-origin", "")
    assert acao2 == origin, f"expected reflected origin on POST, got '{acao2}'"
