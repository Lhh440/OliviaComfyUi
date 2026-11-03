import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../theme";
import { createTreeController } from "./quantizedTree";
import type { TreeController } from "./quantizedTree";

// 阶段表是真实初始化任务接入前的占位（DESIGN §3.1：progress 由真实初始化任务驱动）
const STAGES = [
  { t: "正在解析运行环境", w: 0.1 },
  { t: "校验 CUDA 与显卡驱动", w: 0.28 },
  { t: "载入 ComfyUI 实例", w: 0.52 },
  { t: "检查资产目录与模型", w: 0.74 },
  { t: "连接本地服务", w: 0.92 },
  { t: "准备就绪", w: 1.0 },
];
const TICKS = [0.25, 0.5, 0.75, 1];

export function Splash({ leaving, onFinish }: { leaving: boolean; onFinish: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctrlRef = useRef<TreeController | null>(null);
  const timersRef = useRef<number[]>([]);
  const finishedRef = useRef(false);
  const { tokens } = useTheme();
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setProgress(1);
    setStageIdx(STAGES.length - 1);
    ctrlRef.current?.setProgress(1);
    // progress=1 → 停留 420ms 再过渡（DESIGN §3.3）
    timersRef.current.push(window.setTimeout(() => onFinishRef.current(), 420));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const timers = timersRef.current;
    const ctrl = createTreeController(canvas, () => tokensRef.current);
    ctrlRef.current = ctrl;

    const advance = (i: number): void => {
      if (finishedRef.current || i >= STAGES.length) return;
      const st = STAGES[i];
      setStageIdx(i);
      setProgress(st.w);
      ctrl.setProgress(st.w);
      if (i < STAGES.length - 1) {
        timers.push(window.setTimeout(() => advance(i + 1), 620 + Math.random() * 420));
      } else {
        timers.push(window.setTimeout(finish, 420));
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ctrl.drawStatic();
      timers.push(window.setTimeout(finish, 900));
    } else {
      timers.push(window.setTimeout(() => advance(0), 320));
    }

    return () => {
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      ctrl.destroy();
      ctrlRef.current = null;
    };
  }, [finish]);

  const stage = STAGES[stageIdx];

  return (
    <div id="splash" className={leaving ? "out" : undefined} aria-hidden={leaving || undefined}>
      <canvas id="tree" ref={canvasRef} aria-hidden="true" />
      <div className="splash-brand">
        <div className="mark">OLIVIA</div>
        <div className="sub">ComfyUI 启动器</div>
        <div className="ver">v0.1.0-m1</div>
      </div>
      <div className="splash-foot">
        <div>
          <div className="splash-status">
            <span>{stage.t}</span>
            <span className="pct num">{Math.round(progress * 100)}%</span>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${progress * 100}%` }} />
            {TICKS.map((p) => (
              <div key={p} className={progress >= p ? "tick on" : "tick"} style={{ left: `${p * 100}%` }} />
            ))}
          </div>
        </div>
        <button id="skip" onClick={finish}>跳过启动动画</button>
      </div>
    </div>
  );
}
