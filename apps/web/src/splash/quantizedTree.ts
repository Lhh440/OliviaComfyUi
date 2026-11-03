import { LINE_WIDTHS } from "@olivia/design";
import type { ThemeTokens } from "@olivia/design";

// 算法与 DESIGN §3.2 一一对应；调参先改文档。
// 树形由竖线场重建：离屏画布画树 → 采样亮度 → 四档量化 → 分组 Path2D，每帧只 stroke 4 次。
const SAMPLE = 720;
const GRID = 96;
const SEG = 48;
const ALPHAS = [0.2, 0.55, 0.82, 1.0];
const THRESH = [0.12, 0.42, 0.89];

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

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function drawOliveTree(ctx: CanvasRenderingContext2D, S: number): void {
  const rnd = mulberry32(20261102);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const cx = S * 0.5;
  const tips: { x: number; y: number; r: number }[] = [];

  function taper(
    p0: P, p1: P, p2: P, p3: P,
    w0: number, w1: number, steps: number,
  ): void {
    const q = (t: number) => {
      const mt = 1 - t;
      return {
        x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
        y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
      };
    };
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const a = q(t0);
      const b = q(t1);
      ctx.lineWidth = lerp(w0, w1, (t0 + t1) / 2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  const forkY = S * 0.6;
  taper(
    { x: cx - 18, y: S * 0.98 }, { x: cx - 36, y: S * 0.84 },
    { x: cx + 22, y: S * 0.74 }, { x: cx - 8, y: forkY },
    64, 36, 32,
  );

  function branch(x: number, y: number, ang: number, len: number, w: number, depth: number): void {
    if (depth <= 0 || len < 13 || w < 1.6) return;
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    const mx = x + Math.cos(ang) * len * 0.5 + (rnd() - 0.5) * len * 0.22;
    const my = y + Math.sin(ang) * len * 0.5 + (rnd() - 0.5) * len * 0.22;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    if (depth <= 2) tips.push({ x: ex, y: ey, r: len });
    for (let i = 0; i < 2; i++) {
      const spread = (i === 0 ? -1 : 1) * (0.3 + rnd() * 0.26);
      let na = ang + spread + (rnd() - 0.5) * 0.18;
      // 枝条角度钳制在上半平面：不出现下垂裸枝（DESIGN §3.1）
      na = clamp(na, -Math.PI + 0.18, -0.18);
      branch(ex, ey, na, len * (0.66 + rnd() * 0.14), w * 0.62, depth - 1);
    }
  }

  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.44 + (rnd() - 0.5) * 0.1;
    branch(cx - 8, forkY, a, S * 0.155, 20, 5);
  }

  const canopyCy = S * 0.345;
  const canopyRx = S * 0.315;
  const canopyRy = S * 0.235;
  // 冠底开天窗露出主枝分叉（DESIGN §3.1）
  function canopyMask(nx: number, ny: number): number {
    const base = Math.max(0, 1 - (nx * nx) / 0.92 - ny * ny);
    if (ny > 0.25) return base * Math.max(0, 1 - (ny - 0.25) * 1.9);
    return base;
  }
  for (const t of tips) {
    const lobes = 2 + Math.floor(rnd() * 2);
    for (let l = 0; l < lobes; l++) {
      const la = rnd() * Math.PI * 2;
      const ld = rnd() * t.r * 0.5;
      const lx = t.x + Math.cos(la) * ld;
      const ly = t.y + Math.sin(la) * ld * 0.85;
      const blobs = 6 + Math.floor(rnd() * 7);
      const spreadR = S * (0.03 + rnd() * 0.026);
      for (let i = 0; i < blobs; i++) {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * spreadR;
        const px = lx + Math.cos(a) * d;
        const py = ly + Math.sin(a) * d * 0.82;
        if (canopyMask((px - cx) / canopyRx, (py - canopyCy) / canopyRy) < 0.08) continue;
        const r = S * 0.011 + rnd() * S * 0.014;
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * (0.66 + rnd() * 0.34), rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // 底部挖孔：避免树冠与树干糊成整块
  ctx.fillStyle = "#000";
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd());
    const px = cx + Math.cos(a) * d * S * 0.24;
    const py = canopyCy + Math.sin(a) * d * S * 0.11;
    const r = S * 0.013 + rnd() * S * 0.022;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * (0.5 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(cx - S * 0.01, S * 0.455, S * 0.07, S * 0.038, 0, 0, Math.PI * 2);
  ctx.fill();
}

interface P {
  x: number;
  y: number;
}

// 亮度网格全程只采样一次（DESIGN §3.2：像素读取只读一次，resize 不重采样）
function sampleTree(): Float32Array {
  const off = document.createElement("canvas");
  off.width = SAMPLE;
  off.height = SAMPLE;
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) throw new Error("2d context unavailable");
  drawOliveTree(octx, SAMPLE);
  const img = octx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  const lum = new Float32Array(GRID * GRID);
  const cell = SAMPLE / GRID;
  const step = cell / 7;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      const x0 = gx * cell;
      const y0 = gy * cell;
      for (let sy = 0; sy < 7; sy++) {
        for (let sx = 0; sx < 7; sx++) {
          const px = Math.min(SAMPLE - 1, (x0 + sx * step) | 0);
          const py = Math.min(SAMPLE - 1, (y0 + sy * step) | 0);
          const idx = (py * SAMPLE + px) * 4;
          sum += (0.2126 * img[idx] + 0.7152 * img[idx + 1] + 0.0722 * img[idx + 2]) / 255;
        }
      }
      lum[gy * GRID + gx] = sum / 49;
    }
  }
  off.width = 0;
  off.height = 0;
  return lum;
}

// 漂移噪声：128 种子格 + 双线性值噪声（DESIGN §3.2）
const NOISE_N = 128;
const noiseGrid = (() => {
  let state = 7319;
  const g = new Float32Array(NOISE_N * NOISE_N);
  for (let i = 0; i < g.length; i++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state |= 0;
    g[i] = ((state >>> 0) / 4294967295) * 2 - 1;
  }
  return g;
})();
const smooth = (t: number) => t * t * (3 - 2 * t);

function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const wrap = (v: number) => ((v % NOISE_N) + NOISE_N) % NOISE_N;
  const x0 = wrap(xi);
  const x1 = wrap(xi + 1);
  const y0 = wrap(yi);
  const y1 = wrap(yi + 1);
  const a = noiseGrid[y0 * NOISE_N + x0];
  const b = noiseGrid[y0 * NOISE_N + x1];
  const c = noiseGrid[y1 * NOISE_N + x0];
  const d = noiseGrid[y1 * NOISE_N + x1];
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}

