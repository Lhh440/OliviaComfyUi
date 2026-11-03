import { PageHead } from "../components/states";

// M1.3 接入真实扫描前的静态示例；结构按 PLAN §4 模型库设计
export function ModelsPage() {
  return (
    <section className="page active">
      <PageHead page="models" />
      <div className="grid">
        <div className="card c12">
          <div className="card-title">
            <span>checkpoints</span>
            <span className="more">3 个 · 12.4 GB</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: "44%" }}>文件名</th>
                <th>大小</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono" style={{ fontSize: "11.5px" }}>sd_xl_base_1.0.safetensors</td>
                <td className="mono">6.5 GB</td>
                <td><span className="pill run">可用</span></td>
              </tr>
              <tr>
                <td className="mono" style={{ fontSize: "11.5px" }}>flux1-dev-fp8.safetensors</td>
                <td className="mono">11.9 GB</td>
                <td><span className="pill run">可用</span></td>
              </tr>
              <tr>
                <td className="mono" style={{ fontSize: "11.5px" }}>olive_style_v2.safetensors</td>
                <td className="mono">2.1 GB</td>
                <td><span className="pill bad">缺失</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card flat c12">
          <div className="card-title">缺失依赖</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: "12.5px", marginBottom: 2 }}>
                <code className="num" style={{ fontSize: "11.5px" }}>olive_style_v2.safetensors</code>
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>被 2 个工作流引用：olive_portrait_v3、olive_landscape</div>
            </div>
            <button className="btn" style={{ height: 32, fontSize: "12.5px" }}>从 HF 镜像下载</button>
            <button className="btn ghost" style={{ height: 32, fontSize: "12.5px" }}>手动指定路径</button>
          </div>
        </div>
      </div>
    </section>
  );
}
