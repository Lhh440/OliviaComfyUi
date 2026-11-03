import { useCallback, useEffect, useState } from "react";
import { core } from "../api/mock";
import type { InstanceInfo } from "../api/types";
import { ErrorCard, Loading, PageHead } from "../components/states";

export function InstancesPage() {
  const [instance, setInstance] = useState<InstanceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    core.getInstance().then(setInstance).catch((err: unknown) => setError(String(err)));
  }, []);
  useEffect(load, [load]);

  return (
    <section className="page active">
      <PageHead page="instances" />
      <div className="grid">
        {error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : instance === null ? (
          <div className="card c6"><Loading /></div>
        ) : (
          <div className="card c6">
            <div className="card-title">
              <span>{instance.name}</span>
              <span className="pill run">运行中</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "12.5px" }}>
              <Row label="版本" value={`${instance.version} (${instance.commit})`} />
              <Row label="端口" value={String(instance.port)} />
              <Row label="torch" value={instance.torch} />
              <Row label="磁盘占用" value={`${instance.diskGb} GB`} />
              <Row label="路径" value={instance.path} small />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn" style={{ height: 32, fontSize: "12.5px" }}>停止</button>
              <button className="btn ghost" style={{ height: 32, fontSize: "12.5px" }}>查看日志</button>
              <button className="btn ghost" style={{ height: 32, fontSize: "12.5px", color: "var(--danger)" }}>删除</button>
            </div>
          </div>
        )}

        <div className="card c6">
          <div className="card-title">
            <span>新增实例</span>
            <span className="more">可自定义版本</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: 5 }}>ComfyUI 版本</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tag">latest</span>
                <span className="tag">v0.3.58</span>
                <span className="tag">v0.3.40</span>
                <span className="tag">自定义 tag</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: 5 }}>torch / CUDA</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tag cu">cu124 · 推荐</span>
                <span className="tag">cu121</span>
                <span className="tag">cpu</span>
              </div>
            </div>
            <button className="btn primary" style={{ alignSelf: "flex-start", height: 32, fontSize: "12.5px" }}>
              开始部署
            </button>
          </div>
        </div>

        <div className="card flat c12">
          <div className="card-title">部署进度（示例）</div>
          <div style={{ fontSize: 12, color: "var(--ink2)", display: "flex", justifyContent: "space-between" }}>
            <span>安装 torch 2.6.0+cu124</span>
            <span className="num">2.31 GB / 2.44 GB · 8.2 MB/s</span>
          </div>
          <div className="bar" style={{ height: 4 }}>
            <i style={{ width: "94.6%" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>预计剩余 16 秒 · 支持断点续传</div>
        </div>
      </div>
    </section>
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
