"""检查 Markdown 文件内的本地相对链接是否指向真实存在的文件。

只校验仓库内相对路径；http(s)/mailto/纯锚点跳过。
用法：python scripts/ci/check_md_links.py（仓库根目录下执行）
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
# [text](target) 与 ![alt](target)；目标里允许可选的标题
LINK_RE = re.compile(r'!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)')
SKIP_PREFIXES = ("http://", "https://", "mailto:", "#")


def main() -> int:
    broken: list[str] = []
    checked = 0

    for md in sorted(ROOT.rglob("*.md")):
        rel_md = md.relative_to(ROOT).as_posix()
        for lineno, line in enumerate(md.read_text(encoding="utf-8").splitlines(), 1):
            for target in LINK_RE.findall(line):
                if target.startswith(SKIP_PREFIXES):
                    continue
                checked += 1
                path_part = unquote(target.split("#", 1)[0])
                if not path_part:
                    continue  # 纯锚点
                resolved = (md.parent / path_part).resolve()
                if not resolved.exists():
                    broken.append(f"{rel_md}:{lineno}  {target}")

    print(f"内链检查：{checked} 个本地链接")
    if broken:
        print("\n失效链接：")
        for b in broken:
            print(f"  {b}")
        return 1

    print("全部有效")
    return 0


if __name__ == "__main__":
    sys.exit(main())
