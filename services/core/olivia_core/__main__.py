"""python -m olivia_core 启动入口。

默认纯 API 模式（dev 用）；发行包用 --serve-web 指向构建产物，
由 Core 同源服务前端并注入 __OLIVIA_BOOT__ 令牌（ADR-0004）。
"""
from __future__ import annotations

import argparse
import sys
import threading
import webbrowser
from pathlib import Path

import uvicorn

from . import __version__
from .api import create_app


def main() -> None:
    parser = argparse.ArgumentParser(prog="olivia_core", description=f"Olivia Core v{__version__}")
    parser.add_argument(
        "--serve-web",
        metavar="DIR",
        help="同源服务前端构建产物（发行模式；目录需含 index.html）",
    )
    parser.add_argument(
        "--open-browser",
        action="store_true",
        help="服务就绪后自动打开浏览器（仅 --serve-web 下有意义）",
    )
    args = parser.parse_args()

    web_dist = Path(args.serve_web).resolve() if args.serve_web else None
    app, port = create_app(web_dist)

    if args.open_browser and web_dist is not None:
        threading.Timer(1.0, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()

    print(f"Olivia Core v{__version__} · http://127.0.0.1:{port}", flush=True)
    try:
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
