import { useEffect, useState } from "react";
import { THEME_ORDER, THEMES } from "@olivia/design";
import { useApp } from "../state";
import { useTheme } from "../theme";

function useClock(): string {
  const [now, setNow] = useState("--:--:--");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow([d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, "0")).join(":"));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Topbar() {
  const { running, toggleRunning } = useApp();
  const { theme, setTheme } = useTheme();
  const clock = useClock();

  return (
    <header className="topbar">
      <button className="inst-select">
        <span className={running ? "status-dot on" : "status-dot"} />
        <span className="name">ComfyUI · 默认实例</span>
        <span className="tag">v0.3.58</span>
        <span className="tag cu">CUDA 12.4</span>
      </button>
      <span className="meta num">127.0.0.1:8188</span>
      <span className="spacer" />
      <div className="theme-switch" role="group" aria-label="配色方案">
        {THEME_ORDER.map((key) => (
          <button
            key={key}
            aria-pressed={theme === key}
            onClick={() => setTheme(key)}
          >
            <span className="sw" style={{ background: THEMES[key].sw }} />
            {THEMES[key].label}
          </button>
        ))}
      </div>
      <span className="meta num">{clock}</span>
      <button className="btn primary" onClick={toggleRunning}>
        {running ? "停止" : "启动"}
      </button>
    </header>
  );
}
