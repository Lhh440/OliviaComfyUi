"""数据根与配置持久化。

core.json 供 Tauri 壳与 vite 代理读取（端口+令牌）；
config.json 存实例注册与资产目录。两边都不放敏感数据之外的东西。
"""
from __future__ import annotations

import json
import os
from pathlib import Path

# Windows 保留设备名（PLAN §5）：任何路径段命中即拒绝
RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def data_root() -> Path:
    base = os.environ.get("OLIVIA_DATA_ROOT")
    root = (
        Path(base)
        if base
        else Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "OliviaComfyUI"
    )
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_dir(raw: str) -> Path:
    """AGENTS.md：所有用户路径 resolve 后校验——绝对、存在、是目录、无保留名。"""
    if not raw or not raw.strip():
        raise ValueError("路径不能为空")
    p = Path(raw.strip()).expanduser()
    if not p.is_absolute():
        raise ValueError("必须是绝对路径")
    resolved = p.resolve()
    for part in resolved.parts:
        if part.split(".")[0].upper() in RESERVED_NAMES:
            raise ValueError(f"路径包含 Windows 保留设备名：{part}")
    if not resolved.exists():
        raise ValueError("路径不存在")
    if not resolved.is_dir():
        raise ValueError("必须是目录")
    return resolved


def write_core_json(port: int, token: str) -> None:
    (data_root() / "core.json").write_text(
        json.dumps({"port": port, "token": token}, indent=2), encoding="utf-8"
    )


def _config_path() -> Path:
    return data_root() / "config.json"


def load_config() -> dict:
    f = _config_path()
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
    return {}


def save_config(cfg: dict) -> None:
    _config_path().write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def instance_cfg() -> dict | None:
    inst = load_config().get("instance")
    return inst if isinstance(inst, dict) and inst.get("path") else None


def asset_folder() -> str | None:
    value = load_config().get("asset_folder")
    return value if isinstance(value, str) and value else None


def set_instance(path: str, python: str) -> None:
    cfg = load_config()
    cfg["instance"] = {"path": path, "python": python}
    save_config(cfg)


def clear_instance() -> None:
    cfg = load_config()
    cfg.pop("instance", None)
    save_config(cfg)


def set_asset_folder(path: str | None) -> None:
    cfg = load_config()
    cfg["asset_folder"] = path
    save_config(cfg)
