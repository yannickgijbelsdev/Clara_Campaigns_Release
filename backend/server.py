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
import secrets
import asyncio
from datetime import datetime, timezone
from bson import ObjectId

from db import db, client
import auth as A
import ms_graph as MS
from models import (
    RegisterInput, LoginInput, MfaVerifyInput, ContactInput,
    CampaignInput, SendInput, now_iso,
)

app = FastAPI(title="Clara Campaigns API")
api = APIRouter(prefix="/api")

# 1x1 transparent GIF
PIXEL = bytes.fromhex("47494638396101000100800000ffffff00000021f90401000000002c00000000010001000002024401003b")


def oid(v):
    return ObjectId(v)


def clean(doc):
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    doc.pop("totp_secret", None)
    return doc


# ============ AUTH ============
@api.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    secret = A.make_totp_secret()
    doc = {
        "email": email,
        "name": data.name,
        "password_hash": A.hash_password(data.password),
        "totp_secret": secret,
        "mfa_enabled": False,
        "role": "user",
        "created_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    return {"ok": True, "user_id": str(res.inserted_id), "email": email}


async def _issue_session(user, response: Response):
    token = A.create_access_token(str(user["_id"]), user["email"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return {"access_token": token, "user": clean(dict(user))}


@api.post("/auth/login")
async def login(data: LoginInput, request: Request):
    email = data.email.lower()
    ident = f"{request.client.host}:{email}"
    la = await db.login_attempts.find_one({"_id": ident})
    if la and la.get("count", 0) >= 5 and time.time() - la.get("last", 0) < 900:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    user = await db.users.find_one({"email": email})
    if not user or not A.verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"_id": ident},
            {"$inc": {"count": 1}, "$set": {"last": time.time()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"_id": ident})
    uid = str(user["_id"])
    if not user.get("mfa_enabled"):
        mfa_token = A.create_mfa_token(uid, setup=True)
        uri = A.totp_uri(user["totp_secret"], user["email"])
        return {
            "mfa_setup_required": True,
            "mfa_token": mfa_token,
            "otpauth_url": uri,
            "secret": user["totp_secret"],
            "qr": A.qr_data_url(uri),
        }
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
    if not A.verify_totp(user["totp_secret"], data.code):
        raise HTTPException(status_code=401, detail="Invalid authentication code")
    if payload.get("setup") and not user.get("mfa_enabled"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"mfa_enabled": True}})
        user["mfa_enabled"] = True
    return await _issue_session(user, response)


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(A.get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(A.get_current_user)):
    return {"user": user}


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
        "_id": state, "user_id": user["id"], "flow": flow, "created_at": datetime.now(timezone.utc),
    })
    return {"configured": True, "authorization_url": flow["auth_uri"]}


@api.get("/oauth/microsoft/callback")
async def ms_callback(code: str = Query(None), state: str = Query(None), error: str = Query(None)):
    frontend = os.environ["FRONTEND_URL"]
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
    return {
        "configured": True,
        "connected": bool(token),
        "email": row.get("email") if row else None,
        "needs_reauth": bool(row) and not token,
    }


@api.delete("/mailbox")
async def mailbox_disconnect(user=Depends(A.get_current_user)):
    await db.mailboxes.delete_one({"user_id": user["id"]})
    return {"ok": True}


# ============ CONTACTS ============
@api.get("/contacts")
async def list_contacts(user=Depends(A.get_current_user)):
    rows = await db.contacts.find({"user_id": user["id"]}).sort("created_at", -1).to_list(5000)
    return [clean(r) for r in rows]


@api.post("/contacts")
async def create_contact(data: ContactInput, user=Depends(A.get_current_user)):
    email = data.email.lower()
    existing = await db.contacts.find_one({"user_id": user["id"], "email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Contact already exists")
    doc = {**data.model_dump(), "email": email, "user_id": user["id"], "created_at": now_iso()}
    res = await db.contacts.insert_one(doc)
    doc["_id"] = res.inserted_id
    return clean(doc)


@api.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user=Depends(A.get_current_user)):
    await db.contacts.delete_one({"_id": oid(contact_id), "user_id": user["id"]})
    return {"ok": True}


@api.post("/contacts/import")
async def import_contacts(file: UploadFile = File(...), user=Depends(A.get_current_user)):
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
        if await db.contacts.find_one({"user_id": user["id"], "email": email}):
            skipped += 1
            continue
        tags_raw = find_key(row, "tags", "tag") or ""
        doc = {
            "user_id": user["id"],
            "email": email,
            "first_name": (find_key(row, "first_name", "firstname", "first name", "voornaam") or "").strip(),
            "last_name": (find_key(row, "last_name", "lastname", "last name", "achternaam") or "").strip(),
            "company": (find_key(row, "company", "bedrijf", "organization") or "").strip(),
            "tags": [t.strip() for t in tags_raw.split(",") if t.strip()],
            "created_at": now_iso(),
        }
        await db.contacts.insert_one(doc)
        imported += 1
    return {"imported": imported, "skipped": skipped}


