"""校验 prototype/index.html 中四套主题的 WCAG 对比度（DESIGN §1.3）。

直接从原型的 THEMES 表提取色值，避免另维护一份令牌副本导致漂移。
阈值与 docs/DESIGN.md §1.3 一致；任何 FAIL 使脚本退出码为 1。
用法：python scripts/ci/check_contrast.py（仓库根目录下执行）
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROTOTYPE = ROOT / "prototype" / "index.html"

# DESIGN §1.3 + §1.5：前景/背景对与最低比值
CHECKS: list[tuple[str, str, float]] = [
    ("ink", "bg1", 7.0),
    ("ink2", "bg1", 4.5),
    ("muted", "bg1", 3.0),
    ("accent", "bg0", 3.0),
    ("ok", "bg1", 3.0),
    ("warn", "bg1", 3.0),
    ("danger", "bg1", 3.0),
    ("info", "bg1", 3.0),
    ("onAccent", "accent2", 4.5),  # 主按钮常态底
    ("bg1", "accent", 4.5),        # ::selection 文字
]

TOKENS = {token for check in CHECKS for token in check[:2]}
THEME_KEY_RE = re.compile(r"^  (\w+): \{$", re.M)
HEX_RE = re.compile(r"(\w+):'(#[0-9A-Fa-f]{6})'")


def luminance(hex_color: str) -> float:
    r, g, b = (int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    lin = [
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        for c in (r, g, b)
    ]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(fg: str, bg: str) -> float:
    lf, lb = luminance(fg), luminance(bg)
    lighter, darker = max(lf, lb), min(lf, lb)
    return (lighter + 0.05) / (darker + 0.05)


def parse_themes() -> dict[str, dict[str, str]]:
    text = PROTOTYPE.read_text(encoding="utf-8")
    start = text.find("const THEMES = {")
    if start < 0:
        raise SystemExit(f"未在 {PROTOTYPE} 找到 THEMES 定义")
    body = text[start:]
    end = body.find("\n};")
    body = body[:end]

    keys = list(THEME_KEY_RE.finditer(body))
    themes: dict[str, dict[str, str]] = {}
    for i, m in enumerate(keys):
        stop = keys[i + 1].start() if i + 1 < len(keys) else len(body)
        tokens = {k: v for k, v in HEX_RE.findall(body[m.end() : stop]) if k in TOKENS}
        missing = TOKENS - tokens.keys()
        if missing:
            raise SystemExit(f"主题 {m.group(1)} 缺少令牌：{sorted(missing)}")
        themes[m.group(1)] = tokens
    return themes


def main() -> int:
    themes = parse_themes()
    failures: list[str] = []

    for name, tokens in themes.items():
        print(f"\n[{name}]")
        for fg, bg, minimum in CHECKS:
            value = ratio(tokens[fg], tokens[bg])
            mark = "PASS" if value >= minimum else "FAIL"
            if mark == "FAIL":
                failures.append(f"{name}: {fg}/{bg} = {value:.2f}:1 < {minimum}:1")
            print(f"  {fg:>9} / {bg:<8} {value:6.2f}:1  (≥{minimum})  {mark}")

    print(f"\n共 {len(themes)} 套主题 × {len(CHECKS)} 项检查")
    if failures:
        print("\n不达标：")
        for f in failures:
            print(f"  {f}")
        return 1

    print("全部达标")
    return 0


if __name__ == "__main__":
    sys.exit(main())
