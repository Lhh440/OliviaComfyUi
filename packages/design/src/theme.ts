// 设计令牌唯一来源（DESIGN §1/§2）。
// scripts/ci/check_contrast.py 直读本文件的字面量做 WCAG 校验——改色值不需要改脚本，
// 但任何改动必须让该脚本通过，且同步 DESIGN.md §1.5 的修订记录。

export type ThemeKey = "graphite" | "amber" | "porcelain" | "cyan";

export interface ThemeTokens {
  bg0: string;
  bg1: string;
  bg2: string;
  line: string;
  ink: string;
  ink2: string;
  muted: string;
  accent: string;
  accent2: string;
  ok: string;
  warn: string;
  danger: string;
  info: string;
  plate: string;
  plateLine: string;
  onAccent: string;
}

export interface ThemeMeta {
  label: string;
  note: string;
  sw: string;
  t: ThemeTokens;
}

export const THEMES: Record<ThemeKey, ThemeMeta> = {
  graphite: {
    label: "石墨靛",
    note: "暗色 · 推荐",
    sw: "#7C8CFF",
    t: {
      bg0: "#0B0C10", bg1: "#13151B", bg2: "#1B1E27", line: "#262A35",
      ink: "#E8EAF0", ink2: "#A2A8B8", muted: "#7C8398",
      accent: "#7C8CFF", accent2: "#4F6BED",
      ok: "#3FBF8F", warn: "#E0A94A", danger: "#E2574C", info: "#5FD3C4",
      plate: "#1B1E27", plateLine: "rgba(255,255,255,.06)", onAccent: "#FFFFFF",
    },
  },
  amber: {
    label: "暗房琥珀",
    note: "暖暗 · 创作感",
    sw: "#E8A33D",
    t: {
      bg0: "#121110", bg1: "#1A1815", bg2: "#241F1A", line: "#332C25",
      ink: "#F2EDE4", ink2: "#B5AA99", muted: "#8B7F6E",
      accent: "#E8A33D", accent2: "#C9861F",
      ok: "#7FB069", warn: "#E8C063", danger: "#D9614C", info: "#C97B5A",
      plate: "#241F1A", plateLine: "rgba(255,255,255,.07)", onAccent: "#1A1815",
    },
  },
  porcelain: {
    label: "瓷白朱砂",
    note: "亮色 · 编辑感",
    sw: "#D93A2B",
    t: {
      bg0: "#F7F7F5", bg1: "#FFFFFF", bg2: "#EFEFEC", line: "#E0E1DD",
      ink: "#17181A", ink2: "#55585E", muted: "#85888F",
      accent: "#D93A2B", accent2: "#B32A1D",
      ok: "#1F8A5F", warn: "#A9741A", danger: "#C8352A", info: "#3A6EA5",
      plate: "#EDEDEA", plateLine: "rgba(0,0,0,.07)", onAccent: "#FFFFFF",
    },
  },
  cyan: {
    label: "深青仪表",
    note: "冷暗 · 硬件感",
    sw: "#35C4D7",
    t: {
      bg0: "#0A1416", bg1: "#102024", bg2: "#163036", line: "#1F4048",
      ink: "#E2F1F2", ink2: "#96B4B8", muted: "#6B8F94",
      accent: "#35C4D7", accent2: "#1A93A6",
      ok: "#4FD18B", warn: "#E3B04B", danger: "#E2604F", info: "#A9E4EF",
      plate: "#163036", plateLine: "rgba(255,255,255,.07)", onAccent: "#0A1416",
    },
  },
};

export const THEME_ORDER: ThemeKey[] = ["graphite", "amber", "porcelain", "cyan"];

export const CSS_VAR_MAP: Record<keyof ThemeTokens, string> = {
  bg0: "--bg0",
  bg1: "--bg1",
  bg2: "--bg2",
  line: "--line",
  ink: "--ink",
  ink2: "--ink2",
  muted: "--muted",
  accent: "--accent",
  accent2: "--accent2",
  ok: "--ok",
  warn: "--warn",
  danger: "--danger",
  info: "--info",
  plate: "--plate",
  plateLine: "--plate-line",
  onAccent: "--on-accent",
};

// 四档线宽是唯一的装饰语言（DESIGN §2.3 / AGENTS.md），自绘图形禁止使用档位之外的值
export const LINE_WIDTHS = [0.38, 1.12, 2.28, 3.8] as const;
