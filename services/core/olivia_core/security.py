"""令牌与来源校验（ADR-0004 安全清单）。

本地服务的威胁模型：局域网内任意网页都能发请求，靠 Origin/Sec-Fetch-Site
校验挡浏览器侧 CSRF 与 DNS 重绑定，靠一次性令牌挡非本启动器拉起的客户端。
/api/health 免鉴权但零信息。
"""
from __future__ import annotations

import secrets
from urllib.parse import urlparse

_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}

# 同源服务模式下浏览器会带 Sec-Fetch-Site；值缺失（旧浏览器/非浏览器客户端）
# 视为未知，交由 Origin 与令牌把关
_OK_SAME_SITE = {"same-origin", "same-site", "none"}


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


def site_allowed(sec_fetch_site: str | None) -> bool:
    return sec_fetch_site is None or sec_fetch_site in _OK_SAME_SITE


def token_ok(supplied: str | None, expected: str) -> bool:
    return secrets.compare_digest(supplied or "", expected)


def bearer_from_headers(headers, query_token: str | None = None) -> str | None:
    auth = headers.get("authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return headers.get("x-olivia-token") or query_token
