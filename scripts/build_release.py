"""构建发行包（ADR-0009：无签名期间手动分发 + 公布 SHA256）。

用法（仓库根）：
    python scripts/build_release.py

产物（dist-release/）：
    OliviaComfyUI-<版本>-windows-x64.zip   绿色包：Core 源码 + 前端构建产物 + 引导脚本
    SHA256SUMS.txt                          发布时随 Release 附件一起公布

要求本机有 pnpm（构建前端）与 Python 3.12+。
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

README_TXT = """Olivia ComfyUI 启动器（alpha · 绿色版）
=====================================

这是什么
  一个本地运行的 ComfyUI 启动器：注册已有 ComfyUI 目录、一键启动/停止、
  实时硬件看板、队列透传、资产目录管理。全部数据只在本机（127.0.0.1）流转。

运行要求
  - Windows 10 1809+ / Windows 11，x64
  - Python 3.12 或更高（首次运行自动创建虚拟环境并联网安装依赖）
  - NVIDIA 显卡需驱动 522+ 才有 GPU 指标；无 N 卡时相关项显示「不可用」

怎么运行
  1. 解压本压缩包到任意目录
  2. 双击 Olivia.bat，等浏览器自动打开 http://127.0.0.1:<端口>
  3. 首次进入「实例」页，注册你机器上已有的 ComfyUI 目录
     （目录需包含 main.py，Python 解释器建议填该 ComfyUI venv 内的 python.exe）

安全校验（重要）
  本版本未做代码签名，Windows SmartScreen 可能拦截：
  更多信息 → 仍要运行。运行前请核对压缩包的 SHA256 是否与
  Release 页公布值一致：
      certutil -hashfile OliviaComfyUI-<版本>-windows-x64.zip SHA256

常见问题
  - 启动失败提示缺 Python：安装 3.12+ 后重新运行 Olivia.bat
  - 依赖安装慢/失败：脚本会自动改用清华镜像重试
  - 界面提示「本地服务未连接」：引导窗口被关闭了，重新运行 Olivia.bat
  - 端口被占：Core 会自动从 8600 起向后找空闲端口，无需手动处理

开源协议 GPL-3.0 · 非 ComfyUI 官方产品
项目主页与更新：见发布页（GitHub Releases）
"""


def read_version() -> str:
    init = ROOT / "services" / "core" / "olivia_core" / "__init__.py"
    for line in init.read_text(encoding="utf-8").splitlines():
        if line.startswith("__version__"):
            return line.split("=", 1)[1].strip().strip("'\"")
    raise SystemExit("services/core/olivia_core/__init__.py 里读不到 __version__")


def build_web() -> Path:
    web = ROOT / "apps" / "web"
    print("[1/4] 构建前端（pnpm build）...")
    # Windows 上 pnpm 的可执行形态是 .cmd；which('pnpm') 会先命中 nodejs 目录里
    # 给 bash 用的无扩展名 shim（CreateProcess 报 WinError 193），所以显式找 .cmd
    pnpm = shutil.which("pnpm.cmd") or shutil.which("pnpm")
    if not pnpm:
        raise SystemExit("找不到 pnpm，构建前端需要它")
    subprocess.run([pnpm, "build"], cwd=web, check=True, capture_output=True, text=True)
    dist = web / "dist"
    if not (dist / "index.html").is_file():
        raise SystemExit("前端构建产物缺失（apps/web/dist/index.html）")
    # 发行包绝不许带构建机的 dev 令牌（vite define 在 build 下应为 null）
    for js in dist.rglob("*.js"):
        if "__OLIVIA_CORE_TOKEN__" in js.read_text(encoding="utf-8", errors="ignore"):
            raise SystemExit(f"构建产物泄漏 dev 令牌标记：{js.name}")
    return dist


def stage_tree(version: str, dist: Path) -> Path:
    print("[2/4] 组装目录...")
    stage = ROOT / "dist-release" / f"OliviaComfyUI-{version}"
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    shutil.copytree(
        ROOT / "services" / "core" / "olivia_core",
        stage / "server" / "olivia_core",
        ignore=shutil.ignore_patterns("__pycache__"),
    )
    shutil.copy(ROOT / "services" / "core" / "requirements.txt", stage / "server" / "requirements.txt")
    shutil.copytree(dist, stage / "web")
    shutil.copy(ROOT / "scripts" / "release" / "Olivia.bat", stage / "Olivia.bat")
    shutil.copy(ROOT / "LICENSE", stage / "LICENSE")
    # 文件名用 ASCII：非 ASCII zip 条目在部分解压工具下会乱码；内容 UTF-8 BOM 兼容老记事本
    (stage / "README-FIRST.txt").write_text(
        README_TXT.replace("<版本>", version), encoding="utf-8-sig"
    )
    # bat 必须 CRLF + 无 BOM；内容全 ASCII（cmd 在 chcp 65001 下会把多字节行错位拆开）
    bat = stage / "Olivia.bat"
    bat.write_bytes(bat.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
    return stage


def make_zip(stage: Path) -> tuple[Path, str]:
    print("[3/4] 打压缩包...")
    out = stage.parent / f"{stage.name}-windows-x64.zip"
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for f in sorted(stage.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(stage.parent))
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    sums = stage.parent / "SHA256SUMS.txt"
    sums.write_text(f"{digest}  {out.name}\n", encoding="utf-8")
    return out, digest


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-web-build", action="store_true", help="复用现有 apps/web/dist")
    args = ap.parse_args()

    version = read_version()
    print(f"版本 {version}")

    if args.skip_web_build:
        dist = ROOT / "apps" / "web" / "dist"
        if not (dist / "index.html").is_file():
            raise SystemExit("--skip-web-build 但 apps/web/dist 不存在，先跑一次完整构建")
        print("[1/4] 跳过前端构建")
    else:
        dist = build_web()

    stage = stage_tree(version, dist)
    out, digest = make_zip(stage)
    print(f"[4/4] 完成：{out}")
    print(f"      SHA256: {digest}")
    print(f"      摘要文件: {stage.parent / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
