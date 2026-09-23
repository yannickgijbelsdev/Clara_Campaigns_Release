from datetime import datetime, timezone
from typing import Annotated, Any, List, Optional
from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, Field, ConfigDict, EmailStr

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        if not doc:
            return None
        return cls(**doc)

    def to_mongo(self):
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data


# ---------- Auth ----------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(min_length=1, max_length=120)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class MfaVerifyInput(BaseModel):
    mfa_token: str
    code: str = Field(min_length=6, max_length=64)


class MfaCodeInput(BaseModel):
    code: str = Field(min_length=6, max_length=64)


class PasswordChangeInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=200)


class ForgotInput(BaseModel):
    email: EmailStr


class ResetInput(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=200)


# ---------- Contacts ----------
class ContactInput(BaseModel):
    email: EmailStr
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    company: Optional[str] = ""
    city: Optional[str] = ""
    tags: List[str] = []
    category_ids: List[str] = []


class CategoryInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = ""
    color: Optional[str] = "#7380b6"


class SubscribeSettingsInput(BaseModel):
    website: Optional[str] = None
    form_title: Optional[str] = None
    form_intro: Optional[str] = None
    form_thankyou: Optional[str] = None
    collect_city: Optional[bool] = None
    active: Optional[bool] = None
    label_first_name: Optional[str] = None
    label_last_name: Optional[str] = None
    label_email: Optional[str] = None
    label_city: Optional[str] = None
    label_categories: Optional[str] = None
    submit_text: Optional[str] = None


class PublicSubscribeInput(BaseModel):
    first_name: str = Field(default="", max_length=120)
    last_name: str = Field(default="", max_length=120)
    email: EmailStr
    city: Optional[str] = ""
    category_ids: List[str] = []


class PlanRequestInput(BaseModel):
    plan: str = Field(max_length=40)
    message: Optional[str] = Field(default="", max_length=2000)


# ---------- Campaigns ----------
class Block(BaseModel):
    id: str
    type: str
    props: dict = {}


class CampaignInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    subject: str = Field(default="", max_length=300)
    preheader: Optional[str] = ""
    blocks: List[Block] = []
    html: str = ""


class CompanyInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class BrandingInput(BaseModel):
    name: Optional[str] = None
    brand_primary: Optional[str] = None
    brand_accent: Optional[str] = None
    website: Optional[str] = None


class AdminCompaniesInput(BaseModel):
    company_ids: List[str] = []


class AdminUserUpdateInput(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[EmailStr] = None
    role: Optional[str] = None


class CompanyUpdateInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class TimezoneInput(BaseModel):
    timezone: str = Field(min_length=1, max_length=64)


class SmtpConfigInput(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=587, ge=1, le=65535)
    security: str = Field(default="starttls", max_length=20)
    username: str = Field(default="", max_length=320)
    password: Optional[str] = Field(default=None, max_length=500)
    from_email: EmailStr
    from_name: str = Field(default="", max_length=160)


class SendInput(BaseModel):
    contact_ids: Optional[List[str]] = None  # None = all contacts
    category_ids: Optional[List[str]] = None


class ScheduleInput(BaseModel):
    scheduled_at: str
    contact_ids: Optional[List[str]] = None
    category_ids: Optional[List[str]] = None
