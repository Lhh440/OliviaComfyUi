## 变更说明

## 关联 Issue

<!-- 架构类变更请先在 Issue 讨论（见 docs/ADR.md） -->

## 文档同步

- [ ] README / PLAN / DESIGN / ADR 已随行为变更更新（不涉及可勾选并注明）

## 自查清单（与 AGENTS.md 一致）

- [ ] 新增用户可见功能包含加载态、空态、错误态
- [ ] localStorage key 以 `olivia.` 前缀
- [ ] 自绘图形只用四档线宽 0.38 / 1.12 / 2.28 / 3.80
- [ ] 硬件指标拿不到时显示「不可用」，不用 0 或估算值
- [ ] 子进程用参数数组传递，不拼 shell 字符串
- [ ] 用户路径 resolve 后校验在允许根内
- [ ] 前端无 `@tauri-apps/api` 业务调用（窗口控制除外）
- [ ] 文案中文为主，术语保留英文（CUDA / VRAM / KSampler）
- [ ] 若改配色：已附对比度计算结果（CI `check_contrast` 同步执行）
- [ ] 未提交任何密钥、token、本地路径
