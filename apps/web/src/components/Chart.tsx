import { useEffect, useRef } from "react";
import { LINE_WIDTHS } from "@olivia/design";
import { useTheme } from "../theme";

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

interface ChartProps {
  values: number[];
  /** 副曲线（info 色，1.12 档）；主曲线恒为 accent（2.28 档）+ 渐变填充 */
  subValues?: number[];
  height?: number;
}

export function Chart({ values, subValues, height }: ChartProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const { tokens } = useTheme();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const d2 = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = Math.round(rect.width * d2);
    canvas.height = Math.round(rect.height * d2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(d2, 0, 0, d2, 0, 0);
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = tokens.line;
    ctx.lineWidth = LINE_WIDTHS[1];
    ctx.beginPath();
    ctx.moveTo(0, H - 0.5);
    ctx.lineTo(W, H - 0.5);
    ctx.stroke();

    const line = (arr: number[], color: string, width: number, fill: boolean) => {
      const n = arr.length;
      if (n < 2) return;
      const path = new Path2D();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * W;
        const y = H - (arr[i] / 100) * (H - 6) - 3;
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
      if (fill) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, hexToRgba(tokens.accent, 0.2));
        g.addColorStop(1, hexToRgba(tokens.accent, 0));
        ctx.fillStyle = g;
        const fp = new Path2D(path);
        fp.lineTo(W, H);
        fp.lineTo(0, H);
        fp.closePath();
        ctx.fill(fp);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.stroke(path);
    };

    if (subValues) line(subValues, tokens.info, LINE_WIDTHS[1], false);
    line(values, tokens.accent, LINE_WIDTHS[2], true);
  }, [values, subValues, tokens]);

  return <canvas ref={ref} className="chart" style={height ? { height } : undefined} />;
}
