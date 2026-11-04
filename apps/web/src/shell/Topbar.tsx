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
  const { running, toggleRunning, instance } = useApp();
  const { theme, setTheme } = useTheme();
  const clock = useClock();

  // 版本/CUDA 标签由 M1.1b 部署引擎填充；拿不到就不渲染，不放假标签
  const addr = running && instance?.port != null ? `127.0.0.1:${instance.port}` : "未连接";

  return (
    <header className="topbar">
      <button className="inst-select">
        <span className={running ? "status-dot on" : "status-dot"} />
        <span className="name">{instance?.name ?? "…"}</span>
        {instance?.version && <span className="tag">{instance.version}</span>}
        {instance?.cuda && <span className="tag cu">CUDA {instance.cuda}</span>}
      </button>
      <span className="meta num">{addr}</span>
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
