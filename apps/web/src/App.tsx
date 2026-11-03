import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { core } from "./api/mock";
import type { HardwareSample } from "./api/types";
import { Sidebar } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { Splash } from "./splash/Splash";
import { AppContext, PAGE_ORDER } from "./state";
import type { PageKey } from "./state";
import { ThemeProvider } from "./theme";
import { AssetsPage } from "./pages/Assets";
import { HardwarePage } from "./pages/Hardware";
import { InstancesPage } from "./pages/Instances";
import { ModelsPage } from "./pages/Models";
import { OverviewPage } from "./pages/Overview";
import { QueuePage } from "./pages/Queue";
import { SettingsPage } from "./pages/Settings";

// M1.1 接真实 Core 时换 mock.ts 里的单例实现，接口形状不变
const HIST = 120;

function AppInner() {
  const [page, setPage] = useState<PageKey>("overview");
  const [leaving, setLeaving] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [running, setRunning] = useState(false);
  const [assetFolder, setAssetFolderState] = useState<string | null>(null);
  const [sample, setSample] = useState<HardwareSample | null>(null);
  const [utilHist, setUtilHist] = useState<number[]>(() => new Array(HIST).fill(0));
  const [vramHist, setVramHist] = useState<number[]>(() => new Array(HIST).fill(0));
  const contentRef = useRef<HTMLDivElement | null>(null);

  const navigate = useCallback((next: PageKey) => {
    setPage(next);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);

  const setAssetFolder = useCallback((path: string | null) => {
    core.setAssetFolder(path);
    setAssetFolderState(path);
  }, []);

  const toggleRunning = useCallback(() => {
    setRunning((prev) => {
      const next = !prev;
      core.setRunning(next);
      return next;
    });
  }, []);

  // 硬件订阅挂在 App 层：页面切换不丢历史曲线
  useEffect(() => {
    const unsub = core.subscribeHardware((s) => {
      setSample(s);
      setUtilHist((h) => append(h, s.gpu.utilization ?? 0));
      setVramHist((h) => append(h, s.gpu.vramTotalGb ? ((s.gpu.vramUsedGb ?? 0) / s.gpu.vramTotalGb) * 100 : 0));
    });
    return unsub;
  }, []);

  // 键盘：1–7 切页，Ctrl+Enter 启动/停止（DESIGN §5）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleRunning();
        return;
      }
      const n = Number.parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= PAGE_ORDER.length) navigate(PAGE_ORDER[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, toggleRunning]);

  const handleSplashFinish = useCallback(() => {
    // 启动器动画淡出与主界面淡入走同一条过渡（DESIGN §3.3）
    setLeaving(true);
    window.setTimeout(() => setSplashGone(true), 950);
  }, []);

  const state = useMemo(
    () => ({
      page,
      navigate,
      running,
      toggleRunning,
      assetFolder,
      setAssetFolder,
      sample,
      utilHist,
      vramHist,
    }),
    [page, navigate, running, toggleRunning, assetFolder, setAssetFolder, sample, utilHist, vramHist],
  );

  return (
    <AppContext.Provider value={state}>
      {!splashGone && <Splash leaving={leaving} onFinish={handleSplashFinish} />}
      <div id="app" className={leaving ? "in" : undefined} aria-hidden={!leaving || undefined}>
        <Sidebar />
        <div className="main">
          <Topbar />
          <div className="content" ref={contentRef}>
            {page === "overview" && <OverviewPage />}
            {page === "instances" && <InstancesPage />}
            {page === "queue" && <QueuePage />}
            {page === "hardware" && <HardwarePage />}
            {page === "assets" && <AssetsPage />}
            {page === "models" && <ModelsPage />}
            {page === "settings" && <SettingsPage />}
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
}

function append(hist: number[], v: number): number[] {
  const next = hist.length >= HIST ? hist.slice(1) : hist.slice();
  next.push(v);
  return next;
}

export function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
