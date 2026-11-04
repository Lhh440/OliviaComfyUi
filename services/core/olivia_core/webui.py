"""发行模式：Core 同源服务构建产物（ADR-0004 的 __OLIVIA_BOOT__ 注入路径）。

令牌只写进同源 HTML——能读到它的客户端，本就已处在「可读 core.json」的同一
信任边界内；API 侧的 Origin / Sec-Fetch-Site / 令牌校验不因此放松。
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

_BOOT_MARK = "<head>"


def _inject_boot(html: str, token: str | None) -> str:
    payload = json.dumps({"token": token}, ensure_ascii=False)
    boot = f"<script>window.__OLIVIA_BOOT__ = {payload};</script>"
    if _BOOT_MARK in html:
        return html.replace(_BOOT_MARK, _BOOT_MARK + boot, 1)
    return boot + html  # 兜底：非标准模板也能拿到令牌


def mount_webui(app, dist: Path, token: str) -> None:
    """把构建产物挂到 /：静态资源直出，页面路径回落 index.html 并注入令牌。"""
    index_path = dist / "index.html"
    if not index_path.is_file():
        raise RuntimeError(f"前端构建产物缺失：{index_path}")

    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def index(_: Request) -> HTMLResponse:
        html = index_path.read_text(encoding="utf-8")
        return HTMLResponse(_inject_boot(html, token))

    @app.get("/{page:path}", include_in_schema=False)
    def spa_fallback(page: str, _: Request) -> HTMLResponse:
        # 前端无路由（页面是状态切换），回落只为容错；/api/* 由 auth 先行拦截。
        # 带扩展名的路径是静态资源请求，缺失就该 404，不能拿 HTML 冒充（会掩盖坏资源）
        if page.startswith("api/") or "." in page.rsplit("/", 1)[-1]:
            raise HTTPException(404, "Not Found")
        html = index_path.read_text(encoding="utf-8")
        return HTMLResponse(_inject_boot(html, token))
