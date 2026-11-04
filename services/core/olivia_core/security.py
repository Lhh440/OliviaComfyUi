"""令牌与来源校验（ADR-0004 安全清单）。

本地服务的威胁模型：局域网内任意网页都能发请求，靠 Origin 校验挡浏览器侧 CSRF，
靠一次性令牌挡非本启动器拉起的客户端。/api/health 免鉴权但零信息。
"""
from __future__ import annotations

import secrets
from urllib.parse import urlparse

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def new_token() -> str:
    return secrets.token_urlsafe(32)


def origin_allowed(origin: str | None) -> bool:
    # 非浏览器客户端（curl/同源 GET）可无 Origin
    if origin is None:
        return True
    try:
        return (urlparse(origin).hostname or "") in _LOCAL_HOSTS
    except ValueError:
        return False


def token_ok(supplied: str | None, expected: str) -> bool:
    return secrets.compare_digest(supplied or "", expected)


def bearer_from_headers(headers, query_token: str | None = None) -> str | None:
    auth = headers.get("authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return headers.get("x-olivia-token") or query_token
