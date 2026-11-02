# 参与贡献

感谢愿意花时间。这个项目的第一原则是**不骗用户**：不做漂亮但错误的数字，不做静默兜底，不把没验证的结论写进文档。

## 先读什么

1. [docs/ADR.md](docs/ADR.md) —— 已拍板的架构决策，含理由与代价。**想改结论请开 Issue，不要直接改代码。**
2. [docs/PLAN.md](docs/PLAN.md) —— M1 技术方案
3. [docs/DESIGN.md](docs/DESIGN.md) —— 设计语言，改动 UI 前必读

## 环境准备

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | 20 LTS+ | 前端构建 |
| pnpm | 9+ | 包管理 |
| Rust | stable + MSVC 工具链 | Tauri 桌面壳 |
| Python | 3.12 | 本地服务 |
| uv | 最新 | Python 环境管理 |

```powershell
pnpm install
pnpm --filter web dev        # 前端（浏览器即可，完整 Web 版）
pnpm --filter core dev       # 本地服务
pnpm --filter desktop dev    # 桌面壳
```

前端在浏览器里就能完整跑通，不需要编译 Rust。这是刻意的设计（见 ADR-0004）。

## 提交规范

采用 Conventional Commits：

```
feat(web): 总览页增加 OOM 自愈建议卡片
fix(core): 修正端口探测在 TIME_WAIT 状态下的误判
docs(adr): 补充画布注入的降级策略
```

scope 取值：`web` / `desktop` / `core` / `design` / `docs` / `ci`

## 代码约定

### 通用

- 注释写**为什么**，不写**是什么**。`// 这里加 1` 没有价值
- 不引入新的重量级依赖前先开 Issue 说明理由
- 所有用户可见文案中文为主，术语保留英文（CUDA / VRAM / KSampler）

### 前端

- 不写 `@tauri-apps/api` 的业务调用（窗口控制除外）
- 所有 localStorage key 以 `olivia.` 前缀
- 自绘图形只允许四档线宽（0.38 / 1.12 / 2.28 / 3.80）
- 新增页面必须实现：加载态、空态、错误态、无权限/未配置态

### 本地服务（Python）

- 所有子进程用参数数组传递，**绝不拼 shell 字符串**
- 所有用户路径 `Path.resolve()` 后校验在允许根内
- 新增对外接口必须带 token 校验
- 长任务必须可取消，并向前端推送真实进度（不允许伪造百分比）

### 硬件指标

- 拿不到的指标显示"不可用"，**不允许填 0 或估算值冒充真实值**
- 归因数据必须同时展示口径说明（见 ADR-0007）

## 测试要求

| 改动 | 最低要求 |
|---|---|
| 部署引擎 | 一条"空环境 → 能出图"的端到端测试 |
| 硬件采集 | 无 GPU 环境下的降级路径测试 |
| 画布嵌入 | 集成测试：`/comfy/` 下完整工作流 + 启动器 `/api/*` 未被污染 |
| 设计令牌 | 对比度检查（正文 ≥ 4.5:1） |

## 提交 PR 前自查

- [ ] 本地 `pnpm lint` 与 `pnpm typecheck` 通过
- [ ] 没有提交任何密钥、token、本地路径
- [ ] 新功能包含空态与错误态
- [ ] 文档与代码一致（改行为就改文档）
- [ ] 若改动了架构结论，已在 Issue 中达成一致并更新 ADR

## 关于 ComfyUI 上游

我们**不修改 ComfyUI 源码**。所有集成必须走官方公开接口：

- CLI 参数（见 `comfy/cli_args.py`）
- HTTP API（`/prompt`、`/queue`、`/history`、`/object_info`、`/view`）
- WebSocket（`/ws` 事件流）
- `custom_nodes` + `WEB_DIRECTORY` 扩展点
- `user.css`

如果某个需求只能靠改上游源码实现，那它大概率不该在 M1 做。

## 行为准则

- 对事不对人，不人身攻击
- 不歧视任何用户的硬件配置、技术水平或语言
- 不承诺做不到的事，包括排期

## 许可证

提交即表示你同意以 [GPL-3.0](LICENSE) 授权你的贡献。
