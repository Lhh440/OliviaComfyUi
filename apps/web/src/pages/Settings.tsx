import { useState } from "react";
import { THEME_ORDER, THEMES } from "@olivia/design";
import { PageHead } from "../components/states";
import { readSponsorHidden, writeSponsorHidden } from "../storage";
import { useTheme } from "../theme";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [sponsorHidden, setSponsorHidden] = useState(readSponsorHidden);

  return (
    <section className="page active">
      <PageHead page="settings" />
      <div className="grid">
        <div className="card c6">
          <div className="card-title">外观</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "12.5px" }}>
            {THEME_ORDER.map((key) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: THEMES[key].sw, marginRight: 7 }} />
                  {THEMES[key].label} <span style={{ color: "var(--muted)", fontSize: 11 }}>{THEMES[key].note}</span>
                </div>
                <button
                  className="btn ghost"
                  style={{ height: 26, fontSize: "11.5px", padding: "0 12px" }}
                  aria-pressed={theme === key}
                  onClick={() => setTheme(key)}
                >
                  使用
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card c6">
          <div className="card-title">下载源</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "12.5px" }}>
            <Setting tag="清华 TUNA" label="PyPI 镜像" />
            <Setting tag="cnb.cool 镜像" label="ComfyUI 仓库" />
            <Setting tag="hf-mirror.com" label="模型源" />
            <button className="btn ghost" style={{ alignSelf: "flex-start", height: 30, fontSize: 12, marginTop: 4 }}>
              切回官方源
            </button>
          </div>
        </div>

        <div className="card c6">
          <div className="card-title">监控</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "12.5px" }}>
            <Setting tag="500 ms" label="硬件采样间隔" />
            <Setting tag="关闭（实验）" label="进程隔离模式" />
            <Setting tag={sponsorHidden ? "关闭" : "开启"} label="显示赞助位" />
            <button
              className="btn ghost"
              style={{ alignSelf: "flex-start", height: 30, fontSize: 12, marginTop: 4 }}
              onClick={() => {
                writeSponsorHidden(!sponsorHidden);
                setSponsorHidden(!sponsorHidden);
              }}
            >
              {sponsorHidden ? "重新显示赞助卡" : "隐藏赞助卡"}
            </button>
          </div>
        </div>

        <div className="card flat c6">
          <div className="card-title">关于</div>
          <p style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.8 }}>
            Olivia ComfyUI 启动器 · v0.1.0a1（M1.1a · alpha 发行）
            <br />
            数据全部来自本机 Olivia Core（127.0.0.1），不经过任何外部服务。
            <br />
            开源协议 GPL-3.0 · 非 ComfyUI 官方产品
          </p>
        </div>
      </div>
    </section>
  );
}

function Setting({ label, tag }: { label: string; tag: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{label}</span>
      <span className="tag">{tag}</span>
    </div>
  );
}