# ============ CAMPAIGNS ============
@api.get("/campaigns")
async def list_campaigns(user=Depends(A.get_current_user)):
    rows = await db.campaigns.find({"user_id": user["id"]}).sort("updated_at", -1).to_list(1000)
    out = []
    for r in rows:
        cid = str(r["_id"])
        sent = await db.deliveries.count_documents({"campaign_id": cid})
        opened = await db.deliveries.count_documents({"campaign_id": cid, "opened": True})
        clicked = await db.deliveries.count_documents({"campaign_id": cid, "clicked": True})
        c = clean(r)
        c["stats"] = {"sent": sent, "opened": opened, "clicked": clicked}
        out.append(c)
    return out


@api.post("/campaigns")
async def create_campaign(data: CampaignInput, user=Depends(A.get_current_user)):
    doc = {
        **data.model_dump(),
        "user_id": user["id"],
        "status": "draft",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    res = await db.campaigns.insert_one(doc)
    doc["_id"] = res.inserted_id
    return clean(doc)


@api.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, user=Depends(A.get_current_user)):
    r = await db.campaigns.find_one({"_id": oid(campaign_id), "user_id": user["id"]})
    if not r:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return clean(r)


@api.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, data: CampaignInput, user=Depends(A.get_current_user)):
    r = await db.campaigns.find_one({"_id": oid(campaign_id), "user_id": user["id"]})
    if not r:
        raise HTTPException(status_code=404, detail="Campaign not found")
    upd = {**data.model_dump(), "updated_at": now_iso()}
    await db.campaigns.update_one({"_id": r["_id"]}, {"$set": upd})
    r = await db.campaigns.find_one({"_id": r["_id"]})
    return clean(r)


@api.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, user=Depends(A.get_current_user)):
    await db.campaigns.delete_one({"_id": oid(campaign_id), "user_id": user["id"]})
    await db.deliveries.delete_many({"campaign_id": campaign_id})
    return {"ok": True}


async def _run_send(campaign, contacts, user_id, real, token, sender):
    backend = os.environ["BACKEND_URL"]
    cid = str(campaign["_id"])
    for ct in contacts:
        track_id = uuid.uuid4().hex
        delivery = {
            "track_id": track_id,
            "campaign_id": cid,
            "user_id": user_id,
            "contact_id": str(ct["_id"]),
            "email": ct["email"],
            "name": (f"{ct.get('first_name','')} {ct.get('last_name','')}").strip() or ct["email"],
            "opened": False,
            "clicked": False,
            "open_count": 0,
            "click_count": 0,
            "clicked_links": [],
            "status": "sending",
            "simulated": not real,
            "created_at": now_iso(),
        }
        await db.deliveries.insert_one(delivery)
        html = MS.personalize_html(campaign.get("html", ""), track_id, backend)
        try:
            if real:
                await MS.send_mail(token, sender, campaign.get("subject", ""), html, ct["email"], delivery["name"])
                await asyncio.sleep(1.0)
            await db.deliveries.update_one({"track_id": track_id}, {"$set": {"status": "sent", "sent_at": now_iso()}})
        except Exception as exc:
            await db.deliveries.update_one({"track_id": track_id}, {"$set": {"status": "failed", "error": str(exc)}})
    await db.campaigns.update_one({"_id": campaign["_id"]}, {"$set": {"status": "sent", "sent_at": now_iso()}})


