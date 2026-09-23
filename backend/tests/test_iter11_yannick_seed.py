"""Iteration 11: verify yannick admin seed works (login + seed resilience without env vars)."""
import os
import subprocess
import sys
import pytest
import pyotp
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://inbox-pro-64.preview.emergentagent.com"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

YANNICK_EMAIL = "yannick.gijbels@koodh.com"
YANNICK_PW = "KYLovie13monx"
OLD_PW = "Koodh2026!"


@pytest.fixture(scope="module")
def mongo_db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


def test_login_yannick_returns_mfa_required(mongo_db):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": YANNICK_EMAIL, "password": YANNICK_PW}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    # On preview yannick already has mfa_enabled=true → mfa_required
    assert data.get("mfa_required") is True or data.get("mfa_setup_required") is True, f"unexpected: {data}"
    assert "mfa_token" in data
    mfa_token = data["mfa_token"]

    user = mongo_db.users.find_one({"email": YANNICK_EMAIL})
    assert user is not None
    assert user.get("role") == "admin"
    lic = user.get("license") or {}
    assert lic.get("active") is True
    secret = user["totp_secret"]
    code = pyotp.TOTP(secret).now()

    r2 = requests.post(f"{BASE_URL}/api/auth/mfa/verify",
                       json={"mfa_token": mfa_token, "code": code}, timeout=30)
    assert r2.status_code == 200, f"mfa verify failed: {r2.status_code} {r2.text}"
    d2 = r2.json()
    assert "access_token" in d2
    assert d2["user"]["role"] == "admin"
    assert d2["user"]["email"] == YANNICK_EMAIL

    # Regression: admin list access
    token = d2["access_token"]
    r3 = requests.get(f"{BASE_URL}/api/admin/users",
                      headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r3.status_code == 200, f"admin/users failed: {r3.status_code} {r3.text}"
    users = r3.json()
    assert isinstance(users, list)
    assert any(u.get("email") == YANNICK_EMAIL for u in users)


def test_old_password_rejected():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": YANNICK_EMAIL, "password": OLD_PW}, timeout=30)
    assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"


def test_startup_only_seeds_yannick():
    with open("/app/backend/server.py") as f:
        src = f.read()
    # Find startup function region
    idx = src.find("async def startup()")
    assert idx >= 0
    startup_src = src[idx: idx + 2000]
    # Only yannick seeded, no admin@claracampaigns.com _seed_admin call
    assert "_seed_admin(" in startup_src
    assert startup_src.count("_seed_admin(") == 1
    assert "admin@claracampaigns.com" not in startup_src


def test_seed_resilience_without_env_vars(mongo_db):
    """Subprocess: pop env vars, import server, run _seed_admin — must still create/update yannick."""
    script = r"""
import os, asyncio
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
os.environ.pop("ADMIN2_EMAIL", None)
os.environ.pop("ADMIN2_PASSWORD", None)
assert "ADMIN2_EMAIL" not in os.environ
assert "ADMIN2_PASSWORD" not in os.environ
import sys
sys.path.insert(0, "/app/backend")
import server
async def main():
    await server._seed_admin("ADMIN2_EMAIL", "ADMIN2_PASSWORD", "yannick.gijbels@koodh.com", "KYLovie13monx")
    u = await server.db.users.find_one({"email": "yannick.gijbels@koodh.com"})
    assert u is not None, "yannick not seeded"
    assert u.get("role") == "admin"
    print("OK_SEED_RESILIENT")
asyncio.run(main())
"""
    result = subprocess.run([sys.executable, "-c", script],
                            capture_output=True, text=True, timeout=60, cwd="/app/backend")
    assert "OK_SEED_RESILIENT" in result.stdout, f"stdout={result.stdout}\nstderr={result.stderr}"

    # Verify from main mongo connection too
    u = mongo_db.users.find_one({"email": YANNICK_EMAIL})
    assert u is not None
    assert u.get("role") == "admin"
