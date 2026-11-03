// localStorage 约定（ADR-0001）：启动器所有 key 一律 olivia. 前缀
const SPONSOR_KEY = "olivia.sponsor.hidden";

export function readSponsorHidden(): boolean {
  try {
    return localStorage.getItem(SPONSOR_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSponsorHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(SPONSOR_KEY, "1");
    else localStorage.removeItem(SPONSOR_KEY);
  } catch {
    // 同上：隐私模式下静默降级为仅本次会话生效
  }
}
