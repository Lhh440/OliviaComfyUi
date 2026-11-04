import { useCallback, useEffect, useState } from "react";
import { core } from "../api/http";
import type { AssetThumb } from "../api/types";
import { AbstractThumb, MiniTreeArt, seedFromFile } from "../components/art";
import { AssetPathInput } from "../components/AssetPathInput";
import { ErrorCard, Loading, PageHead } from "../components/states";
import { useApp } from "../state";

export function AssetsPage() {
  const { assetFolder, setAssetFolder } = useApp();
  const [assets, setAssets] = useState<AssetThumb[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

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
  }, [assetFolder, tick]);

  const save = useCallback(
    (path: string | null) => {
      setBusy(true);
      setError(null);
      core
        .setAssetFolder(path)
        .then(() => setAssetFolder(path))
        .catch((err: unknown) => setError(String(err)))
        .finally(() => setBusy(false));
    },
    [setAssetFolder],
  );

  return (
    <section className="page active">
      <PageHead page="assets" />
      <div className="grid">
        {error && <ErrorCard message={error} onRetry={() => setTick((t) => t + 1)} />}

        {assetFolder !== null && (
          <div className="card flat c12">
            <div className="card-title">
              <span>当前资产目录</span>
              <span className="more">{assets === null ? "…" : `${assets.length} 个文件`}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <code className="num" style={{ fontSize: 12, background: "var(--bg2)", padding: "7px 11px", borderRadius: 8, border: "1px solid var(--line)", alignSelf: "flex-start" }}>
                {assetFolder}
              </code>
              <AssetPathInput current={assetFolder} onSave={save} busy={busy} />
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
            <div style={{ width: "min(420px, 100%)" }}>
              <AssetPathInput current={null} onSave={save} busy={busy} />
            </div>
          </div>
        ) : assets === null ? (
          <div className="card c12">
            <Loading />
          </div>
        ) : (
          <div className="card flat c12">
            <div className="card-title">
              <span>最近产物</span>
              <span className="more">按时间倒序 · 上限 200 个</span>
            </div>
            {assets.length === 0 ? (
              <div className="loading">目录已就绪，还没有产物。生成第一张图后这里会自动出现。</div>
            ) : (
              <div className="thumbs">
                {assets.map((a) => (
                  <div className="thumb" key={a.file} title={`${a.mtime}`}>
                    <AbstractThumb seed={seedFromFile(a.file)} />
                    <div className="cap">
                      {a.file} · {a.sizeMb} MB
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
