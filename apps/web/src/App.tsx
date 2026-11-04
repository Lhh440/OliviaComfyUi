import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { core, probeCore } from "./api/http";
import type { HardwareSample, InstanceInfo } from "./api/types";
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

const HIST = 120;

function AppInner() {
  const [page, setPage] = useState<PageKey>("overview");
  const [leaving, setLeaving] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const [coreOnline, setCoreOnline] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [assetFolder, setAssetFolderState] = useState<string | null>(null);
  const [sample, setSample] = useState<HardwareSample | null>(null);
  const [utilHist, setUtilHist] = useState<number[]>(() => new Array(HIST).fill(0));
  const [vramHist, setVramHist] = useState<number[]>(() => new Array(HIST).fill(0));
  const contentRef = useRef<HTMLDivElement | null>(null);

  const navigate = useCallback((next: PageKey) => {
    setPage(next);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);

  // Core 探活：不可达时全局横幅，绝不降级到假数据
  useEffect(() => {
    probeCore().then(setCoreOnline);
  }, []);

  const setAssetFolder = useCallback((path: string | null) => {
    void core.setAssetFolder(path).then(() => setAssetFolderState(path)).catch(() => {});
  }, []);

  const runningRef = useRef(false);
  const toggleRunning = useCallback(() => {
    // StrictMode 会双调用 updater，副作用绝不能放进 setState 的更新函数——
    // 用 ref 记当前值、在 updater 外发请求，保证一次点击恰好一次启停调用
    const next = !runningRef.current;
    runningRef.current = next;
    setRunning(next);
    void core.setRunning(next).catch(() => {});
  }, []);

  // 实例真实状态每 3s 纠偏，同时兼任 Core 存活探测：成功恢复在线、失败置离线。
  // 不做「在线才轮询」守卫——否则离线后轮询停摆，永远无法恢复在线。
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const tick = () => {
      core
        .getInstance()
        .then((i) => {
          if (!alive) return;
          setRunning(i.running);
          runningRef.current = i.running;
          setInstance(i);
          setCoreOnline(true);
        })
        .catch(() => {
          if (alive) setCoreOnline(false);
        });
      timer = window.setTimeout(tick, 3000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
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
      coreOnline,
      instance,
      sample,
      utilHist,
      vramHist,
    }),
    [page, navigate, running, toggleRunning, assetFolder, setAssetFolder, coreOnline, instance, sample, utilHist, vramHist],
  );

  return (
    <AppContext.Provider value={state}>
      {!splashGone && <Splash leaving={leaving} onFinish={handleSplashFinish} />}
      <div id="app" className={leaving ? "in" : undefined} aria-hidden={!leaving || undefined}>
        <Sidebar />
        <div className="main">
          <Topbar />
          {coreOnline === false && (
            <div className="banner" style={{ margin: "14px 26px 0" }}>
              <div className="ico" />
              <div className="txt">
                <b>本地服务未连接</b>
                <span>请先启动 Olivia Core（services/core 下执行 python -m olivia_core），界面不会使用假数据。</span>
              </div>
            </div>
          )}
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