@api.post("/campaigns/{campaign_id}/send")
async def send_campaign(campaign_id: str, data: SendInput, user=Depends(A.get_current_user)):
    campaign = await db.campaigns.find_one({"_id": oid(campaign_id), "user_id": user["id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.get("html"):
        raise HTTPException(status_code=400, detail="Campaign has no content yet")

    q = {"user_id": user["id"]}
    if data.contact_ids:
        q["_id"] = {"$in": [oid(c) for c in data.contact_ids]}
    contacts = await db.contacts.find(q).to_list(10000)
    if not contacts:
        raise HTTPException(status_code=400, detail="No recipients selected")

    token = await MS.get_access_token(user["id"])
    real = bool(token)
    row = await db.mailboxes.find_one({"user_id": user["id"]})
    sender = row.get("email") if row else user["email"]

    # clear previous deliveries for a fresh send
    await db.deliveries.delete_many({"campaign_id": campaign_id})
    await db.campaigns.update_one({"_id": campaign["_id"]}, {"$set": {"status": "sending"}})

    asyncio.create_task(_run_send(campaign, contacts, user["id"], real, token, sender))
    return {"ok": True, "recipients": len(contacts), "mode": "office365" if real else "simulation"}


@api.get("/campaigns/{campaign_id}/stats")
async def campaign_stats(campaign_id: str, user=Depends(A.get_current_user)):
    campaign = await db.campaigns.find_one({"_id": oid(campaign_id), "user_id": user["id"]})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    deliveries = await db.deliveries.find({"campaign_id": campaign_id}).to_list(10000)
    sent = len([d for d in deliveries if d.get("status") == "sent"])
    opened = len([d for d in deliveries if d.get("opened")])
    clicked = len([d for d in deliveries if d.get("clicked")])
    failed = len([d for d in deliveries if d.get("status") == "failed"])

    link_counts = {}
    recipients = []
    for d in deliveries:
        for l in d.get("clicked_links", []):
            link_counts[l] = link_counts.get(l, 0) + 1
        recipients.append({
            "name": d.get("name"),
            "email": d.get("email"),
            "status": d.get("status"),
            "opened": d.get("opened"),
            "open_count": d.get("open_count", 0),
            "clicked": d.get("clicked"),
            "click_count": d.get("click_count", 0),
            "last_open": d.get("last_open"),
            "last_click": d.get("last_click"),
        })
    top_links = sorted(
        [{"url": k, "clicks": v} for k, v in link_counts.items()],
        key=lambda x: x["clicks"], reverse=True,
    )
    return {
        "campaign": {"id": campaign_id, "name": campaign.get("name"), "subject": campaign.get("subject"),
                     "status": campaign.get("status"), "simulated": any(d.get("simulated") for d in deliveries)},
        "totals": {
            "sent": sent, "opened": opened, "clicked": clicked, "failed": failed,
            "open_rate": round(opened / sent * 100, 1) if sent else 0,
            "click_rate": round(clicked / sent * 100, 1) if sent else 0,
        },
        "top_links": top_links,
        "recipients": recipients,
    }


# ============ TRACKING ============
@api.get("/track/open/{track_id}")
async def track_open(track_id: str):
    d = await db.deliveries.find_one({"track_id": track_id})
    if d:
        await db.deliveries.update_one(
            {"track_id": track_id},
            {"$set": {"opened": True, "last_open": now_iso()}, "$inc": {"open_count": 1}},
        )
    return FastResponse(content=PIXEL, media_type="image/gif",
                        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})


@api.get("/track/click/{track_id}")
async def track_click(track_id: str, u: str = Query("")):
    d = await db.deliveries.find_one({"track_id": track_id})
    if d:
        await db.deliveries.update_one(
            {"track_id": track_id},
            {"$set": {"clicked": True, "opened": True, "last_click": now_iso()},
             "$inc": {"click_count": 1}, "$addToSet": {"clicked_links": u}},
        )
    target = u or (os.environ["FRONTEND_URL"])
    return RedirectResponse(target)


# ============ DASHBOARD ============
@api.get("/dashboard")
async def dashboard(user=Depends(A.get_current_user)):
    uid = user["id"]
    total_campaigns = await db.campaigns.count_documents({"user_id": uid})
    total_contacts = await db.contacts.count_documents({"user_id": uid})
    deliveries = await db.deliveries.find({"user_id": uid}).to_list(20000)
    sent = len([d for d in deliveries if d.get("status") == "sent"])
    opened = len([d for d in deliveries if d.get("opened")])
    clicked = len([d for d in deliveries if d.get("clicked")])
    recent = await db.campaigns.find({"user_id": uid}).sort("updated_at", -1).to_list(5)
    recent_out = []
    for r in recent:
        cid = str(r["_id"])
        recent_out.append({
            "id": cid, "name": r.get("name"), "status": r.get("status"),
            "subject": r.get("subject"), "updated_at": r.get("updated_at"),
            "sent": await db.deliveries.count_documents({"campaign_id": cid, "status": "sent"}),
            "opened": await db.deliveries.count_documents({"campaign_id": cid, "opened": True}),
            "clicked": await db.deliveries.count_documents({"campaign_id": cid, "clicked": True}),
        })
    return {
        "total_campaigns": total_campaigns,
        "total_contacts": total_contacts,
        "total_sent": sent,
        "total_opened": opened,
        "total_clicked": clicked,
        "open_rate": round(opened / sent * 100, 1) if sent else 0,
        "click_rate": round(clicked / sent * 100, 1) if sent else 0,
        "recent_campaigns": recent_out,
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clara")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.contacts.create_index([("user_id", 1), ("email", 1)])
    await db.deliveries.create_index("track_id", unique=True)
    await db.deliveries.create_index([("campaign_id", 1)])
    await db.oauth_states.create_index("created_at", expireAfterSeconds=600)
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@claracampaigns.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email, "name": "Admin",
            "password_hash": A.hash_password(admin_pw),
            "totp_secret": A.make_totp_secret(),
            "mfa_enabled": False, "role": "admin", "created_at": now_iso(),
        })
    logger.info("Clara Campaigns backend started")


@app.on_event("shutdown")
async def shutdown():
    client.close()
