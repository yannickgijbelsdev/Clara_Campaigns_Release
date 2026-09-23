from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.responses import RedirectResponse, Response as FastResponse
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from starlette.middleware.cors import CORSMiddleware
import logging
import io
import csv
import time
import uuid
import html as html_lib
import secrets
import asyncio
import re
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from db import db, client
import auth as A
import ms_graph as MS
from models import (
    RegisterInput, LoginInput, MfaVerifyInput, ContactInput,
    CampaignInput, SendInput, ScheduleInput, CompanyInput,
    ForgotInput, ResetInput, MfaCodeInput, PasswordChangeInput,
    BrandingInput, AdminCompaniesInput, CategoryInput,
    SubscribeSettingsInput, PublicSubscribeInput, PlanRequestInput, now_iso,
    AdminUserUpdateInput, CompanyUpdateInput,
)
import email_util
import storage

app = FastAPI(title="Clara Campaigns API")
api = APIRouter(prefix="/api")

PIXEL = bytes.fromhex("47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b")


def oid(v):
    return ObjectId(v)


def clean(doc):
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    doc.pop("totp_secret", None)
    doc.pop("backup_codes", None)
    doc.pop("mfa_pending_secret", None)
    return doc


def require_admin(user):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")


# plan -> (max sends, window days). enterprise/None = unlimited
PLAN_LIMITS = {"free": (5, 7), "pro": (30, 30)}


async def send_quota(user):
    """Return quota usage for the user's plan."""
    full = await db.users.find_one({"_id": oid(user["id"])})
    lic = full.get("license", {}) if full else {}
    plan = lic.get("plan", "free")
    active = bool(lic.get("active")) or user.get("role") == "admin"
    if user.get("role") == "admin" or plan not in PLAN_LIMITS:
        return {"plan": "enterprise" if user.get("role") == "admin" else plan,
                "active": active, "unlimited": True, "used": 0, "limit": None,
                "remaining": None, "window_days": None}
    limit, days = PLAN_LIMITS[plan]
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    used = await db.send_events.count_documents({"user_id": user["id"], "ts": {"$gte": since}})
    return {"plan": plan, "active": active, "unlimited": False, "used": used,
            "limit": limit, "remaining": max(0, limit - used), "window_days": days}


async def _can_access_company(user, company):
    if not company:
        return False
    if user["role"] == "admin":
        return True
    return company.get("owner_id") == user["id"] or user["id"] in (company.get("member_ids") or [])


async def scope(request: Request, user=Depends(A.get_current_user)):
    """Resolve the active company (workspace) for the request."""
    cid = request.headers.get("x-company-id")
    company = None
    if cid and ObjectId.is_valid(cid):
        company = await db.companies.find_one({"_id": ObjectId(cid)})
        if not await _can_access_company(user, company):
            company = None
    if not company:
        company = await db.companies.find_one({"owner_id": user["id"]})
    if not company:
        company = await db.companies.find_one({"member_ids": user["id"]})
    if not company:
        res = await db.companies.insert_one({
            "name": f"{user.get('name','My')} Workspace", "owner_id": user["id"], "created_at": now_iso(),
        })
        company = await db.companies.find_one({"_id": res.inserted_id})
    return {"user": user, "company_id": str(company["_id"]), "company": company}


# ============ AUTH ============
@api.post("/auth/register")
async def register(data: RegisterInput):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    secret = A.make_totp_secret()
    doc = {
        "email": email, "name": data.name,
        "password_hash": A.hash_password(data.password),
        "totp_secret": secret, "mfa_enabled": False, "role": "user",
        "license": {"plan": "free", "active": False},
        "created_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    await db.companies.insert_one({
        "name": f"{data.name}'s Workspace", "owner_id": str(res.inserted_id), "created_at": now_iso(),
    })
    return {"ok": True, "user_id": str(res.inserted_id), "email": email}


async def _issue_session(user, response: Response):
    token = A.create_access_token(str(user["_id"]), user["email"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return {"access_token": token, "user": clean(dict(user))}


@api.post("/auth/login")
async def login(data: LoginInput, request: Request):
    email = data.email.lower()
    client_ip = request.headers.get("x-forwarded-for", request.client.host or "").split(",")[0].strip()
    ident = f"{client_ip}:{email}" if client_ip else email
    la = await db.login_attempts.find_one({"_id": ident})
    if la and la.get("count", 0) >= 5 and time.time() - la.get("last", 0) < 900:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    user = await db.users.find_one({"email": email})
    if not user or not A.verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"_id": ident}, {"$inc": {"count": 1}, "$set": {"last": time.time()}}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"_id": ident})
    uid = str(user["_id"])
    if not user.get("mfa_enabled"):
        mfa_token = A.create_mfa_token(uid, setup=True)
        uri = A.totp_uri(user["totp_secret"], user["email"])
        return {"mfa_setup_required": True, "mfa_token": mfa_token,
                "otpauth_url": uri, "secret": user["totp_secret"], "qr": A.qr_data_url(uri)}
    return {"mfa_required": True, "mfa_token": A.create_mfa_token(uid, setup=False)}


@api.post("/auth/mfa/verify")
async def mfa_verify(data: MfaVerifyInput, response: Response):
    try:
        payload = A.decode_token(data.mfa_token)
    except Exception:
        raise HTTPException(status_code=401, detail="MFA session expired. Please log in again.")
    if payload.get("type") != "mfa":
        raise HTTPException(status_code=401, detail="Invalid MFA token")
    user = await db.users.find_one({"_id": oid(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    code = data.code.strip()
    verified = A.verify_totp(user["totp_secret"], code)
    if not verified:
        # Fall back to one-time backup codes
        for i, bc in enumerate(user.get("backup_codes", [])):
            if not bc.get("used") and A.verify_password(code, bc["hash"]):
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {f"backup_codes.{i}.used": True, f"backup_codes.{i}.used_at": now_iso()}})
                verified = True
                break
    if not verified:
        raise HTTPException(status_code=401, detail="Invalid authentication code")
    if payload.get("setup") and not user.get("mfa_enabled"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"mfa_enabled": True}})
        user["mfa_enabled"] = True
    return await _issue_session(user, response)


# ============ ACCOUNT: password, avatar, MFA management ============
@api.put("/auth/password")
async def change_password(data: PasswordChangeInput, user=Depends(A.get_current_user)):
    full = await db.users.find_one({"_id": oid(user["id"])})
    if not A.verify_password(data.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is incorrect.")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current one.")
    await db.users.update_one({"_id": full["_id"]},
                              {"$set": {"password_hash": A.hash_password(data.new_password)}})
    return {"ok": True}


@api.post("/auth/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(A.get_current_user)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB).")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "png").lower()
    path = f"{storage.APP_NAME}/avatars/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = storage.put_object(path, data, file.content_type or "image/png")
    except Exception as exc:
        logger.error(f"avatar upload failed: {exc}")
        raise HTTPException(status_code=502, detail="Upload failed. Please try again.")
    version = int(time.time())
    await db.users.update_one({"_id": oid(user["id"])},
                              {"$set": {"avatar_path": result["path"], "avatar_url": result["url"],
                                        "avatar_type": file.content_type or "image/png",
                                        "avatar_version": version}})
    return {"ok": True, "avatar_version": version, "avatar_url": result["url"]}


