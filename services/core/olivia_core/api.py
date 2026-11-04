"""Olivia Core 路由（PLAN-M1.1 §1.1）。

边界契约统一用 camelCase，与前端类型一一对应，避免一层映射代码。
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import urllib.request
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import psutil
from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import config
from .hw import HardwareMonitor
from .proc import InstanceManager
from .security import bearer_from_headers, new_token, origin_allowed, token_ok


class RegisterIn(BaseModel):
    path: str
    python: str


class AssetFolderIn(BaseModel):
    path: str | None = None


def create_app() -> tuple[FastAPI, int]:
    port = int(os.environ.get("OLIVIA_CORE_PORT", "8600"))
    token = new_token()
    config.write_core_json(port, token)

    manager = InstanceManager()
    monitor = HardwareMonitor()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        # Core 正常退出（Ctrl+C / 壳关闭）时把实例一并带走，避免孤儿进程；
        # 硬崩溃场景的孤儿防护需要 Windows Job Object，属 M1.1b 部署引擎
        if manager.running:
            try:
                manager.stop()
            except RuntimeError:
                pass

    app = FastAPI(title="Olivia Core", docs_url=None, redoc_url=None, lifespan=lifespan)
    # CORS 只是浏览器预检的必要条件；真正的门禁是令牌 + Origin 校验
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def auth(request: Request, token_q: str | None = Query(default=None)) -> None:
        if not origin_allowed(request.headers.get("origin")):
            raise HTTPException(403, "Origin 不被允许")
        supplied = bearer_from_headers(request.headers, token_q)
        if not token_ok(supplied, token):
            raise HTTPException(401, "令牌缺失或不正确")

    @app.get("/api/health")
    def health() -> dict:
        # 免鉴权但零信息：只回答"活着"
        return {"ok": True}

    @app.get("/api/instance")
    def get_instance(_=Depends(auth)) -> dict:
        inst = config.instance_cfg()
        snap = manager.snapshot()
        return {
            "deployed": inst is not None,
            "running": snap["running"],
            "status": snap["status"] if inst else None,
            "name": "ComfyUI · 默认实例" if inst else "未注册实例",
            "path": inst["path"] if inst else None,
            "python": inst["python"] if inst else None,
            "port": snap["port"],
            "pid": snap["pid"],
            "exitCode": snap["exitCode"],
            # 版本/torch 识别属 M1.1b 部署引擎；现在没有就不显示
            "version": None,
            "torch": None,
            "cuda": None,
            "diskGb": None,
        }

    @app.post("/api/instance/register")
    def register(req: RegisterIn, _=Depends(auth)) -> dict:
        try:
            path = config.safe_dir(req.path)
        except ValueError as e:
            raise HTTPException(400, str(e))
        if not (path / "main.py").exists():
            raise HTTPException(400, "目录里没有 main.py，不像 ComfyUI")
        python_exe = shutil.which(req.python.strip())
        if not python_exe:
            raise HTTPException(400, f"找不到 Python 解释器：{req.python}")
        config.set_instance(str(path), python_exe)
        return {"ok": True, "path": str(path), "python": python_exe}

    @app.post("/api/instance/unregister")
    def unregister(_=Depends(auth)) -> dict:
        if manager.running:
            raise HTTPException(409, "实例运行中，先停止再移除")
        config.clear_instance()
        return {"ok": True}

    @app.post("/api/instance/start")
    def start(_=Depends(auth)) -> dict:
        inst = config.instance_cfg()
        if not inst:
            raise HTTPException(409, "尚未注册实例")
        try:
            chosen = manager.start(Path(inst["path"]), inst["python"])
        except RuntimeError as e:
            raise HTTPException(409, str(e))
        return {"ok": True, "port": chosen}

    @app.post("/api/instance/stop")
    def stop(_=Depends(auth)) -> dict:
        try:
            manager.stop()
        except RuntimeError as e:
            raise HTTPException(409, str(e))
        return {"ok": True}

    @app.get("/api/checklist")
    def checklist(_=Depends(auth)) -> list[dict]:
        items: list[dict] = []
        py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        items.append({"level": "ok", "text": f"Python {py_ver} · Core 运行中"})
        inst = config.instance_cfg()
        if inst:
            items.append({"level": "ok", "text": f"实例已注册：{inst['path']}"})
        else:
            items.append({"level": "warn", "text": "尚未注册 ComfyUI 实例（见「实例」页）"})
        if monitor.nvml_available:
            items.append({"level": "ok", "text": f"{monitor.gpu_name()} · 驱动 {monitor.driver_version()}"})
        else:
            items.append({"level": "warn", "text": "未检测到 NVIDIA 采集通道，GPU 指标将显示「不可用」"})
        if config.asset_folder():
            items.append({"level": "ok", "text": f"资产目录已指定：{config.asset_folder()}"})
        else:
            items.append({"level": "warn", "text": "未指定资产目录（见「资产」页）"})
        return items

    @app.get("/api/hardware")
    def hardware(_=Depends(auth)) -> dict:
        return monitor.latest

    @app.get("/api/logs")
    def logs(_=Depends(auth)) -> dict:
        return {"lines": manager.logs()}

    @app.get("/api/comfy/queue")
    def comfy_queue(_=Depends(auth)) -> dict:
        # 未运行返回空队列而非错误：前端展示空态而不是红色错误
        if not manager.running or manager.port is None:
            return {"running": [], "pending": [], "done": [], "note": "instance_not_running"}
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{manager.port}/queue", timeout=3
            ) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except (OSError, ValueError) as e:
            raise HTTPException(502, f"实例队列不可达：{e}")
        # ComfyUI /queue 条目是 [number, prompt_id, prompt, ...]；节点级进度要 M1.2 的 /ws
        def to_task(entry: list) -> dict:
            return {
                "workflow": str(entry[1]) if len(entry) > 1 else "未知",
                "node": None,
                "step": None,
                "stepTotal": None,
                "elapsedSec": None,
                "peakVramGb": None,
            }

        return {
            "running": [to_task(e) for e in data.get("queue_running", []) if isinstance(e, list)],
            "pending": [to_task(e) for e in data.get("queue_pending", []) if isinstance(e, list)],
            # done 由 M1.2 的 /history 填充；契约要求字段恒存在，前端才有稳定空态
            "done": [],
            "note": "ok",
        }

    @app.get("/api/assets")
    def assets(_=Depends(auth)) -> list[dict]:
        folder = config.asset_folder()
        if not folder:
            return []
        root = Path(folder)
        out: list[dict] = []
        for f in root.iterdir():
            if not f.is_file() or f.suffix.lower() not in {".png", ".webp", ".jpg", ".jpeg", ".gif"}:
                continue
            st = f.stat()
            out.append(
                {
                    "file": f.name,
                    "sizeMb": round(st.st_size / 1024**2, 2),
                    "mtime": datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds"),
                }
            )
        out.sort(key=lambda x: x["mtime"], reverse=True)
        return out[:200]

    @app.get("/api/disks")
    def disks(_=Depends(auth)) -> list[dict]:
        targets: list[tuple[str, Path]] = [("数据根", config.data_root())]
        folder = config.asset_folder()
        if folder:
            targets.append(("资产目录", Path(folder)))
        inst = config.instance_cfg()
        if inst:
            targets.append(("实例目录", Path(inst["path"])))
        rows: list[dict] = []
        seen: set[str] = set()
        for label, p in targets:
            key = str(p.resolve().anchor or p)
            if key in seen:
                continue
            try:
                usage = psutil.disk_usage(str(p))
            except OSError:
                continue
            seen.add(key)
            rows.append(
                {
                    "label": f"{label}（{p.resolve().anchor}）",
                    "freeGb": round(usage.free / 1024**3, 1),
                    "totalGb": round(usage.total / 1024**3, 1),
                }
            )
        return rows

    @app.get("/api/settings/asset-folder")
    def get_asset_folder(_=Depends(auth)) -> dict:
        return {"path": config.asset_folder()}

    @app.post("/api/settings/asset-folder")
    def set_asset_folder(req: AssetFolderIn, _=Depends(auth)) -> dict:
        if req.path is None:
            config.set_asset_folder(None)
            return {"ok": True, "path": None}
        try:
            path = config.safe_dir(req.path)
        except ValueError as e:
            raise HTTPException(400, str(e))
        config.set_asset_folder(str(path))
        return {"ok": True, "path": str(path)}

    @app.websocket("/api/ws/hardware")
    async def ws_hardware(ws: WebSocket, token_q: str | None = Query(default=None)) -> None:
        if not origin_allowed(ws.headers.get("origin")):
            await ws.close(code=4403)
            return
        if not token_ok(bearer_from_headers(ws.headers, token_q), token):
            await ws.close(code=4401)
            return
        await ws.accept()
        try:
            while True:
                await ws.send_json(monitor.latest)
                await asyncio.sleep(1)
        except Exception:
            pass  # 客户端断开属正常路径

    return app, port
