import os
import boto3
from botocore.config import Config

APP_NAME = "clara-campaigns"

_S3_ENDPOINT = os.environ.get("S3_ENDPOINT")
_S3_REGION = os.environ.get("S3_REGION", "nbg1")
_S3_BUCKET = os.environ.get("S3_BUCKET")
_S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY")
_S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY")
_S3_PUBLIC_BASE = (os.environ.get("S3_PUBLIC_BASE") or "").rstrip("/")

_client = None


def _s3():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=_S3_ENDPOINT,
            region_name=_S3_REGION,
            aws_access_key_id=_S3_ACCESS_KEY,
            aws_secret_access_key=_S3_SECRET_KEY,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
    return _client


def init_storage(force: bool = False):
    # Lightweight connectivity check at startup.
    _s3().head_bucket(Bucket=_S3_BUCKET)
    return True


def public_url(key: str) -> str:
    base = _S3_PUBLIC_BASE or f"{_S3_ENDPOINT.rstrip('/')}/{_S3_BUCKET}"
    return f"{base}/{key}"


def put_object(key: str, data: bytes, content_type: str) -> dict:
    kwargs = {"Bucket": _S3_BUCKET, "Key": key, "Body": data, "ContentType": content_type}
    try:
        _s3().put_object(ACL="public-read", **kwargs)
    except Exception:
        # Some S3-compatible providers reject per-object ACLs; rely on a public bucket policy.
        _s3().put_object(**kwargs)
    return {"path": key, "url": public_url(key)}


def get_object(key: str):
    obj = _s3().get_object(Bucket=_S3_BUCKET, Key=key)
    return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")
