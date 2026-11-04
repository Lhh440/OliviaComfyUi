# M1.1 · 最小可用启动器 实施方案（第一阶段）

> 目标一句话：**界面从"演示"变成"可用"**——注册一个已有 ComfyUI 目录，点启动就真的跑起来，硬件看板显示真实 NVML 数据，队列页能看到 ComfyUI 的真实队列。
> 本方案是 [PLAN.md](PLAN.md) §1–§3 的第一阶段切片；完整部署流水线（uv + torch 下载）为 M1.1b，另行排期。

---

## 0. 范围

**范围内（M1.1a，本阶段）**

| 能力 | 用户可见结果 |
|---|---|
| 本地服务 Core | `services/core`：FastAPI，绑 `127.0.0.1`，令牌鉴权（ADR-0004 的安全清单全项落地） |
| 实例注册 | 指定已有 ComfyUI 目录 + Python 解释器 → 持久化到 `config.json` |
| 进程守护 | 启动（参数数组、`CREATE_NO_WINDOW`）/ 健康检查（轮询 `/system_stats`）/ 停止（`CTRL_BREAK` → `taskkill /T` 兜底）/ 日志环形缓冲 + 关键事件识别；实例并入 Job Object（KILL_ON_JOB_CLOSE），Core 优雅退出走 lifespan 停实例、被强杀/崩溃由系统回收，双路径均不产生孤儿 |
| 硬件看板 | pynvml 500ms 采样 + psutil；拿到的字段逐项可空，**拿不到显示「不可用」** |
| 队列 | 透传 ComfyUI `/queue`；已完成历史与节点级进度留给 M1.2（`/history` + `/ws` 事件） |
| 资产目录 | 真实设置、真实文件列表；未指定时空态（ADR-0008） |

**范围外（明确不做，防止范围失控）**

- 一键部署（git/uv/torch 流水线、镜像测速）→ M1.1b
- 画布同源嵌入与主题注入 → M1.4
- 归因（时间窗口计量）→ M1.2
- 缩略图 / PNG 反向关联 → M1.3

---

## 1. Core 架构

```
services/core/
├─ requirements.txt          fastapi / uvicorn / psutil / pynvml
├─ tests/fake_comfyui/       端到端验证夹具：一个响应 /system_stats 的最小 ComfyUI 替身
└─ olivia_core/
   ├─ __main__.py            python -m olivia_core → uvicorn
   ├─ config.py              数据根、core.json（端口+令牌）、config.json（实例/资产目录）
   ├─ security.py            令牌生成与校验、Origin 白名单
   ├─ proc.py                InstanceManager：子进程 + 健康线程 + 日志环形缓冲
   ├─ hw.py                  NVML 500ms 采样线程 + psutil
   └─ api.py                 路由
```

- **数据根**：`%LOCALAPPDATA%\OliviaComfyUI`（`OLIVIA_DATA_ROOT` 可覆盖）；`core.json` 记录 `{port, token, pid}` 供 Tauri 壳与 vite 代理读取
- **Core 端口**：默认 `8600`（`OLIVIA_CORE_PORT` 可覆盖）；**ComfyUI 实例端口**从 8188 起自动探测空闲
- **启动方式**：`python -m olivia_core`；venv 建在 `services/core/.venv`

### 1.1 API 表

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/health` | GET | 免鉴权探活（只返回 ok，不含敏感数据） |
| `/api/instance` | GET | `{deployed, running, status, port, path, python, pid, exitCode}` |
| `/api/instance/register` | POST | `{path, python}`：校验 `main.py` 存在、解释器可执行、路径 resolve + 保留名检查 |
| `/api/instance/start` `/stop` | POST | 409 冲突语义；start 返回所选端口 |
| `/api/checklist` | GET | 环境自检项（Python / 实例 / 端口 / NVML / 资产目录） |
| `/api/hardware` | GET | 最新一帧采样（字段可空） |
| `/api/ws/hardware` | WS | 1s 一帧推送；令牌走 query 参数 |
| `/api/logs` | GET | 日志环形缓冲（最近 2000 行） |
| `/api/comfy/queue` | GET | 透传实例 `/queue`；未运行时返回空队列而非错误 |
| `/api/assets` | GET | 资产目录文件列表（png/webp/jpg/gif，按 mtime 倒序，上限 200） |
| `/api/disks` | GET | 数据根 / 资产目录 / 实例目录所在盘的占用 |
| `/api/settings/asset-folder` | GET/POST | 校验存在且为目录后持久化 |

### 1.2 安全（ADR-0004 清单逐项）

1. 只绑 `127.0.0.1`，绝不绑 `0.0.0.0`
2. 启动时生成一次性 token，写入 `core.json`（0600 语义由用户目录 ACL 承担）
3. 校验 `Origin`（仅允许 localhost/127.0.0.1 任意端口）；`/api/health` 免鉴权但零信息
4. 子进程一律参数数组；`taskkill` 也走 argv 数组，不拼 shell
5. 所有用户路径 `Path.resolve()` 后校验：绝对路径、存在、目录、Windows 保留名拒绝

### 1.3 前端接入

- `HttpCore` 实现 `CoreApi`，替换 mock 单例；mock 保留作演示实现
- vite dev 代理读 `core.json` 自动指向 Core 并注入令牌（`define` 注入 `__OLIVIA_CORE_TOKEN__` 供 WS query 使用）
- Core 不可达时：全局横幅「本地服务未连接」+ 各页错误态，**不降级到假数据**

---

## 2. 验收标准

| # | 验收 |
|---|---|
| 1 | `python -m olivia_core` 启动后，前端自动连上，横幅不出现 |
| 2 | 注册 fake ComfyUI（测试夹具）→ 点「启动」→ 状态点变呼吸绿 → `/api/instance.status == running` |
| 3 | 停止后进程树无残留（无僵尸 python） |
| 4 | 硬件页显示真实 NVML 数据；在无 NVML 环境显示「不可用」而非 0 |
| 5 | 未注册实例时实例页显示注册表单；资产目录未设置时资产页整页空态 |
| 6 | 无令牌请求全部 401；非 localhost Origin 全部 403 |
| 7 | `pnpm typecheck` 与 `pnpm build` 通过 |

---

## 3. 后续

- **M1.1b**：部署引擎（uv + 镜像测速 + torch 8 步流水线，PLAN §1.2–§1.5）
- **M1.2**：订阅实例 `/ws` 事件做归因；队列页接入节点级进度与 `/history`
- **M1.4**：画布同源嵌入（ADR-0001）
