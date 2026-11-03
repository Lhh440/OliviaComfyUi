import { useEffect, useState } from "react";
import { core } from "../api/mock";
import type { AssetThumb } from "../api/types";
import { AbstractThumb, MiniTreeArt } from "../components/art";
import { ErrorCard, Loading, PageHead } from "../components/states";
import { useApp } from "../state";

export function AssetsPage() {
  const { assetFolder, setAssetFolder } = useApp();
  const [assets, setAssets] = useState<AssetThumb[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ADR-0008：未指定目录时整页空态 + 直达选择器，绝不静默写默认路径
  useEffect(() => {
    if (!assetFolder) {
      setAssets(null);
      return;
    }
    setError(null);
    core
      .listAssets()
      .then(setAssets)
      .catch((err: unknown) => {
        setAssets([]);
        setError(String(err));
      });
  }, [assetFolder]);

  return (
    <section className="page active">
      <PageHead page="assets" />
      <div className="grid">
        {error && <ErrorCard message={error} onRetry={() => setAssetFolder(assetFolder)} />}

        {assetFolder !== null && (
          <div className="card flat c12">
            <div className="card-title">
              <span>当前资产目录</span>
              <span className="more">{assets === null ? "…" : `${assets.length} 个文件`}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <code className="num" style={{ fontSize: 12, background: "var(--bg2)", padding: "7px 11px", borderRadius: 8, border: "1px solid var(--line)" }}>
                {assetFolder}
              </code>
              <button className="btn ghost" style={{ height: 30, fontSize: 12 }} onClick={() => setAssetFolder("F:\\AI\\ComfyOutput")}>
                更换目录
              </button>
              <span className="st ok" style={{ fontSize: "11.5px" }}>
                <i />
                监听中
              </span>
            </div>
          </div>
        )}

        {assetFolder === null ? (
          <div className="empty">
            <MiniTreeArt w={180} h={120} seed={91} />
            <h3>还没有指定资产存放位置</h3>
            <p>
              未指定时，产物只会留在实例目录内部。重装、迁移或清理缓存后，这些文件会很难再被找到。
              <br />
              建议选择一个独立磁盘上的文件夹。
            </p>
            <button className="btn primary" onClick={() => setAssetFolder("E:\\ComfyOutput")}>
              选择文件夹
            </button>
          </div>
        ) : assets === null ? (
          <div className="card c12">
            <Loading />
          </div>
        ) : (
          <div className="card flat c12">
            <div className="card-title">
              <span>最近产物</span>
              <span className="more">按时间倒序 · 悬停查看来源</span>
            </div>
            {assets.length === 0 ? (
              <div className="loading">目录已就绪，还没有产物。生成第一张图后这里会自动出现。</div>
            ) : (
              <div className="thumbs">
                {assets.map((a) => (
                  <div className="thumb" key={a.file}>
                    <AbstractThumb seed={a.seed} />
                    <div className="cap">
                      {a.file} · {a.workflow}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
