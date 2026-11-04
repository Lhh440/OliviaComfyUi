import { useState } from "react";

// 资产目录选择：桌面端原生文件夹对话框属 Tauri 壳（M1.4），此前用路径输入，
// 提交后由 Core 校验（存在 + 是目录），非法路径的错误信息会回显。
export function AssetPathInput({
  current,
  onSave,
  busy,
}: {
  current: string | null;
  onSave: (path: string | null) => void;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState(current ?? "");

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        className="path-input num"
        style={{ flex: "1 1 260px", width: "auto" }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="例如 D:\\AI\\ComfyOutput"
        spellCheck={false}
      />
      <button
        className="btn primary"
        style={{ height: 30, fontSize: 12 }}
        disabled={busy || draft.trim() === ""}
        onClick={() => onSave(draft.trim())}
      >
        {busy ? "保存中…" : "保存"}
      </button>
      {current !== null && (
        <button className="btn ghost" style={{ height: 30, fontSize: 12 }} disabled={busy} onClick={() => onSave(null)}>
          清除
        </button>
      )}
    </div>
  );
}
