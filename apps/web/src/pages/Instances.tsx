import { useCallback, useEffect, useRef, useState } from "react";
import { core } from "../api/http";
import type { InstanceInfo } from "../api/types";
import { ErrorCard, Loading, PageHead } from "../components/states";
import { useApp } from "../state";

// 状态徽标口径与 Core 的 InstanceManager.status 一一对应
const STATUS_PILL: Record<string, { text: string; cls: string }> = {
  running: { text: "运行中", cls: "pill run" },
  starting: { text: "启动中", cls: "pill" },
  stopping: { text: "停止中", cls: "pill" },
  stopped: { text: "已停止", cls: "pill" },
  failed: { text: "失败", cls: "pill bad" },
};

export function InstancesPage() {
  const { toggleRunning } = useApp();
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [python, setPython] = useState("python");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[] | null>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setError(null);
    core.getInstance().then(setInstance).catch((err: unknown) => setError(String(err)));
  }, []);
  useEffect(load, [load]);

  // 实例页轮询真实状态：注册/启停在别处发生时这里自动跟上
  useEffect(() => {
    const id = window.setInterval(() => {
      core.getInstance().then(setInstance).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const deployed = instance?.deployed === true;

  // 实例日志环形缓冲：部署/运行排查的主入口，滚动跟随最新行
  useEffect(() => {
    if (!deployed) {
      setLogs(null);
      return;
    }
    let alive = true;
    const poll = () =>
      core
        .pollLogs()
        .then((lines) => {
          if (!alive) return;
          setLogs(lines);
          const box = logBoxRef.current;
          if (box) box.scrollTop = box.scrollHeight;
        })
        .catch(() => {});
    poll();
    const id = window.setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [deployed]);

  const register = useCallback(() => {
    setFormBusy(true);
    setFormError(null);
    core
      .registerInstance({ path: path.trim(), python: python.trim() })
      .then(() => {
        setPath("");
        load();
      })
      .catch((err: unknown) => setFormError(String(err)))
      .finally(() => setFormBusy(false));
  }, [path, python, load]);

  const unregister = useCallback(() => {
    setActionError(null);
    core
      .unregisterInstance()
      .then(load)
      .catch((err: unknown) => setActionError(String(err)));
  }, [load]);

  return (
    <section className="page active">
      <PageHead page="instances" />
      <div className="grid">
        {error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : instance === null ? (
          <div className="card c6"><Loading /></div>
        ) : deployed ? (
          <div className="card c6">
            <div className="card-title">
              <span>{instance.name}</span>
              <span className={STATUS_PILL[instance.status ?? "stopped"]?.cls ?? "pill"}>
                {STATUS_PILL[instance.status ?? "stopped"]?.text ?? instance.status}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "12.5px" }}>
              <Row label="路径" value={instance.path ?? "不可用"} small />
              <Row label="Python" value={instance.python ?? "不可用"} small />
              <Row label="端口" value={instance.port != null ? String(instance.port) : "不可用"} />
              <Row label="PID" value={instance.pid != null ? String(instance.pid) : "不可用"} />
              {instance.exitCode != null && <Row label="上次退出码" value={String(instance.exitCode)} />}
              <Row label="版本 / torch" value="不可用" />
              <Row label="磁盘占用" value="不可用" />
            </div>
            {actionError && (
              <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 10 }}>{actionError}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                className="btn primary"
                style={{ height: 32, fontSize: "12.5px" }}
                onClick={() => {
                  setActionError(null);
                  toggleRunning();
                }}
              >
                {instance.running ? "停止" : "启动"}
              </button>
              <button
                className="btn ghost"
                style={{ height: 32, fontSize: "12.5px", color: "var(--danger)" }}
                disabled={instance.running}
                onClick={unregister}
              >
                移除注册
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
              版本、torch 与磁盘占用由部署引擎填充（M1.1b），当前显示「不可用」。
            </div>
          </div>
        ) : (
          // ADR-0008 / 验收 5：未注册时整卡注册表单，绝不静默替用户做决定
          <div className="card c6">
            <div className="card-title">
              <span>注册已有 ComfyUI</span>
              <span className="more">M1.1a · 指向现有目录</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="ComfyUI 目录（需包含 main.py）">
                <input className="path-input" value={path} onChange={(e) => setPath(e.target.value)} placeholder="D:\\ComfyUI" spellCheck={false} />
              </Field>
              <Field label="Python 解释器（venv 内的 python.exe）">
                <input className="path-input" value={python} onChange={(e) => setPython(e.target.value)} placeholder="python 或完整路径" spellCheck={false} />
              </Field>
              {formError && <div style={{ fontSize: 11.5, color: "var(--danger)" }}>{formError}</div>}
              <button className="btn primary" style={{ alignSelf: "flex-start", height: 32, fontSize: "12.5px" }} disabled={formBusy || path.trim() === ""} onClick={register}>
                {formBusy ? "注册中…" : "注册"}
              </button>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                一键部署（自动拉取 ComfyUI 与 torch 环境）将在 M1.1b 提供。
              </div>
            </div>
          </div>
        )}

        {deployed && (
          <div className="card flat c12">
            <div className="card-title">
              <span>实例日志</span>
              <span className="more">环形缓冲 · 最近 2000 行</span>
            </div>
            {logs === null ? (
              <Loading />
            ) : logs.length === 0 ? (
              <div className="loading">暂无日志。点击「启动」后，实例输出会实时出现在这里。</div>
            ) : (
              <div className="log" ref={logBoxRef} style={{ maxHeight: 220 }}>
                {logs.map((line, i) => (
                  <span key={i}>{line + "\n"}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="num" style={small ? { fontSize: "10.5px" } : undefined}>{value}</span>
    </div>
  );
}
