import { PAGE_META } from "../state";
import type { PageKey } from "../state";

export function PageHead({ page }: { page: PageKey }) {
  const meta = PAGE_META[page];
  return (
    <div className="page-head">
      <h1>{meta.title}</h1>
      <span className="hint">{meta.hint}</span>
    </div>
  );
}

// AGENTS.md：新增用户可见功能必须包含加载态、空态、错误态
export function Loading({ text = "加载中…" }: { text?: string }) {
  return <div className="loading">{text}</div>;
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flat c12">
      <div className="card-title">加载失败</div>
      <div style={{ fontSize: "12.5px", color: "var(--danger)", marginBottom: 10 }}>{message}</div>
      <button className="btn" style={{ height: 30, fontSize: 12 }} onClick={onRetry}>
        重试
      </button>
    </div>
  );
}