export interface TreeController {
  setProgress: (p: number) => void;
  /** reduced-motion：画一帧 progress=1 的静态图，不进 rAF（DESIGN §3.3） */
  drawStatic: () => void;
  destroy: () => void;
}

export function createTreeController(
  canvas: HTMLCanvasElement,
  getTokens: () => ThemeTokens,
): TreeController {
  const ctx0 = canvas.getContext("2d");
  if (!ctx0) throw new Error("2d context unavailable");
  // function 声明会提升，null 收窄进不了内层函数；显式非空类型一次性解决
  const ctx: CanvasRenderingContext2D = ctx0;

  const LUM = sampleTree();
  const NSEG = GRID * SEG;
  const offX = new Float32Array(NSEG);
  const offY = new Float32Array(NSEG);
  const velX = new Float32Array(NSEG);
  const velY = new Float32Array(NSEG);

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cssSize = 0;
  let cellSize = 0;
  let progress = 0;
  let frontier = 0;
  let elapsed = 0;
  let pulse = 0;
  let rafId: number | null = null;
  let lastTs = 0;
  let lastPx = -1e9;
  let lastPy = -1e9;

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    cssSize = rect.width;
    cellSize = cssSize / GRID;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 指针拨动：静止指针不能把线永久撑开（DESIGN §3.2）
  function impulseAt(px: number, py: number): void {
    const radius = cssSize * 0.25;
    const r2 = radius * radius;
    for (let s = 0; s < NSEG; s++) {
      const c = s % GRID;
      const r = (s / GRID) | 0;
      const sx = (c + 0.5) * cellSize;
      const sy = (r * 2 + 1) * cellSize;
      const dx = sx - px;
      const dy = sy - py;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2) || 1;
      const inf = Math.max(0, 1 - d / radius);
      const force = inf * inf * pulse * 25;
      offX[s] = (dx / d) * force;
      offY[s] = (dy / d) * force * 0.58;
      velX[s] = 0;
      velY[s] = 0;
    }
  }

  function stepSprings(dt: number): void {
    const k = 145;
    const c = 19;
    for (let s = 0; s < NSEG; s++) {
      if (offX[s] === 0 && offY[s] === 0 && velX[s] === 0 && velY[s] === 0) continue;
      velX[s] += (-k * offX[s] - c * velX[s]) * dt;
      offX[s] += velX[s] * dt;
      velY[s] += (-k * offY[s] - c * velY[s]) * dt;
      offY[s] += velY[s] * dt;
      if (Math.abs(offX[s]) < 0.01 && Math.abs(velX[s]) < 0.01) { offX[s] = 0; velX[s] = 0; }
      if (Math.abs(offY[s]) < 0.01 && Math.abs(velY[s]) < 0.01) { offY[s] = 0; velY[s] = 0; }
    }
  }

  function draw(): void {
    if (!cssSize) return;
    const th = getTokens();
    ctx.clearRect(0, 0, cssSize, cssSize);

    // 四档各一条 Path2D：每帧 4 次 stroke 是性能上限的来源（DESIGN §3.4）
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const gap = 0.7;

    for (let r = 0; r < SEG; r++) {
      if (r >= frontier) break;
      for (let c = 0; c < GRID; c++) {
        const s = r * GRID + c;
        let L = (LUM[r * 2 * GRID + c] + LUM[(r * 2 + 1) * GRID + c]) / 2;
        const n = noise2(c * 0.15 + 3, r * 0.16 - elapsed * 0.17);
        L = clamp(L * 0.94 + n * 0.12 * (0.25 + L * 0.75), 0, 1);

        let lvl: number;
        if (L < THRESH[0]) continue;
        else if (L < THRESH[1]) lvl = 1;
        else if (L < THRESH[2]) lvl = 2;
        else lvl = 3;

        const x = (c + 0.5) * cellSize + offX[s];
        paths[lvl].moveTo(x, r * 2 * cellSize + gap * 0.5 + offY[s]);
        paths[lvl].lineTo(x, (r * 2 + 2) * cellSize - gap * 0.5 + offY[s]);
      }
    }

    ctx.lineCap = "butt";
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = ALPHAS[i];
      ctx.lineWidth = LINE_WIDTHS[i] * (cellSize / 5.25);
      ctx.strokeStyle = th.accent;
      ctx.stroke(paths[i]);
    }
    ctx.globalAlpha = 1;

    // progress > 0.72 后按固定种子点亮 7 个果实（DESIGN §3.2）
    if (progress > 0.72) {
      const k = clamp((progress - 0.72) / 0.28, 0, 1);
      const fr = mulberry32(777);
      ctx.fillStyle = th.warn;
      ctx.globalAlpha = k;
      for (let i = 0; i < 7; i++) {
        const ang = fr() * Math.PI * 2;
        const d = Math.sqrt(fr());
        ctx.beginPath();
        ctx.arc((0.5 + Math.cos(ang) * d * 0.3) * cssSize, (0.33 + Math.sin(ang) * d * 0.17) * cssSize, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function loop(ts: number): void {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(dt, 1 / 30);
    elapsed += dt;
    pulse *= Math.exp(-dt * 5.5);
    stepSprings(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function onPointer(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dx = px - lastPx;
    const dy = py - lastPy;
    if (dx * dx + dy * dy > 2.25) {
      pulse = 1;
      impulseAt(px, py);
      lastPx = px;
      lastPy = py;
    }
  }
  const onLeave = () => {
    lastPx = -1e9;
    lastPy = -1e9;
  };
  const onResize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    resize();
  };

  canvas.addEventListener("pointermove", onPointer);
  canvas.addEventListener("pointerdown", onPointer);
  canvas.addEventListener("pointerleave", onLeave);
  window.addEventListener("resize", onResize);
  resize();
  rafId = requestAnimationFrame(loop);

  return {
    setProgress(p: number) {
      progress = p;
      frontier = easeOutCubic(p) * (SEG + 2);
    },
    drawStatic() {
      progress = 1;
      frontier = SEG + 2;
      draw();
    },
    destroy() {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
