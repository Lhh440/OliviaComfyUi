import { useEffect, useRef } from "react";
import { LINE_WIDTHS } from "@olivia/design";
import type { ThemeTokens } from "@olivia/design";
import { useTheme } from "../theme";

// 自绘占位插画共用四档线宽与主题色（DESIGN §2.3 / §1.4）
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintMini(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number, th: ThemeTokens): void {
  const rnd = mulberry32(seed);
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H * 0.72;
  ctx.lineCap = "round";
  ctx.strokeStyle = th.muted;
  ctx.lineWidth = LINE_WIDTHS[2];
  ctx.beginPath();
  ctx.moveTo(cx, cy + H * 0.12);
  ctx.quadraticCurveTo(cx + 4, cy - H * 0.1, cx, cy - H * 0.34);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const y = cy + H * 0.06 - t * H * 0.36;
    const dir = i % 2 ? 1 : -1;
    ctx.lineWidth = i % 3 === 0 ? LINE_WIDTHS[1] : LINE_WIDTHS[0];
    ctx.strokeStyle = i % 3 === 0 ? th.muted : th.line;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.quadraticCurveTo(cx + dir * (10 + rnd() * 5), y - 5, cx + dir * (16 + rnd() * 7), y - 1);
    ctx.stroke();
  }
  ctx.fillStyle = th.warn;
  ctx.beginPath();
  ctx.arc(cx + 3, cy - H * 0.3, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function paintAbstract(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number, th: ThemeTokens): void {
  const rnd = mulberry32(seed);
  const bgs = [th.bg2, th.bg1, th.bg0];
  ctx.fillStyle = bgs[Math.floor(rnd() * bgs.length)];
  ctx.fillRect(0, 0, W, H);

  const N = 40;
  const step = W / N;
  const alphas = [0.18, 0.42, 0.7, 1.0];
  const inks = [th.accent, th.info, th.accent2, th.warn];

  for (let c = 0; c < N; c++) {
    const base = 0.35 + 0.65 * Math.sin((c / N) * Math.PI * (1 + rnd() * 0.5) + rnd() * 2);
    const lvl = base < 0.3 ? 0 : base < 0.6 ? 1 : base < 0.85 ? 2 : 3;
    ctx.globalAlpha = alphas[lvl];
    ctx.strokeStyle = inks[Math.floor(rnd() * inks.length)];
    ctx.lineWidth = LINE_WIDTHS[lvl];
    const x = (c + 0.5) * step;
    ctx.beginPath();
    ctx.moveTo(x, H * (0.15 + rnd() * 0.2));
    ctx.lineTo(x, H * (0.7 + rnd() * 0.25));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintFruit(ctx: CanvasRenderingContext2D, th: ThemeTokens): void {
  ctx.clearRect(0, 0, 26, 26);
  ctx.strokeStyle = th.ok;
  ctx.lineWidth = LINE_WIDTHS[1];
  ctx.beginPath();
  ctx.moveTo(13, 24);
  ctx.lineTo(13, 14);
  ctx.stroke();
  ctx.fillStyle = th.warn;
  ctx.beginPath();
  ctx.ellipse(13, 11, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = th.info;
  ctx.lineWidth = LINE_WIDTHS[1];
  ctx.beginPath();
  ctx.moveTo(13, 7);
  ctx.quadraticCurveTo(19, 2, 23, 5);
  ctx.stroke();
}

function usePainter(paint: (ctx: CanvasRenderingContext2D, th: ThemeTokens) => void, w: number, h: number) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const { tokens } = useTheme();
  const paintRef = useRef(paint);
  paintRef.current = paint;
  // 只在主题变化时重绘；paint 闭包经 ref 透传，避免每次渲染触发 effect
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    paintRef.current(ctx, tokens);
  }, [tokens]);
  return <canvas ref={ref} width={w} height={h} />;
}

export function MiniTreeArt({ w, h, seed }: { w: number; h: number; seed: number }) {
  return usePainter((ctx, th) => paintMini(ctx, w, h, seed, th), w, h);
}

export function AbstractThumb({ seed }: { seed: number }) {
  return usePainter((ctx, th) => paintAbstract(ctx, 200, 200, seed, th), 200, 200);
}

// 真实资产只有文件名（无工作流元数据，M1.3 才反向关联）——用文件名哈希
// 生成稳定 seed，同一文件每次渲染的缩略图一致
export function seedFromFile(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 9973;
}

export function FruitIcon() {
  return usePainter(paintFruit, 26, 26);
}
