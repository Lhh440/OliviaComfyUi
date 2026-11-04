import { useCallback, useEffect, useState } from "react";
import { core } from "../api/http";
import type { AttributionRow, DiskInfo } from "../api/types";
import { Chart } from "../components/Chart";
import { ErrorCard, Loading, PageHead } from "../components/states";
import { useApp } from "../state";

export function HardwarePage() {
  const { sample, utilHist } = useApp();
  const [attr, setAttr] = useState<AttributionRow[] | null>(null);
  const [disks, setDisks] = useState<DiskInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([core.getAttribution(), core.getDisks()])
      .then(([a, d]) => {
        setAttr(a);
        setDisks(d);
      })
      .catch((err: unknown) => setError(String(err)));
  }, []);
  useEffect(load, [load]);

  const gpu = sample?.gpu;
  // null 表示采集不到（AGENTS.md）：显示「不可用」，禁止 0 冒充
  const noNvml = gpu != null && gpu.name === null;
  const util = gpu?.utilization;
  const vramUsed = gpu?.vramUsedGb;
  const vramTotal = gpu?.vramTotalGb;
  const vramPct = vramUsed != null && vramTotal ? (vramUsed / vramTotal) * 100 : 0;

  return (
    <section className="page active">
      <PageHead page="hardware" />
      <div className="grid">
        <div className="card c3">
          <div className="card-title">GPU 利用率</div>
          <div className="metric">
            {sample === null ? (
              <Loading text="—" />
            ) : util != null ? (
              <>
                {Math.round(util)}
                <small>%</small>
              </>
            ) : (
              <span className="unavailable">不可用</span>
            )}
          </div>
          {sample !== null && util != null && <Chart values={utilHist} height={56} />}
        </div>
        <div className="card c3">
          <div className="card-title">显存</div>
          <div className="metric">
            {sample === null ? (
              <Loading text="—" />
            ) : vramUsed != null ? (
              <>
                {vramUsed.toFixed(1)}
                <small>GB</small>
              </>
            ) : (
              <span className="unavailable">不可用</span>
            )}
          </div>
          <div className="metric-sub">{sample ? (vramTotal != null ? `共 ${vramTotal.toFixed(1)} GB` : "总量不可用") : "—"}</div>
          <div className="bar">
            <i style={{ width: `${vramPct}%` }} />
          </div>
        </div>
        <div className="card c3">
          <div className="card-title">温度</div>
          <div className="metric">
            {sample === null ? (
              <Loading text="—" />
            ) : gpu?.temperatureC != null ? (
              <>
                {Math.round(gpu.temperatureC)}
                <small>°C</small>
              </>
            ) : (
              <span className="unavailable">不可用</span>
            )}
          </div>
          <div className="metric-sub">{gpu?.fanPercent != null ? `风扇 ${Math.round(gpu.fanPercent)}%` : "风扇 不可用"}</div>
        </div>
        <div className="card c3">
          <div className="card-title">功耗</div>
          <div className="metric">
            {sample === null ? (
              <Loading text="—" />
            ) : gpu?.powerW != null ? (
              <>
                {Math.round(gpu.powerW)}
                <small>W</small>
              </>
            ) : (
              <span className="unavailable">不可用</span>
            )}
          </div>
          <div className="metric-sub">{gpu?.powerLimitW != null ? `上限 ${gpu.powerLimitW} W` : "上限 不可用"}</div>
        </div>

        {noNvml && (
          <div className="banner">
            <div className="ico" />
            <div className="txt">
              <b>未检测到可用的 NVIDIA 采集通道</b>
              <span>GPU 指标不可用。系统内存与磁盘不受影响，仍正常显示。</span>
            </div>
          </div>
        )}

        <div className="card c12">
          <div className="card-title">
            <span>工作流资源归因</span>
            <span className="more">时间窗口归因 · 含模型常驻开销</span>
          </div>
          {error ? (
            <ErrorCard message={error} onRetry={load} />
          ) : attr === null ? (
            <Loading />
          ) : attr.length === 0 ? (
            // 归因需要实例 /ws 事件流（M1.2）：真实空态而非示例表
            <div className="loading">暂无归因数据。此功能将随 M1.2（实例事件流接入）提供。</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>工作流</th>
                  <th>峰值显存</th>
                  <th>平均利用率</th>
                  <th>峰值温度</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                {attr.map((r) => (
                  <tr key={r.workflow}>
                    <td>
                      {r.workflow} {r.running && <span className="pill run">进行中</span>}
                    </td>
                    <td className="mono" style={r.peakVramGb > 15 ? { color: "var(--danger)" } : undefined}>{r.peakVramGb} GB</td>
                    <td className="mono">{r.avgUtil}%</td>
                    <td className="mono">{r.peakTempC} °C</td>
                    <td className="mono">{Math.floor(r.elapsedSec / 60)}:{String(r.elapsedSec % 60).padStart(2, "0")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* 口径声明是 ADR-0007 的硬性要求，不可删 */}
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 12, lineHeight: 1.7, maxWidth: 640 }}>
            峰值为该时间窗口内的整卡采样，包含模型常驻与上下文开销，不等于该工作流独占用量。需要精确计量请在设置中开启「进程隔离模式」。
          </p>
        </div>

        <div className="card flat c6">
          <div className="card-title">系统</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: "12.5px" }}>
            <KV label="CPU" value={sample?.system.cpuPercent != null ? `${Math.round(sample.system.cpuPercent)} %` : "不可用"} />
            <KV
              label="内存"
              value={
                sample?.system.ramUsedGb != null && sample.system.ramTotalGb != null
                  ? `${sample.system.ramUsedGb.toFixed(1)} GB / ${sample.system.ramTotalGb.toFixed(1)} GB`
                  : "不可用"
              }
            />
            <KV label="显卡" value={gpu?.name ?? "不可用"} />
            <KV label="驱动" value={gpu?.driver ?? "不可用"} />
          </div>
        </div>

        <div className="card flat c6">
          <div className="card-title">磁盘</div>
          {disks === null ? (
            <Loading />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: "12.5px" }}>
              {disks.map((d) => (
                <div key={d.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "var(--muted)" }}>{d.label}</span>
                    <span className="num">{d.freeGb} GB 可用 / {d.totalGb >= 1000 ? `${d.totalGb / 1000} TB` : `${d.totalGb} GB`}</span>
                  </div>
                  <div className="bar" style={{ margin: 0 }}>
                    <i style={{ width: `${((d.totalGb - d.freeGb) / d.totalGb) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
