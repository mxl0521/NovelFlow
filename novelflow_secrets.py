"""Machine-bound or server-bound secret storage for NovelFlow model keys."""

from __future__ import annotations

import base64
import ctypes
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

try:
    import keyring
except Exception:  # pragma: no cover - optional on some hosts
    keyring = None


SERVICE = "NovelFlow"
STORE = Path(__file__).with_name("novelflow-secrets.json")
ENV_SECRET_KEYS = ("NOVELFLOW_SECRET_KEY", "NOVELFLOW_ENCRYPTION_KEY")


class _Blob(ctypes.Structure):
    _fields_ = [("cbData", ctypes.c_uint32), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


def _read_env_secret() -> str:
    for name in ENV_SECRET_KEYS:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return ""


def _normalize_fernet_key(raw: str) -> bytes:
    candidate = raw.strip()
    if not candidate:
        raise ValueError("secret_key_missing")
    try:
        decoded = base64.urlsafe_b64decode(candidate.encode("ascii"))
        if len(decoded) == 32:
            return candidate.encode("ascii")
    except Exception:
        pass
    digest = hashlib.sha256(candidate.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _server_fernet() -> Fernet | None:
    raw = _read_env_secret()
    if not raw:
        return None
    return Fernet(_normalize_fernet_key(raw))


def _dpapi_transform(value: bytes, decrypt: bool = False) -> bytes:
    if os.name != "nt":
        raise RuntimeError("dpapi_unavailable")
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    source_buffer = (ctypes.c_ubyte * len(value)).from_buffer_copy(value)
    source = _Blob(len(value), source_buffer)
    target = _Blob()
    function = crypt32.CryptUnprotectData if decrypt else crypt32.CryptProtectData
    if not function(ctypes.byref(source), None, None, None, None, 0x4, ctypes.byref(target)):
        raise OSError("dpapi_transform_failed")
    try:
        return ctypes.string_at(target.pbData, target.cbData)
    finally:
        kernel32.LocalFree(target.pbData)


def _read_store() -> dict[str, Any]:
    if not STORE.exists():
        return {}
    try:
        value = json.loads(STORE.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_store(value: dict[str, Any]) -> None:
    temporary = STORE.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(STORE)


def _seal_value(value: str) -> str:
    fernet = _server_fernet()
    if fernet is not None:
        token = fernet.encrypt(value.encode("utf-8")).decode("ascii")
        return f"fernet:{token}"
    if os.name == "nt":
        encrypted = base64.b64encode(_dpapi_transform(value.encode("utf-8"))).decode("ascii")
        return f"dpapi:{encrypted}"
    raise RuntimeError("secret_key_missing")


def _open_value(value: str) -> str:
    raw = value.strip()
    if not raw:
        return ""
    if raw.startswith("fernet:"):
        token = raw.removeprefix("fernet:")
        fernet = _server_fernet()
        if fernet is None:
            return ""
        try:
            return fernet.decrypt(token.encode("ascii")).decode("utf-8")
        except InvalidToken:
            return ""
    if raw.startswith("dpapi:"):
        if os.name != "nt":
            return ""
        token = raw.removeprefix("dpapi:")
        try:
            return _dpapi_transform(base64.b64decode(token), decrypt=True).decode("utf-8")
        except Exception:
            return ""
    if os.name == "nt":
        try:
            return _dpapi_transform(base64.b64decode(raw), decrypt=True).decode("utf-8")
        except Exception:
            pass
    fernet = _server_fernet()
    if fernet is not None:
        try:
            return fernet.decrypt(raw.encode("ascii")).decode("utf-8")
        except Exception:
            pass
    return ""


def seal_secret(value: str) -> str:
    """Return an encrypted token suitable for database or file storage."""
    value = value.strip()
    if not value:
        return ""
    return _seal_value(value)


def open_secret(value: str) -> str:
    """Decode an encrypted token created by seal_secret."""
    return _open_value(value)


def get_secret(profile_id: str) -> str:
    try:
        if keyring is not None:
            value = keyring.get_password(SERVICE, profile_id)
            if value:
                return value
    except Exception:
        pass
    encoded = _read_store().get(profile_id, "")
    if not encoded:
        return ""
    return _open_value(str(encoded))


def set_secret(profile_id: str, value: str) -> str:
    try:
        if keyring is not None:
            keyring.set_password(SERVICE, profile_id, value)
            return "Windows 凭据库"
    except Exception:
        pass
    encrypted = _seal_value(value)
    stored = _read_store()
    stored[profile_id] = encrypted
    _write_store(stored)
    if encrypted.startswith("fernet:"):
        return "服务器加密文件"
    return "Windows DPAPI 加密文件"


def delete_secret(profile_id: str) -> None:
    try:
        if keyring is not None:
            keyring.delete_password(SERVICE, profile_id)
    except Exception:
        pass
    stored = _read_store()
    if profile_id in stored:
        stored.pop(profile_id, None)
        _write_store(stored)
