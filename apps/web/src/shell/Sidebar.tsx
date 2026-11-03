import { useApp, PAGE_META, PAGE_ORDER } from "../state";

export function Sidebar() {
  const { page, navigate } = useApp();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">OLIVIA</div>
        <div className="sub">ComfyUI 启动器</div>
      </div>
      <nav className="nav">
        {PAGE_ORDER.map((key, i) => (
          <button
            key={key}
            aria-current={page === key ? "page" : "false"}
            onClick={() => navigate(key)}
          >
            <span className="idx">{i + 1}</span>
            {PAGE_META[key].title}
          </button>
        ))}
      </nav>
      <div className="side-foot">
        <a className="sponsor-side" href="#" onClick={(e) => e.preventDefault()}>
          <span className="dot" />
          爱发电支持
        </a>
        <div className="ver-line">
          <span>v0.1.0-m1</span>
          <span>GPL-3.0</span>
        </div>
      </div>
    </aside>
  );
}
