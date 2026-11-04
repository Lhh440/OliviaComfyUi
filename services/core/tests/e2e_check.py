"""M1.1a 端到端验收（PLAN-M1.1 §2 的 2/3/6 条），纯 stdlib，可进 CI。

用法：services/core/.venv/Scripts/python.exe tests/e2e_check.py
自建临时数据根、拉起真实 Core、注册 tests/fake_comfyui 并走完整启停链路，
全部通过打印 PASS 并清理；任一步失败打印 FAIL 并以非零码退出。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

CORE_PORT = 8677
ROOT = Path(__file__).resolve().parents[1]
FAKE_COMFYUI = ROOT / "tests" / "fake_comfyui"

failures: list[str] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    mark = "PASS" if cond else "FAIL"
    print(f"  [{mark}] {name}" + (f" · {detail}" if detail and not cond else ""))
    if not cond:
        failures.append(name)


def req(
    method: str,
    path: str,
    token: str | None = None,
    origin: str | None = None,
    body: dict | None = None,
    timeout: float = 5,
) -> tuple[int, dict | list | None]:
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if origin:
        headers["Origin"] = origin
    data = json.dumps(body).encode() if body is not None else None
    if data:
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(f"http://127.0.0.1:{CORE_PORT}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=5) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw) if raw else None
        except ValueError:
            return e.code, None


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="olivia-e2e-") as tmp:
        data_root = Path(tmp) / "data"
        env = {
            **os.environ,
            "OLIVIA_DATA_ROOT": str(data_root),
            "OLIVIA_CORE_PORT": str(CORE_PORT),
        }
        venv_py = ROOT / ".venv" / "Scripts" / "python.exe"
        py = str(venv_py) if venv_py.exists() else sys.executable
        core_proc = subprocess.Popen(
            [py, "-m", "olivia_core"],
            cwd=str(ROOT),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        try:
            run_checks(core_proc, data_root)
        finally:
            core_proc.terminate()
            try:
                core_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                core_proc.kill()

    print()
    if failures:
        print(f"E2E 验收：{len(failures)} 项失败 → {'、'.join(failures)}")
        return 1
    print("E2E 验收：全部通过")
    return 0


def run_checks(core_proc: subprocess.Popen, data_root: Path) -> None:
    # 1) 健康检查免鉴权
    for _ in range(50):
        try:
            status, body = req("GET", "/api/health")
            if status == 200 and body == {"ok": True}:
                break
        except OSError:
            pass
        time.sleep(0.3)
    else:
        check("Core 启动并响应 /api/health", False, "5s 内未就绪")
        return
    check("Core 启动并响应 /api/health", True)

    core_json = json.loads((data_root / "core.json").read_text(encoding="utf-8"))
    token = core_json["token"]
    check("core.json 写入端口与令牌", bool(core_json.get("port")) and len(token) >= 32)

    # 2) 鉴权与 Origin 白名单（验收 6）
    status, _ = req("GET", "/api/instance")
    check("无令牌 → 401", status == 401, f"got {status}")
    status, _ = req("GET", "/api/instance", token="wrong-token")
    check("错令牌 → 401", status == 401, f"got {status}")
    status, _ = req("GET", "/api/instance", token=token, origin="http://evil.example.com")
    check("非 localhost Origin → 403", status == 403, f"got {status}")
    status, body = req("GET", "/api/instance", token=token)
    check("正确令牌 → 200 且未注册", status == 200 and body is not None and body["deployed"] is False, f"got {status}")

    # 3) 路径校验（AGENTS.md：resolve 后校验）
    status, body = req("POST", "/api/instance/register", token, body={"path": "relative/path", "python": sys.executable})
    check("相对路径注册 → 400", status == 400, f"got {status}")
    status, body = req("POST", "/api/instance/register", token, body={"path": r"C:\Olivia\不存在", "python": sys.executable})
    check("不存在路径注册 → 400", status == 400, f"got {status}")
    status, _ = req("POST", "/api/instance/register", token, body={"path": str(FAKE_COMFYUI), "python": "definitely-not-a-python-xyz"})
    check("不存在的解释器 → 400", status == 400, f"got {status}")

    # 4) 注册 fake ComfyUI 并启动（验收 2）
    status, body = req(
        "POST",
        "/api/instance/register",
        token,
        body={"path": str(FAKE_COMFYUI), "python": sys.executable},
    )
    check("注册 fake ComfyUI → 200", status == 200, f"got {status} {body}")
    status, body = req("POST", "/api/instance/start", token)
    chosen_port = body.get("port") if isinstance(body, dict) else None
    check("启动实例 → 200 且返回端口", status == 200 and isinstance(chosen_port, int) and chosen_port >= 8188, f"got {status} {body}")
    status, _ = req("POST", "/api/instance/start", token)
    check("重复启动 → 409", status == 409, f"got {status}")

    status, body = req("GET", "/api/instance", token)
    pid = body.get("pid") if isinstance(body, dict) else None
    running_pid = pid
    for _ in range(30):
        status, body = req("GET", "/api/instance", token)
        if body and body["status"] == "running":
            break
        time.sleep(0.5)
    check("健康检查通过 → status=running", bool(body) and body["status"] == "running", f"status={body and body['status']}")
    check("运行中端口与 start 返回一致", bool(body) and body["port"] == chosen_port)

    # 5) 队列透传：实例运行中但队列为空
    status, body = req("GET", "/api/comfy/queue", token)
    check(
        "队列透传 → 空队列",
        status == 200 and body is not None and body["running"] == [] and body["pending"] == [],
        f"got {status} {body}",
    )

    # 6) 日志环形缓冲
    status, body = req("GET", "/api/logs", token)
    text = "\n".join(body["lines"]) if isinstance(body, dict) else ""
    check("日志含启动与健康检查事件", status == 200 and "已启动 PID" in text and "健康检查通过" in text)

    # 7) 运行中不可注销（409），未运行资产/磁盘/自检可用
    status, _ = req("POST", "/api/instance/unregister", token)
    check("运行中注销 → 409", status == 409, f"got {status}")
    status, body = req("GET", "/api/checklist", token)
    check("自检清单返回", status == 200 and isinstance(body, list) and len(body) >= 3)
    status, body = req("GET", "/api/hardware", token)
    check(
        "硬件帧结构完整（字段可空）",
        status == 200 and isinstance(body, dict) and "ts" in body and "gpu" in body and "system" in body,
    )

    # 8) 资产目录设置与列表
    asset_dir = data_root / "assets"
    asset_dir.mkdir()
    (asset_dir / "a.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    (asset_dir / "b.txt").write_text("not an image")
    status, _ = req("POST", "/api/settings/asset-folder", token, body={"path": str(asset_dir)})
    check("设置资产目录 → 200", status == 200, f"got {status}")
    status, body = req("GET", "/api/assets", token)
    names = [a["file"] for a in body] if isinstance(body, list) else []
    check("资产列表只含图片且按 mtime 倒序", status == 200 and names == ["a.png"], f"got {names}")
    status, _ = req("POST", "/api/settings/asset-folder", token, body={"path": r"C:\CON"})
    check("保留名目录 → 400", status == 400, f"got {status}")

    # 9) 停止与无残留（验收 3）：CTRL_BREAK 优雅路径或 taskkill 兜底，服务端最坏 ~3s
    status, _ = req("POST", "/api/instance/stop", token, timeout=15)
    check("停止实例 → 200", status == 200, f"got {status}")
    gone = False
    import psutil

    for _ in range(20):
        if running_pid is None or not psutil.pid_exists(running_pid):
            gone = True
            break
        time.sleep(0.5)
    check("实例进程无残留", gone, f"PID {running_pid} 仍存在")

    status, body = req("GET", "/api/instance", token)
    check("停止后 status=stopped", bool(body) and body["status"] == "stopped", f"status={body and body['status']}")
    status, body = req("GET", "/api/comfy/queue", token)
    check("停止后队列返回空而非错误", status == 200 and isinstance(body, dict) and body["running"] == [])

    # 10) 未运行时可注销；再注册验证覆盖
    status, _ = req("POST", "/api/instance/unregister", token)
    check("停止后注销 → 200", status == 200, f"got {status}")
    status, body = req("GET", "/api/instance", token)
    check("注销后 deployed=false", bool(body) and body["deployed"] is False)

    # 11) Core 被强杀（Windows terminate 即硬杀）时，实例随作业对象回收，不产生孤儿
    status, _ = req(
        "POST",
        "/api/instance/register",
        token,
        body={"path": str(FAKE_COMFYUI), "python": sys.executable},
    )
    check("孤儿测试:重注册 → 200", status == 200, f"got {status}")
    status, _ = req("POST", "/api/instance/start", token)
    check("孤儿测试:启动 → 200", status == 200, f"got {status}")
    pid2 = None
    for _ in range(30):
        status, body = req("GET", "/api/instance", token)
        if body and body["status"] == "running":
            pid2 = body["pid"]
            break
        time.sleep(0.5)
    check("孤儿测试:实例运行中", pid2 is not None)
    import psutil

    core_proc.terminate()  # Windows = TerminateProcess，硬杀，lifespan 不会执行
    orphan_gone = False
    for _ in range(20):
        if pid2 is None or not psutil.pid_exists(pid2):
            orphan_gone = True
            break
        time.sleep(0.5)
    check("孤儿测试:Core 硬杀后实例被回收", orphan_gone, f"PID {pid2} 仍存活")


if __name__ == "__main__":
    sys.exit(main())