@api.get("/avatar/{user_id}")
async def get_avatar(user_id: str):
    try:
        u = await db.users.find_one({"_id": oid(user_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    if not u or not u.get("avatar_path"):
        raise HTTPException(status_code=404, detail="No avatar")
    content, ctype = storage.get_object(u["avatar_path"])
    return FastResponse(content=content, media_type=u.get("avatar_type", ctype),
                        headers={"Cache-Control": "public, max-age=60"})


@api.post("/auth/mfa/backup-codes")
async def regenerate_backup_codes(user=Depends(A.get_current_user)):
    codes = A.generate_backup_codes(10)
    await db.users.update_one({"_id": oid(user["id"])},
                              {"$set": {"backup_codes": A.hash_backup_codes(codes)}})
    return {"codes": codes}


@api.get("/auth/mfa/backup-codes/status")
async def backup_codes_status(user=Depends(A.get_current_user)):
    full = await db.users.find_one({"_id": oid(user["id"])})
    codes = full.get("backup_codes", [])
    remaining = len([c for c in codes if not c.get("used")])
    return {"generated": len(codes) > 0, "remaining": remaining, "total": len(codes)}


@api.post("/auth/mfa/reset/start")
async def mfa_reset_start(user=Depends(A.get_current_user)):
    full = await db.users.find_one({"_id": oid(user["id"])})
    secret = A.make_totp_secret()
    await db.users.update_one({"_id": full["_id"]}, {"$set": {"mfa_pending_secret": secret}})
    uri = A.totp_uri(secret, full["email"])
    return {"secret": secret, "otpauth_url": uri, "qr": A.qr_data_url(uri)}


@api.post("/auth/mfa/reset/confirm")
async def mfa_reset_confirm(data: MfaCodeInput, user=Depends(A.get_current_user)):
    full = await db.users.find_one({"_id": oid(user["id"])})
    pending = full.get("mfa_pending_secret")
    if not pending:
        raise HTTPException(status_code=400, detail="Start MFA setup first.")
    if not A.verify_totp(pending, data.code.strip()):
        raise HTTPException(status_code=400, detail="Invalid authenticator code.")
    codes = A.generate_backup_codes(10)
    await db.users.update_one({"_id": full["_id"]}, {
        "$set": {"totp_secret": pending, "mfa_enabled": True,
                 "backup_codes": A.hash_backup_codes(codes)},
        "$unset": {"mfa_pending_secret": ""}})
    return {"ok": True, "codes": codes}


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(A.get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


async def _create_and_send_reset(user: dict):
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": str(user["_id"]), "expires_at": expires, "used": False})
    reset_url = f"{os.environ['FRONTEND_URL']}/reset-password?token={token}"
    await email_util.send_email(
        to=user["email"], subject="Reset your Clara Campaigns password",
        html=email_util.reset_email_html(user.get("name", "there"), reset_url))


@api.post("/auth/forgot-password")
async def forgot_password(data: ForgotInput):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if user:
        try:
            await _create_and_send_reset(user)
        except Exception as exc:
            logger.error(f"reset email failed: {exc}")
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(data: ResetInput):
    rec = await db.password_reset_tokens.find_one({"token": data.token})
    if not rec or rec.get("used") or rec["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    await db.users.update_one({"_id": oid(rec["user_id"])},
                              {"$set": {"password_hash": A.hash_password(data.password)}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True}})
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(A.get_current_user)):
    full = await db.users.find_one({"_id": oid(user["id"])})
    user["license"] = full.get("license", {"plan": "free", "active": False})
    return {"user": user}


# ============ COMPANIES (workspaces) ============
@api.get("/companies")
async def list_companies(user=Depends(A.get_current_user)):
    if user["role"] == "admin":
        q = {}
    else:
        q = {"$or": [{"owner_id": user["id"]}, {"member_ids": user["id"]}]}
    rows = await db.companies.find(q).sort("created_at", 1).to_list(1000)
    out = []
    for r in rows:
        c = clean(r)
        c["campaigns"] = await db.campaigns.count_documents({"company_id": c["id"]})
        c["contacts"] = await db.contacts.count_documents({"company_id": c["id"]})
        out.append(c)
    return out


@api.post("/companies")
async def create_company(data: CompanyInput, user=Depends(A.get_current_user)):
    doc = {"name": data.name, "owner_id": user["id"], "created_at": now_iso()}
    res = await db.companies.insert_one(doc)
    doc["_id"] = res.inserted_id
    return clean(doc)


@api.delete("/companies/{company_id}")
async def delete_company(company_id: str, user=Depends(A.get_current_user)):
    comp = await db.companies.find_one({"_id": oid(company_id)})
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found")
    if user["role"] != "admin" and comp.get("owner_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.companies.delete_one({"_id": comp["_id"]})
    await db.campaigns.delete_many({"company_id": company_id})
    await db.contacts.delete_many({"company_id": company_id})
    await db.deliveries.delete_many({"company_id": company_id})
    return {"ok": True}


# ============ COMPANY BRANDING ============
def _branding_out(company):
    return {
        "id": str(company["_id"]),
        "name": company.get("name"),
        "brand_primary": company.get("brand_primary") or "#7380b6",
        "brand_accent": company.get("brand_accent") or "#0F172A",
        "website": company.get("website") or "",
        "logo_version": company.get("logo_version"),
        "logo_url": company.get("logo_url"),
        "has_logo": bool(company.get("logo_path")),
    }


@api.get("/company/branding")
async def get_branding(s=Depends(scope)):
    return _branding_out(s["company"])


@api.put("/company/branding")
async def update_branding(data: BrandingInput, s=Depends(scope)):
    upd = {}
    if data.name is not None and data.name.strip():
        upd["name"] = data.name.strip()[:160]
    if data.brand_primary is not None:
        upd["brand_primary"] = data.brand_primary
    if data.brand_accent is not None:
        upd["brand_accent"] = data.brand_accent
    if data.website is not None:
        upd["website"] = data.website.strip()
    if upd:
        await db.companies.update_one({"_id": s["company"]["_id"]}, {"$set": upd})
    await db.users.update_one({"_id": oid(s["user"]["id"])}, {"$set": {"onboarded": True}})
    company = await db.companies.find_one({"_id": s["company"]["_id"]})
    return _branding_out(company)


@api.post("/company/logo")
async def upload_company_logo(file: UploadFile = File(...), s=Depends(scope)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB).")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "png").lower()
    path = f"{storage.APP_NAME}/logos/{s['company_id']}/{uuid.uuid4()}.{ext}"
    try:
        result = storage.put_object(path, data, file.content_type or "image/png")
    except Exception as exc:
        logger.error(f"logo upload failed: {exc}")
        raise HTTPException(status_code=502, detail="Upload failed. Please try again.")
    version = int(time.time())
    await db.companies.update_one({"_id": s["company"]["_id"]},
                                  {"$set": {"logo_path": result["path"], "logo_url": result["url"],
                                            "logo_type": file.content_type or "image/png",
                                            "logo_version": version}})
    return {"ok": True, "logo_version": version, "logo_url": result["url"]}


@api.get("/company/{company_id}/logo")
async def get_company_logo(company_id: str):
    try:
        c = await db.companies.find_one({"_id": oid(company_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")
    if not c or not c.get("logo_path"):
        raise HTTPException(status_code=404, detail="No logo")
    content, ctype = storage.get_object(c["logo_path"])
    return FastResponse(content=content, media_type=c.get("logo_type", ctype),
                        headers={"Cache-Control": "public, max-age=60"})


# ============ CATEGORIES ============
def _category_out(c):
    return {"id": str(c["_id"]), "name": c.get("name"), "description": c.get("description", ""),
            "color": c.get("color", "#7380b6"),
            "contacts": c.get("contacts", 0)}


@api.get("/categories")
async def list_categories(s=Depends(scope)):
    rows = await db.categories.find({"company_id": s["company_id"]}).sort("created_at", 1).to_list(500)
    out = []
    for r in rows:
        c = _category_out(r)
        c["contacts"] = await db.contacts.count_documents({"company_id": s["company_id"], "categories": str(r["_id"])})
        out.append(c)
    return out


@api.post("/categories")
async def create_category(data: CategoryInput, s=Depends(scope)):
    doc = {**data.model_dump(), "company_id": s["company_id"], "created_at": now_iso()}
    res = await db.categories.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _category_out(doc)


@api.put("/categories/{category_id}")
async def update_category(category_id: str, data: CategoryInput, s=Depends(scope)):
    await db.categories.update_one({"_id": oid(category_id), "company_id": s["company_id"]},
                                   {"$set": data.model_dump()})
    c = await db.categories.find_one({"_id": oid(category_id)})
    return _category_out(c)


@api.delete("/categories/{category_id}")
async def delete_category(category_id: str, s=Depends(scope)):
    await db.categories.delete_one({"_id": oid(category_id), "company_id": s["company_id"]})
    await db.contacts.update_many({"company_id": s["company_id"]}, {"$pull": {"categories": category_id}})
    return {"ok": True}


# ============ SUBSCRIBE / PUBLIC API ============
def _form_labels(company):
    return {
        "label_first_name": company.get("label_first_name") or "First name",
        "label_last_name": company.get("label_last_name") or "Last name",
        "label_email": company.get("label_email") or "Email address",
        "label_city": company.get("label_city") or "City / municipality",
        "label_categories": company.get("label_categories") or "What would you like to receive?",
        "submit_text": company.get("submit_text") or "Subscribe",
    }


def _subscribe_out(company):
    api_key = company.get("api_key")
    public_base = os.environ.get("PUBLIC_BASE_URL") or os.environ["BACKEND_URL"]
    public_url = f"{public_base}/subscribe/{api_key}" if api_key else None
    embed = (f'<a href="{public_url}" target="_blank" rel="noopener" '
             f'style="display:inline-block;padding:12px 22px;background:{company.get("brand_primary") or "#7380b6"};'
             f'color:#fff;border-radius:9999px;font-family:sans-serif;text-decoration:none;font-weight:600;">'
             f'Subscribe to our newsletter</a>') if public_url else None
    iframe = f'<iframe src="{public_url}" width="100%" height="640" style="border:0;" title="Subscribe"></iframe>' if public_url else None
    return {
        "api_key": api_key,
        "website": company.get("website") or "",
        "form_title": company.get("form_title") or f"Subscribe to {company.get('name', 'our newsletter')}",
        "form_intro": company.get("form_intro") or "Stay in the loop — sign up to receive our latest news and updates.",
        "form_thankyou": company.get("form_thankyou") or "Thanks for subscribing! Please check your inbox.",
        "collect_city": company.get("collect_city", True),
        "active": company.get("subscribe_active", True),
        "connected": bool(company.get("api_connected")),
        "last_used_at": company.get("api_last_used"),
        "public_url": public_url,
        "embed_snippet": embed,
        "iframe_snippet": iframe,
        **_form_labels(company),
    }


@api.get("/subscribe/settings")
async def get_subscribe_settings(s=Depends(scope)):
    company = s["company"]
    if not company.get("api_key"):
        key = "clr_" + secrets.token_urlsafe(24)
        await db.companies.update_one({"_id": company["_id"]}, {"$set": {"api_key": key}})
        company = await db.companies.find_one({"_id": company["_id"]})
    return _subscribe_out(company)


@api.put("/subscribe/settings")
async def update_subscribe_settings(data: SubscribeSettingsInput, s=Depends(scope)):
    upd = {}
    if data.website is not None:
        upd["website"] = data.website.strip()
    if data.form_title is not None:
        upd["form_title"] = data.form_title
    if data.form_intro is not None:
        upd["form_intro"] = data.form_intro
    if data.form_thankyou is not None:
        upd["form_thankyou"] = data.form_thankyou
    if data.collect_city is not None:
        upd["collect_city"] = data.collect_city
    if data.active is not None:
        upd["subscribe_active"] = data.active
    for f in ("label_first_name", "label_last_name", "label_email", "label_city", "label_categories", "submit_text"):
        v = getattr(data, f)
        if v is not None:
            upd[f] = v
    if upd:
        await db.companies.update_one({"_id": s["company"]["_id"]}, {"$set": upd})
    company = await db.companies.find_one({"_id": s["company"]["_id"]})
    return _subscribe_out(company)


@api.post("/subscribe/regenerate-key")
async def regenerate_api_key(s=Depends(scope)):
    key = "clr_" + secrets.token_urlsafe(24)
    await db.companies.update_one({"_id": s["company"]["_id"]},
                                  {"$set": {"api_key": key}, "$unset": {"api_connected": "", "api_last_used": ""}})
    company = await db.companies.find_one({"_id": s["company"]["_id"]})
    return _subscribe_out(company)


@api.get("/public/form/{api_key}")
async def public_form(api_key: str):
    company = await db.companies.find_one({"api_key": api_key})
    if not company or company.get("subscribe_active") is False:
        raise HTTPException(status_code=404, detail="Form not found")
    # Mark the form as connected the first time a site loads it.
    if not company.get("api_connected"):
        await db.companies.update_one({"_id": company["_id"]},
                                      {"$set": {"api_connected": True, "api_last_used": now_iso()}})
    cats = await db.categories.find({"company_id": str(company["_id"])}).sort("created_at", 1).to_list(500)
    return {
        "company_name": company.get("name"),
        "logo_url": company.get("logo_url"),
        "brand_primary": company.get("brand_primary") or "#7380b6",
        "brand_accent": company.get("brand_accent") or "#0F172A",
        "website": company.get("website") or "",
        "form_title": company.get("form_title") or f"Subscribe to {company.get('name', 'our newsletter')}",
        "form_intro": company.get("form_intro") or "Stay in the loop — sign up to receive our latest news and updates.",
        "form_thankyou": company.get("form_thankyou") or "Thanks for subscribing! Please check your inbox.",
        "collect_city": company.get("collect_city", True),
        "categories": [{"id": str(c["_id"]), "name": c.get("name"), "description": c.get("description", "")} for c in cats],
        **_form_labels(company),
    }


@api.post("/public/subscribe/{api_key}")
async def public_subscribe(api_key: str, data: PublicSubscribeInput):
    company = await db.companies.find_one({"api_key": api_key})
    if not company or company.get("subscribe_active") is False:
        raise HTTPException(status_code=404, detail="Form not found")
    company_id = str(company["_id"])
    email = data.email.lower()
    valid_cats = {str(c["_id"]) for c in await db.categories.find({"company_id": company_id}).to_list(500)}
    cats = [c for c in data.category_ids if c in valid_cats]
    existing = await db.contacts.find_one({"company_id": company_id, "email": email})
    if existing:
        await db.contacts.update_one({"_id": existing["_id"]}, {
            "$set": {"status": "subscribed", "first_name": data.first_name or existing.get("first_name", ""),
                     "last_name": data.last_name or existing.get("last_name", ""),
                     "city": data.city or existing.get("city", "")},
            "$addToSet": {"categories": {"$each": cats}}})
    else:
        await db.contacts.insert_one({
            "company_id": company_id, "email": email, "first_name": data.first_name,
            "last_name": data.last_name, "city": data.city, "company": "", "tags": [],
            "categories": cats, "status": "subscribed", "source": "subscribe_form", "created_at": now_iso()})
    await db.companies.update_one({"_id": company["_id"]},
                                  {"$set": {"api_connected": True, "api_last_used": now_iso()}})
    return {"ok": True, "thankyou": company.get("form_thankyou") or "Thanks for subscribing!"}


PLAN_REQUEST_EMAIL = "clara.global@koodh.com"


def _plan_request_html(user_email, user_name, company_name, current, requested, message):
    from html import escape
    rows = "".join(
        f'<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:150px">{k}</td>'
        f'<td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">{escape(str(v))}</td></tr>'
        for k, v in [("User", user_name or "—"), ("Email", user_email), ("Company", company_name or "—"),
                     ("Current plan", current), ("Requested plan", requested)])
    note = (f'<div style="margin-top:16px;color:#334155;font-size:14px;line-height:1.6">'
            f'<b>Message:</b><br>{escape(message)}</div>') if message else ""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#f1f5f9;padding:32px 0;font-family:Arial,Helvetica,sans-serif"><tr><td align="center">'
        '<table role="presentation" width="520" cellpadding="0" cellspacing="0" '
        'style="background:#ffffff;border-radius:20px;overflow:hidden;max-width:520px">'
        '<tr><td style="padding:28px 40px 4px">'
        f'{email_util.clara_brand_header(on_dark=False)}'
        '<div style="font-size:22px;font-weight:700;color:#0f172a;margin-top:14px">'
        'Plan change request</div></td></tr>'
        f'<tr><td style="padding:12px 40px"><table role="presentation" width="100%">{rows}</table>{note}</td></tr>'
        '<tr><td style="padding:16px 40px 32px;color:#6b7280;font-size:12px">'
        'A customer requested a plan change. For paid plans, contact them to discuss and send a quote.'
        '</td></tr></table></td></tr></table>'
    )


@api.post("/plan/request")
async def request_plan_change(data: PlanRequestInput, s=Depends(scope)):
    user = s["user"]
    full = await db.users.find_one({"_id": oid(user["id"])})
    current = (full.get("license") or {}).get("plan", "free")
    requested = data.plan.lower().strip()
    paid = requested in ("pro", "enterprise")
    company_name = s["company"].get("name")

    # Downgrading to Free is instant — no approval needed.
    if requested == "free":
        lic = {"plan": "free", "active": True, "assigned_by": "self", "assigned_at": now_iso()}
        await db.users.update_one({"_id": oid(user["id"])}, {"$set": {"license": lic}})
        await db.plan_requests.insert_one({
            "user_id": user["id"], "email": full["email"], "company_id": s["company_id"],
            "current_plan": current, "requested_plan": "free", "message": data.message,
            "status": "applied", "created_at": now_iso()})
        return {"ok": True, "paid": False, "plan": "free", "instant": True}

    await db.plan_requests.insert_one({
        "user_id": user["id"], "email": full["email"], "company_id": s["company_id"],
        "current_plan": current, "requested_plan": requested, "message": data.message,
        "status": "pending", "created_at": now_iso()})
    try:
        await email_util.send_email(
            to=PLAN_REQUEST_EMAIL,
            subject=f"Plan change request: {full['email']} → {requested}",
            html=_plan_request_html(full["email"], full.get("name"), company_name, current, requested, data.message))
    except Exception as exc:
        logger.error(f"plan request email failed: {exc}")
    return {"ok": True, "paid": paid, "plan": requested, "instant": False}


# ============ ADMIN: users & licenses ============
@api.get("/admin/users")
async def admin_users(user=Depends(A.get_current_user)):
    require_admin(user)
    rows = await db.users.find({}).sort("created_at", -1).to_list(2000)
    out = []
    for r in rows:
        rid = str(r["_id"])
        member_of = await db.companies.find({"member_ids": rid}).to_list(1000)
        out.append({
            "id": rid, "email": r["email"], "name": r.get("name"),
            "role": r.get("role", "user"), "mfa_enabled": r.get("mfa_enabled", False),
            "license": r.get("license", {"plan": "free", "active": False}),
            "created_at": r.get("created_at"),
            "companies": await db.companies.count_documents({"owner_id": rid}),
            "member_of": [str(c["_id"]) for c in member_of],
        })
    return out


@api.get("/admin/companies")
async def admin_companies(user=Depends(A.get_current_user)):
    require_admin(user)
    rows = await db.companies.find({}).sort("created_at", 1).to_list(2000)
    return [{"id": str(c["_id"]), "name": c.get("name"), "owner_id": c.get("owner_id"),
             "members": len(c.get("member_ids") or [])} for c in rows]


@api.patch("/admin/users/{user_id}/companies")
async def admin_set_companies(user_id: str, data: AdminCompaniesInput, user=Depends(A.get_current_user)):
    require_admin(user)
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    selected = set(data.company_ids)
    all_companies = await db.companies.find({}).to_list(2000)
    for c in all_companies:
        cid = str(c["_id"])
        # never touch companies this user owns
        if c.get("owner_id") == user_id:
            continue
        if cid in selected:
            await db.companies.update_one({"_id": c["_id"]}, {"$addToSet": {"member_ids": user_id}})
        else:
            await db.companies.update_one({"_id": c["_id"]}, {"$pull": {"member_ids": user_id}})
    return {"ok": True, "company_ids": list(selected)}


@api.patch("/admin/users/{user_id}/license")
async def admin_set_license(user_id: str, body: dict, user=Depends(A.get_current_user)):
    require_admin(user)
    plan = body.get("plan", "pro")
    if plan not in ("free", "pro", "enterprise"):
        plan = "pro"
    active = bool(body.get("active", True))
    lic = {"plan": plan, "active": active,
           "assigned_by": user["email"], "assigned_at": now_iso() if active else None}
    r = await db.users.update_one({"_id": oid(user_id)}, {"$set": {"license": lic}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "license": lic}


@api.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, data: AdminUserUpdateInput, user=Depends(A.get_current_user)):
    require_admin(user)
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    upd = {}
    if data.name is not None:
        upd["name"] = data.name.strip()
    if data.email is not None:
        new_email = data.email.lower().strip()
        if new_email != target["email"]:
            clash = await db.users.find_one({"email": new_email, "_id": {"$ne": target["_id"]}})
            if clash:
                raise HTTPException(status_code=400, detail="Another account already uses that email.")
            upd["email"] = new_email
    if data.role is not None:
        role = data.role.strip().lower()
        if role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'.")
        if user_id == user["id"] and role != "admin":
            raise HTTPException(status_code=400, detail="You cannot remove your own admin role.")
        upd["role"] = role
    if upd:
        await db.users.update_one({"_id": target["_id"]}, {"$set": upd})
    return {"ok": True}


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, user=Depends(A.get_current_user)):
    require_admin(user)
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Delete companies this user owns, along with their data.
    owned = await db.companies.find({"owner_id": user_id}).to_list(2000)
    for c in owned:
        cid = str(c["_id"])
        await db.campaigns.delete_many({"company_id": cid})
        await db.contacts.delete_many({"company_id": cid})
        await db.deliveries.delete_many({"company_id": cid})
        await db.companies.delete_one({"_id": c["_id"]})
    # Remove them from any workspaces they were a member of.
    await db.companies.update_many({"member_ids": user_id}, {"$pull": {"member_ids": user_id}})
    await db.mailboxes.delete_many({"user_id": user_id})
    await db.password_reset_tokens.delete_many({"user_id": user_id})
    await db.users.delete_one({"_id": target["_id"]})
    return {"ok": True}


@api.post("/admin/users/{user_id}/send-reset")
async def admin_send_reset(user_id: str, user=Depends(A.get_current_user)):
    require_admin(user)
    target = await db.users.find_one({"_id": oid(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        await _create_and_send_reset(target)
    except Exception as exc:
        logger.error(f"admin reset email failed: {exc}")
        raise HTTPException(status_code=502, detail="Could not send the reset email. Please try again.")
    return {"ok": True, "email": target["email"]}


@api.patch("/admin/companies/{company_id}")
async def admin_update_company(company_id: str, data: CompanyUpdateInput, user=Depends(A.get_current_user)):
    require_admin(user)
    r = await db.companies.update_one({"_id": oid(company_id)}, {"$set": {"name": data.name.strip()}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"ok": True, "name": data.name.strip()}


# ============ OFFICE 365 MAILBOX ============
@api.get("/oauth/microsoft/start")
async def ms_start(user=Depends(A.get_current_user)):
    if not MS.is_configured():
        return {"configured": False}
    state = secrets.token_urlsafe(32)
    flow = MS.build_auth_flow(state)
    if "auth_uri" not in flow:
        raise HTTPException(status_code=500, detail="Could not create Microsoft authorization request")
    await db.oauth_states.insert_one({
        "_id": state, "user_id": user["id"], "flow": flow, "created_at": datetime.now(timezone.utc)})
    return {"configured": True, "authorization_url": flow["auth_uri"]}


@api.get("/oauth/microsoft/callback")
async def ms_callback(code: str = Query(None), state: str = Query(None), error: str = Query(None)):
    frontend = os.environ.get("PUBLIC_BASE_URL") or os.environ["FRONTEND_URL"]
    if error:
        return RedirectResponse(f"{frontend}/integrations?error={error}")
    record = await db.oauth_states.find_one_and_delete({"_id": state})
    if not record:
        return RedirectResponse(f"{frontend}/integrations?error=invalid_state")
    result, cache = MS.redeem_code(record["flow"], code, state)
    if "access_token" not in result:
        return RedirectResponse(f"{frontend}/integrations?error=token_exchange_failed")
    claims = result.get("id_token_claims", {})
    email = claims.get("preferred_username") or claims.get("email") or ""
    await MS.save_cache(record["user_id"], cache, email=email)
    return RedirectResponse(f"{frontend}/integrations?connected=1")


@api.get("/mailbox")
async def mailbox_status(user=Depends(A.get_current_user)):
    if not MS.is_configured():
        return {"configured": False, "connected": False}
    row = await db.mailboxes.find_one({"user_id": user["id"]})
    token = await MS.get_access_token(user["id"]) if row else None
    return {"configured": True, "connected": bool(token),
            "email": row.get("email") if row else None,
            "needs_reauth": bool(row) and not token}


@api.delete("/mailbox")
async def mailbox_disconnect(user=Depends(A.get_current_user)):
    await db.mailboxes.delete_one({"user_id": user["id"]})
    return {"ok": True}


# ============ CONTACTS ============
@api.get("/contacts")
async def list_contacts(s=Depends(scope)):
    rows = await db.contacts.find({"company_id": s["company_id"]}).sort("created_at", -1).to_list(5000)
    return [clean(r) for r in rows]


@api.post("/contacts")
async def create_contact(data: ContactInput, s=Depends(scope)):
    email = data.email.lower()
    if await db.contacts.find_one({"company_id": s["company_id"], "email": email}):
        raise HTTPException(status_code=400, detail="Contact already exists")
    payload = data.model_dump()
    payload["categories"] = payload.pop("category_ids", [])
    doc = {**payload, "email": email, "company_id": s["company_id"],
           "user_id": s["user"]["id"], "status": "subscribed", "source": "manual", "created_at": now_iso()}
    res = await db.contacts.insert_one(doc)
    doc["_id"] = res.inserted_id
    return clean(doc)


@api.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, s=Depends(scope)):
    await db.contacts.delete_one({"_id": oid(contact_id), "company_id": s["company_id"]})
    return {"ok": True}


@api.delete("/contacts")
async def delete_all_contacts(s=Depends(scope)):
    r = await db.contacts.delete_many({"company_id": s["company_id"]})
    return {"deleted": r.deleted_count}


@api.get("/contacts/{contact_id}/history")
async def contact_history(contact_id: str, s=Depends(scope)):
    ds = await db.deliveries.find({"contact_id": contact_id, "company_id": s["company_id"]}).to_list(1000)
    out = []
    for d in ds:
        camp = None
        if d.get("campaign_id"):
            camp = await db.campaigns.find_one({"_id": oid(d["campaign_id"])})
        out.append({
            "campaign": camp.get("name") if camp else "—",
            "subject": camp.get("subject") if camp else "",
            "status": d.get("status"), "opened": d.get("opened"), "clicked": d.get("clicked"),
            "open_count": d.get("open_count", 0), "click_count": d.get("click_count", 0),
            "sent_at": d.get("sent_at") or d.get("created_at"),
        })
    out.sort(key=lambda x: x["sent_at"] or "", reverse=True)
    return out


@api.post("/contacts/import")
async def import_contacts(file: UploadFile = File(...), s=Depends(scope)):
    content = (await file.read()).decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Empty or invalid CSV")

    def find_key(row, *names):
        for k in row:
            if k and k.strip().lower() in names:
                return row[k]
        return ""

    imported, skipped = 0, 0
    for row in reader:
        email = (find_key(row, "email", "e-mail", "email address", "mail") or "").strip().lower()
        if not email or "@" not in email:
            skipped += 1
            continue
        if await db.contacts.find_one({"company_id": s["company_id"], "email": email}):
            skipped += 1
            continue
        tags_raw = find_key(row, "tags", "tag") or ""
        await db.contacts.insert_one({
            "company_id": s["company_id"], "user_id": s["user"]["id"], "email": email,
            "first_name": (find_key(row, "first_name", "firstname", "first name", "voornaam") or "").strip(),
            "last_name": (find_key(row, "last_name", "lastname", "last name", "achternaam") or "").strip(),
            "company": (find_key(row, "company", "bedrijf", "organization") or "").strip(),
            "tags": [t.strip() for t in tags_raw.split(",") if t.strip()],
            "status": "subscribed", "source": "imported", "created_at": now_iso(),
        })
        imported += 1
    return {"imported": imported, "skipped": skipped}


# ============ CAMPAIGNS ============
@api.get("/campaigns")
async def list_campaigns(s=Depends(scope)):
    rows = await db.campaigns.find({"company_id": s["company_id"]}).sort("updated_at", -1).to_list(1000)
    out = []
    for r in rows:
        cid = str(r["_id"])
        c = clean(r)
        c["stats"] = {
            "sent": await db.deliveries.count_documents({"campaign_id": cid}),
            "opened": await db.deliveries.count_documents({"campaign_id": cid, "opened": True}),
            "clicked": await db.deliveries.count_documents({"campaign_id": cid, "clicked": True}),
        }
        out.append(c)
    return out


@api.post("/campaigns")
async def create_campaign(data: CampaignInput, s=Depends(scope)):
    doc = {**data.model_dump(), "company_id": s["company_id"], "user_id": s["user"]["id"],
           "status": "draft", "created_at": now_iso(), "updated_at": now_iso()}
    res = await db.campaigns.insert_one(doc)
    doc["_id"] = res.inserted_id
    return clean(doc)


@api.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, s=Depends(scope)):
    r = await db.campaigns.find_one({"_id": oid(campaign_id), "company_id": s["company_id"]})
    if not r:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return clean(r)


@api.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, data: CampaignInput, s=Depends(scope)):
    r = await db.campaigns.find_one({"_id": oid(campaign_id), "company_id": s["company_id"]})
    if not r:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.campaigns.update_one({"_id": r["_id"]}, {"$set": {**data.model_dump(), "updated_at": now_iso()}})
    return clean(await db.campaigns.find_one({"_id": r["_id"]}))


@api.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, s=Depends(scope)):
    await db.campaigns.delete_one({"_id": oid(campaign_id), "company_id": s["company_id"]})
    await db.deliveries.delete_many({"campaign_id": campaign_id})
    return {"ok": True}


async def _run_send(campaign, contacts, user_id, company_id, real, token, sender, company=None):
    backend = os.environ["BACKEND_URL"]
    public_base = os.environ.get("PUBLIC_BASE_URL") or backend
    cid = str(campaign["_id"])
    # Prepare optional logo attachment for real sends
    attachments = None
    if real and company and company.get("logo_path"):
        try:
            content, ctype = MS_storage_logo(company)
            import base64 as _b64
            ext = "png"
            if "jpeg" in ctype or "jpg" in ctype:
                ext = "jpg"
            attachments = [{"name": f"logo.{ext}", "content_type": ctype,
                            "content_b64": _b64.b64encode(content).decode()}]
        except Exception as exc:
            logger.error(f"logo attachment failed: {exc}")
    for ct in contacts:
        track_id = uuid.uuid4().hex
        delivery = {
            "track_id": track_id, "campaign_id": cid, "company_id": company_id,
            "user_id": user_id, "contact_id": str(ct["_id"]), "email": ct["email"],
            "name": (f"{ct.get('first_name','')} {ct.get('last_name','')}").strip() or ct["email"],
            "opened": False, "clicked": False, "open_count": 0, "click_count": 0,
            "clicked_links": [], "status": "sending", "simulated": not real, "created_at": now_iso(),
        }
        await db.deliveries.insert_one(delivery)
        unsub_url = f"{public_base}/api/unsubscribe/{A.make_unsub_token(company_id, str(ct['_id']))}"
        personalized = _apply_merge_tags(campaign.get("html", ""), ct)
        html = MS.personalize_html(personalized, track_id, public_base, company, public_base, unsub_url)
        try:
            if real:
                await MS.send_mail(token, sender, campaign.get("subject", ""), html, ct["email"], delivery["name"], attachments)
                await asyncio.sleep(1.0)
            await db.deliveries.update_one({"track_id": track_id}, {"$set": {"status": "sent", "sent_at": now_iso()}})
        except Exception as exc:
            await db.deliveries.update_one({"track_id": track_id}, {"$set": {"status": "failed", "error": str(exc)}})
    await db.campaigns.update_one({"_id": campaign["_id"]}, {"$set": {"status": "sent", "sent_at": now_iso()}})


def MS_storage_logo(company):
    return storage.get_object(company["logo_path"])


_MERGE_RE = re.compile(r"\{\{\s*([a-zA-Z_]+)\s*(?:\|([^}]*?))?\s*\}\}")


def _apply_merge_tags(html: str, ct: dict) -> str:
    """Replace {{first_name}}, {{last_name}}, {{email}}, {{name}} with the
    contact's attributes. Supports an optional fallback: {{first_name|there}}
    is used when the value is empty. Values are HTML-escaped."""
    fn = (ct.get("first_name") or "").strip()
    ln = (ct.get("last_name") or "").strip()
    raw = {
        "first_name": fn,
        "last_name": ln,
        "email": ct.get("email", ""),
        "name": (f"{fn} {ln}").strip(),
    }

    def sub(m):
        key = m.group(1).strip().lower()
        if key not in raw:
            return m.group(0)
        val = raw[key]
        if not val and m.group(2) is not None:
            val = m.group(2).strip()
        return html_lib.escape(val)

    return _MERGE_RE.sub(sub, html)


async def _start_send(campaign, company_id, contact_ids, user, category_ids=None):
    q = {"company_id": company_id, "status": {"$ne": "unsubscribed"}}
    if contact_ids:
        q["_id"] = {"$in": [oid(c) for c in contact_ids]}
    elif category_ids:
        q["categories"] = {"$in": category_ids}
    contacts = await db.contacts.find(q).to_list(10000)
    if not contacts:
        return {"error": "No recipients selected"}
    token = await MS.get_access_token(user["id"])
    real = bool(token)
    row = await db.mailboxes.find_one({"user_id": user["id"]})
    sender = (row.get("email") if row else None) or os.environ.get("EMAIL_SENDER") or user["email"]
    company = await db.companies.find_one({"_id": oid(company_id)})
    await db.deliveries.delete_many({"campaign_id": str(campaign["_id"])})
    await db.campaigns.update_one({"_id": campaign["_id"]}, {"$set": {"status": "sending"}})
    await db.send_events.insert_one({"user_id": user["id"], "company_id": company_id,
                                     "campaign_id": str(campaign["_id"]), "ts": now_iso()})
    asyncio.create_task(_run_send(campaign, contacts, user["id"], company_id, real, token, sender, company))
    return {"ok": True, "recipients": len(contacts), "mode": "office365" if real else "simulation"}


@api.post("/campaigns/{campaign_id}/send")
async def send_campaign(campaign_id: str, data: SendInput, s=Depends(scope)):
    user = s["user"]
    full = await db.users.find_one({"_id": oid(user["id"])})
    lic = full.get("license", {})
    if user["role"] != "admin" and not lic.get("active"):
        raise HTTPException(status_code=403, detail="No active license. Please contact your administrator.")

    q_info = await send_quota(user)
    if not q_info["unlimited"] and q_info["remaining"] <= 0:
        raise HTTPException(status_code=403,
            detail=f"Send limit reached: {q_info['plan']} plan allows {q_info['limit']} campaigns per {q_info['window_days']} days. Upgrade your license to send more.")

    campaign = await db.campaigns.find_one({"_id": oid(campaign_id), "company_id": s["company_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.get("html"):
        raise HTTPException(status_code=400, detail="Campaign has no content yet")

    res = await _start_send(campaign, s["company_id"], data.contact_ids, user, data.category_ids)
    if res.get("error"):
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@api.post("/campaigns/{campaign_id}/schedule")
async def schedule_campaign(campaign_id: str, data: ScheduleInput, s=Depends(scope)):
    user = s["user"]
    full = await db.users.find_one({"_id": oid(user["id"])})
    lic = full.get("license", {})
    if user["role"] != "admin" and not lic.get("active"):
        raise HTTPException(status_code=403, detail="No active license. Please contact your administrator.")
    campaign = await db.campaigns.find_one({"_id": oid(campaign_id), "company_id": s["company_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.get("html"):
        raise HTTPException(status_code=400, detail="Campaign has no content yet")
    await db.campaigns.update_one({"_id": campaign["_id"]}, {"$set": {
        "status": "scheduled", "scheduled_at": data.scheduled_at,
        "scheduled_contacts": data.contact_ids, "scheduled_categories": data.category_ids}})
    return {"ok": True, "scheduled_at": data.scheduled_at}


@api.post("/campaigns/{campaign_id}/unschedule")
async def unschedule_campaign(campaign_id: str, s=Depends(scope)):
    await db.campaigns.update_one(
        {"_id": oid(campaign_id), "company_id": s["company_id"]},
        {"$set": {"status": "draft"}, "$unset": {"scheduled_at": "", "scheduled_contacts": ""}})
    return {"ok": True}


@api.get("/quota")
async def get_quota(user=Depends(A.get_current_user)):
    return await send_quota(user)


@api.get("/campaigns/{campaign_id}/stats")
async def campaign_stats(campaign_id: str, s=Depends(scope)):
    campaign = await db.campaigns.find_one({"_id": oid(campaign_id), "company_id": s["company_id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    deliveries = await db.deliveries.find({"campaign_id": campaign_id}).to_list(10000)
    sent = len([d for d in deliveries if d.get("status") == "sent"])
    opened = len([d for d in deliveries if d.get("opened")])
    clicked = len([d for d in deliveries if d.get("clicked")])
    failed = len([d for d in deliveries if d.get("status") == "failed"])
    link_counts, recipients = {}, []
    for d in deliveries:
        for l in d.get("clicked_links", []):
            link_counts[l] = link_counts.get(l, 0) + 1
        recipients.append({
            "name": d.get("name"), "email": d.get("email"), "status": d.get("status"),
            "opened": d.get("opened"), "open_count": d.get("open_count", 0),
            "clicked": d.get("clicked"), "click_count": d.get("click_count", 0),
            "last_open": d.get("last_open"), "last_click": d.get("last_click"),
        })
    top_links = sorted([{"url": k, "clicks": v} for k, v in link_counts.items()],
                       key=lambda x: x["clicks"], reverse=True)
    return {
        "campaign": {"id": campaign_id, "name": campaign.get("name"), "subject": campaign.get("subject"),
                     "status": campaign.get("status"), "simulated": any(d.get("simulated") for d in deliveries)},
        "totals": {"sent": sent, "opened": opened, "clicked": clicked, "failed": failed,
                   "open_rate": round(opened / sent * 100, 1) if sent else 0,
                   "click_rate": round(clicked / sent * 100, 1) if sent else 0},
        "top_links": top_links, "recipients": recipients,
    }


# ============ TRACKING ============
@api.get("/track/open/{track_id}")
async def track_open(track_id: str):
    if await db.deliveries.find_one({"track_id": track_id}):
        await db.deliveries.update_one({"track_id": track_id},
            {"$set": {"opened": True, "last_open": now_iso()}, "$inc": {"open_count": 1}})
    return FastResponse(content=PIXEL, media_type="image/gif",
                        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})


@api.get("/track/click/{track_id}")
async def track_click(track_id: str, u: str = Query("")):
    if await db.deliveries.find_one({"track_id": track_id}):
        await db.deliveries.update_one({"track_id": track_id},
            {"$set": {"clicked": True, "opened": True, "last_click": now_iso()},
             "$inc": {"click_count": 1}, "$addToSet": {"clicked_links": u}})
    return RedirectResponse(u or os.environ["FRONTEND_URL"])


@api.get("/unsubscribe/{token}")
async def unsubscribe(token: str):
    company_id, contact_id = A.verify_unsub_token(token)
    contact = None
    comp = None
    if company_id and contact_id:
        try:
            contact = await db.contacts.find_one({"_id": oid(contact_id), "company_id": company_id})
            comp = await db.companies.find_one({"_id": oid(company_id)})
        except Exception:
            contact = None
    else:
        # Backward compatibility: older emails used the raw delivery track_id
        d = await db.deliveries.find_one({"track_id": token})
        if d:
            contact = await db.contacts.find_one({"_id": oid(d["contact_id"])}) if d.get("contact_id") else None
            comp = await db.companies.find_one({"_id": oid(d["company_id"])}) if d.get("company_id") else None
            await db.deliveries.update_one({"track_id": token},
                {"$set": {"unsubscribed": True, "unsubscribed_at": now_iso()}})

    if not contact:
        page = """<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>Invalid link</title></head>
<body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#F5F6F8;">
<div style="max-width:460px;margin:12vh auto;background:#fff;border-radius:20px;padding:40px 32px;text-align:center;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
<h1 style="font-size:20px;color:#0F172A;margin:0 0 8px;">This unsubscribe link is invalid</h1>
<p style="font-size:14px;color:#64748B;line-height:1.6;margin:0;">The link may be incomplete or expired. Please use the unsubscribe link from a recent email.</p>
</div></body></html>"""
        return FastResponse(content=page, media_type="text/html", status_code=404)

    company_name = (comp.get("name") if comp else None) or "this sender"
    already = contact.get("status") == "unsubscribed"
    if not already:
        await db.contacts.update_one({"_id": contact["_id"]},
            {"$set": {"status": "unsubscribed", "unsubscribed_at": now_iso()}})
    msg = ("You were already unsubscribed." if already
           else f"You've been unsubscribed from {html_lib.escape(company_name)}.")
    page = f"""<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>Unsubscribed</title></head>
<body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#F5F6F8;">
<div style="max-width:460px;margin:12vh auto;background:#fff;border-radius:20px;padding:40px 32px;text-align:center;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
<div style="width:56px;height:56px;border-radius:16px;background:#FEE2E2;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:26px;">✉️</div>
<h1 style="font-size:20px;color:#0F172A;margin:0 0 8px;">You're unsubscribed</h1>
<p style="font-size:14px;color:#64748B;line-height:1.6;margin:0;">{msg}<br/>You will no longer receive these newsletters.</p>
</div></body></html>"""
    return FastResponse(content=page, media_type="text/html")


# ============ DASHBOARD ============
@api.get("/dashboard")
async def dashboard(s=Depends(scope)):
    cid = s["company_id"]
    total_campaigns = await db.campaigns.count_documents({"company_id": cid})
    total_contacts = await db.contacts.count_documents({"company_id": cid, "status": {"$ne": "unsubscribed"}})
    total_unsubscribed = await db.contacts.count_documents({"company_id": cid, "status": "unsubscribed"})
    deliveries = await db.deliveries.find({"company_id": cid}).to_list(20000)
    sent = len([d for d in deliveries if d.get("status") == "sent"])
    opened = len([d for d in deliveries if d.get("opened")])
    clicked = len([d for d in deliveries if d.get("clicked")])
    recent = await db.campaigns.find({"company_id": cid}).sort("updated_at", -1).to_list(5)
    recent_out = []
    for r in recent:
        rc = str(r["_id"])
        recent_out.append({
            "id": rc, "name": r.get("name"), "status": r.get("status"),
            "subject": r.get("subject"), "updated_at": r.get("updated_at"),
            "sent": await db.deliveries.count_documents({"campaign_id": rc, "status": "sent"}),
            "opened": await db.deliveries.count_documents({"campaign_id": rc, "opened": True}),
            "clicked": await db.deliveries.count_documents({"campaign_id": rc, "clicked": True}),
        })
    return {
        "total_campaigns": total_campaigns, "total_contacts": total_contacts,
        "total_unsubscribed": total_unsubscribed,
        "total_sent": sent, "total_opened": opened, "total_clicked": clicked,
        "open_rate": round(opened / sent * 100, 1) if sent else 0,
        "click_rate": round(clicked / sent * 100, 1) if sent else 0,
        "recent_campaigns": recent_out,
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clara")


async def _seed_admin(email_env, pw_env):
    email = os.environ.get(email_env, "").lower()
    pw = os.environ.get(pw_env, "")
    if not email or not pw:
        return
    existing = await db.users.find_one({"email": email})
    if not existing:
        res = await db.users.insert_one({
            "email": email, "name": email.split("@")[0].replace(".", " ").title(),
            "password_hash": A.hash_password(pw), "totp_secret": A.make_totp_secret(),
            "mfa_enabled": False, "role": "admin", "onboarded": True,
            "license": {"plan": "enterprise", "active": True}, "created_at": now_iso(),
        })
        await db.companies.insert_one({"name": "Clara HQ", "owner_id": str(res.inserted_id), "created_at": now_iso()})
    else:
        await db.users.update_one({"email": email}, {"$set": {"role": "admin",
            "password_hash": A.hash_password(pw), "onboarded": True,
            "license": {"plan": "enterprise", "active": True}}})


async def _scheduler_loop():
    while True:
        try:
            now = now_iso()
            due = await db.campaigns.find({"status": "scheduled", "scheduled_at": {"$lte": now}}).to_list(50)
            for camp in due:
                uid = camp.get("user_id")
                owner = await db.users.find_one({"_id": oid(uid)}) if uid else None
                if not owner:
                    await db.campaigns.update_one({"_id": camp["_id"]}, {"$set": {"status": "failed"}})
                    continue
                udict = {"id": str(owner["_id"]), "role": owner.get("role", "user"),
                         "email": owner["email"], "name": owner.get("name")}
                lic = owner.get("license", {})
                if udict["role"] != "admin" and not lic.get("active"):
                    await db.campaigns.update_one({"_id": camp["_id"]}, {"$set": {"status": "failed"}})
                    continue
                q_info = await send_quota(udict)
                if not q_info["unlimited"] and q_info["remaining"] <= 0:
                    await db.campaigns.update_one({"_id": camp["_id"]}, {"$set": {"status": "failed"}})
                    continue
                res = await _start_send(camp, camp.get("company_id"), camp.get("scheduled_contacts"), udict, camp.get("scheduled_categories"))
                if res.get("error"):
                    await db.campaigns.update_one({"_id": camp["_id"]}, {"$set": {"status": "failed"}})
        except Exception as exc:
            logger.error(f"scheduler error: {exc}")
        await asyncio.sleep(30)


@app.on_event("startup")
async def startup():
    try:
        storage.init_storage()
        logger.info("Object storage initialized")
    except Exception as exc:
        logger.error(f"storage init failed: {exc}")
    await db.users.create_index("email", unique=True)
    await db.contacts.create_index([("company_id", 1), ("email", 1)])
    await db.deliveries.create_index("track_id", unique=True)
    await db.deliveries.create_index([("campaign_id", 1)])
    await db.companies.create_index("owner_id")
    await db.companies.create_index("api_key", unique=True, sparse=True)
    await db.categories.create_index([("company_id", 1)])
    await db.password_reset_tokens.create_index("expires_at")
    await db.oauth_states.create_index("created_at", expireAfterSeconds=600)
    await _seed_admin("ADMIN_EMAIL", "ADMIN_PASSWORD")
    await _seed_admin("ADMIN2_EMAIL", "ADMIN2_PASSWORD")
    asyncio.create_task(_scheduler_loop())
    logger.info("Clara Campaigns backend started")


@app.on_event("shutdown")
async def shutdown():
    client.close()
