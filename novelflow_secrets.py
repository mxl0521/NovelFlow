"""Machine-bound secret storage for NovelFlow model keys."""

from __future__ import annotations

import base64
import ctypes
import json
import os
from pathlib import Path
from typing import Any

import keyring


SERVICE = "NovelFlow"
STORE = Path(__file__).with_name("novelflow-secrets.json")


class _Blob(ctypes.Structure):
    _fields_ = [("cbData", ctypes.c_uint32), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]


def _dpapi_transform(value: bytes, decrypt: bool = False) -> bytes:
    if os.name != "nt":
        raise RuntimeError("dpapi_unavailable")
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    source_buffer = (ctypes.c_ubyte * len(value)).from_buffer_copy(value)
    source = _Blob(len(value), source_buffer)
    target = _Blob()
    function = crypt32.CryptUnprotectData if decrypt else crypt32.CryptProtectData
    # CRYPTPROTECT_LOCAL_MACHINE keeps the local desktop service usable even
    # when it was started without an interactive Windows logon session.
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


def get_secret(profile_id: str) -> str:
    try:
        value = keyring.get_password(SERVICE, profile_id)
        if value:
            return value
    except Exception:
        pass
    encoded = _read_store().get(profile_id, "")
    if not encoded:
        return ""
    try:
        return _dpapi_transform(base64.b64decode(encoded), decrypt=True).decode("utf-8")
    except Exception:
        return ""


def set_secret(profile_id: str, value: str) -> str:
    try:
        keyring.set_password(SERVICE, profile_id, value)
        return "Windows 凭据库"
    except Exception:
        encrypted = base64.b64encode(_dpapi_transform(value.encode("utf-8"))).decode("ascii")
        stored = _read_store()
        stored[profile_id] = encrypted
        _write_store(stored)
        return "Windows DPAPI 加密文件"


def delete_secret(profile_id: str) -> None:
    try:
        keyring.delete_password(SERVICE, profile_id)
    except Exception:
        pass
    stored = _read_store()
    if profile_id in stored:
        stored.pop(profile_id, None)
        _write_store(stored)
