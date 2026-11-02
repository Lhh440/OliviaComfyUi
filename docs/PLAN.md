# Olivia ComfyUI 启动器 · M1 技术方案

> 本文只写**决定架构的判断**和**踩过坑的地方**，不写代码清单。
> 版本基准：ComfyUI master（`comfy/cli_args.py`，2026-11）、uv 0.9.x、Tauri 2。

---

## 0. 一句话架构

```
┌──────────────────────────── Tauri 2 窗口（WebView2）────────────────────────────┐
│  React 19 前端  ── HTTP/WS ──▶  Olivia Core (Python, 127.0.0.1:PORT)            │
│                                  ├─ 部署引擎（uv / git / pip / 镜像）             │
│                                  ├─ 进程守护（启动/停止/健康检查/日志）            │
│                                  ├─ NVML 采集 + 队列事件 → 归因                  │
│                                  └─ 资产索引（产物目录 / 缩略图 / 元数据）         │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │ 子进程
                                        ▼
                              ComfyUI（每实例一个 venv + 一个端口）
```

**为什么核心逻辑放 Python 而不是 Rust**：ComfyUI 是 Python 项目，环境问题的 90% 发生在 pip/torch/CUDA 层。用 Python 写核心，可以直接 `import torch` 自检、复用 `venv`/`importlib.metadata`，还能在启动前跑一次"能不能出图"的探针。用 Rust 重写这些只会把问题变成 FFI 问题。

**为什么前端只走 HTTP 而不走 Tauri IPC**：这是"先 Web 后桌面"能成立的前提。前端代码里没有任何 `import { invoke } from '@tauri-apps/api'` 的业务调用，全部走 `fetch`。Tauri 只做窗口/托盘/单实例/文件对话框/自动更新。→ 浏览器里 `pnpm dev` 就是完整的 Web 版；打包只是换壳。

**代价**：本地要开一个 HTTP 服务端口。必须做 token 鉴权 + 只绑 `127.0.0.1` + 拒绝非本机 Origin，否则局域网任意网页都能打你的启动器。

---

## 1. 一键部署引擎

### 1.1 磁盘布局

```
<数据根>（默认 %LOCALAPPDATA%\OliviaComfyUI，可改）
├─ config.json              # 全局设置
├─ db.sqlite                # 实例 / 产物 / 工作流索引
├─ cache/
│  ├─ downloads/            # 安装包、whl、git 包
│  └─ uv-python/            # uv 托管的 CPython
├─ instances/
│  └─ <id>/                 # 一个 ComfyUI 实例
│     ├─ ComfyUI/           # 仓库（--base-directory 指向这里）
│     ├─ .venv/             # 独立虚拟环境
│     ├─ user/              # --user-directory
│     ├─ extra_model_paths.yaml
│     └─ instance.json      # 版本、端口、启动参数、指纹
├─ logs/<id>-<ts>.log
└─ shared/                  # 可选的共享模型目录

<资产根>（用户指定，必填）    # --output-directory 指向这里
```

**为什么每实例独立 venv**：torch 版本冲突是 ComfyUI 生态的头号事故源。一个 venv 3–6 GB，看起来浪费，但 uv 的全局硬链接缓存让第二个实例的 torch 只是硬链接，实际增量 ≈ 几百 MB。用 `UV_LINK_MODE=hardlink`（Windows 上 `clone` 亦可）。

### 1.2 安装流水线（8 步，带真实进度权重）

| # | 步骤 | 权重 | 失败常见原因 |
|---|---|---|---|
| 1 | 环境探测（CPU/GPU/驱动/磁盘/网络） | 3% | 驱动过旧 |
| 2 | 准备 uv + 目标 CPython | 8% | 镜像不可达 |
| 3 | 创建 venv | 3% | 杀软锁文件 |
| 4 | 拉取 ComfyUI 仓库（指定 ref） | 15% | GitHub 被墙 / 浅克隆失败 |
| 5 | 安装 torch（CUDA 版本） | **45%** | 轮子不匹配、空间不足 |
| 6 | 安装 requirements | 15% | 编译依赖、镜像缺包 |
| 7 | 前端资源落地 | 6% | 见 §1.4 的坑 |
| 8 | 冒烟测试（起服务 + `/object_info`） | 5% | 端口占用、缺模型 |

**进度必须是真实事件驱动**，不是定时器。每个步骤通过 `asyncio.Queue` 往 WebSocket 推 `{step, phase, done, total, bytes, speed, eta}`。第 5 步解析 uv 的 stderr 行（`Downloading torch (2.4GiB)`）拿到总大小算 ETA；拿不到就显示"已下载 1.2 GB"，绝不伪造百分比。

**断点续传**：git 用 `--depth 1 --filter=blob:none` 浅克隆；pip/uv 天然有 wheel 缓存；下载器走 `Range` 请求。中断后从"最后一个未完成步骤"继续，而不是从头再来。

### 1.3 镜像与源（国内优先，可切回官方）

| 资源 | 默认（国内） | 回退 |
|---|---|---|
| ComfyUI 仓库 | `cnb.cool` / `gitee.com/mirrors` 镜像 | ghproxy 前缀 → 直连 GitHub |
| CPython | `UV_PYTHON_INSTALL_MIRROR` 指向 python-build-standalone 镜像 | astral 官方 |
| PyPI | `UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple` | 阿里云 → 官方 |
| torch | 清华/阿里 pytorch 源（`+cu124` 等索引） | `download.pytorch.org` |
| 模型 | `HF_ENDPOINT=https://hf-mirror.com`、ModelScope | HF 官方 |

**实现要点**：镜像不是硬编码，是一张 `mirrors.json` 表（含测速结果），首次启动跑一次 200ms 的 HEAD 探测，自动选最快的，并允许用户手动锁定。**所有源必须可切回官方**——这是开源项目的基本礼貌，也是企业内网用户的前提。

### 1.4 三个必须提前知道的坑

1. **`--front-end-version` 默认值是 `comfyanonymous/ComfyUI@latest`**，ComfyUI 启动时会去 GitHub Releases 拉前端包。国内网络下这会表现为"服务起来了但页面白屏"。→ 启动器必须显式传 `--front-end-root <本地目录>`，前端包由我们随 ComfyUI 版本一起缓存。这是"能不能开箱即用"的分水岭。

2. **`--output-directory` 已存在**，不用自己打补丁。但它只影响新产物，历史产物仍在实例目录 → 切换资产目录时要提示"是否迁移历史产物"。

3. **`--enable-manager` 现在是 ComfyUI 内置 flag**（不再必须装 custom_nodes）。默认开 `--enable-manager` 能省掉"装 Manager"这一整类新手事故，但要接受它联网。给用户一个开关。

### 1.5 兼容矩阵（不是所有组合都能装）

启动器内置一张 `compat.json`：`GPU 架构 → 推荐 torch → 推荐 CUDA → 推荐启动参数`。

- 30/40/50 系 N 卡 → cu124 / cu128 + `--fp16-unet`
- 20 系 / 老驱动 → cu121
- 显存 < 8 GB → 默认追加 `--lowvram --reserve-vram 1.0`
- AMD (Windows) → 走 DirectML，明确标注"慢 3–5 倍"
- Apple Silicon → MPS
- 无独显 → 明确劝阻，但仍允许 CPU 模式（并显示"单图 10 分钟+"）

**自检报告**：部署完成后生成一张可复制的诊断卡（OS / 驱动 / CUDA / torch / 显存 / 端口 / 缺失模型）。这是 Issue 模板的刚需。

---

## 2. 进程守护

- 用 `CREATE_NO_WINDOW` + 独立进程组启动，避免控制台黑框；退出时先 `CTRL_BREAK` 再 `taskkill /T`，防止僵尸 worker。
- **健康检查**：轮询 `GET /system_stats` 直到 200，超时 120s（首次启动加载模型可能很慢），期间显示"正在加载节点…"。
- **日志**：stdout/stderr 逐行落盘 + 内存环形缓冲（最近 2000 行）供界面实时滚动；用正则识别关键事件：
  - `Traceback` → 崩溃
  - `torch.OutOfMemoryError` / `CUDA out of memory` → OOM
  - `Prompt executed in` → 完成，带耗时
  - `got prompt` → 开始
- **OOM 自愈**：捕获到 OOM 后，记录当次工作流与显存峰值，提供三键修复：降分辨率 / 换 fp8 / 加 `--lowvram`。不做静默重启（会丢队列）。
- **端口管理**：从 8188 起找第一个空闲端口，实例间不冲突；端口写回 `instance.json`。

---

## 3. 硬件看板与"每条工作流的占用"

### 3.1 采集

- **NVIDIA**：`pynvml`（`nvmlDeviceGetUtilizationRates` / `MemoryInfo` / `Temperature` / `PowerUsage` / `FanSpeed`）。**500ms 一次**，比 `nvidia-smi` 子进程快两个数量级，也不会有控制台闪烁。
- **降级**：无 NVML → `torch.cuda.mem_get_info` 轮询（只在 ComfyUI 进程内可用）→ 再降级为只有系统内存/磁盘。**永远不假装有数据**，UI 显示"该指标不可用"。
- **系统层**：`psutil` 拿 CPU / RAM / 磁盘 IO。
- **推送**：WebSocket，1s 一帧（前端再插值），环形缓冲保留 10 分钟用于画曲线。

### 3.2 归因（关键设计，且必须诚实）

进程级 API 拿不到"某条工作流占多少显存"。两条路：

**A. 时间窗口归因（M1 默认）**
订阅 ComfyUI 的 `/ws` 事件流：`execution_start`（prompt_id）→ `executing`（node）→ `execution_success`。
把这段时间内的 NVML 采样归到该 prompt_id，产出：**峰值显存 / 平均利用率 / 峰值温度 / 耗时 / 每节点耗时**。
UI 上必须标注"峰值含模型常驻与上下文开销"，并且明确这是**区间归因**不是**精确计量**。

**B. 进程隔离（M1.5 实验项）**
每个工作流起独立 ComfyUI 进程 → PID ↔ 显存精确对应，但冷启动 +8~15 s。只对"批量跑图 + 需要精确账单"的场景有价值，做成开关。

**额外收益**：`executing` 事件带节点名，可以直接做"当前跑到 KSampler 第 12/20 步"，这比 GPU 曲线有用得多。

---

## 4. 资产库

- **强约束**：未指定资产目录时，全局横幅 + 资产页空态，禁止静默写默认路径。文案要写清楚后果。
- **索引**：`watchdog` 监听产物目录，新文件入库（路径、大小、mtime、宽高、prompt_id）。
- **反向关联**：ComfyUI 保存的 PNG 里带 `tEXt` 块（`prompt` / `workflow`）。解析出来 → 产物能直接"用此工作流再跑一次"，还能显示用了哪个 checkpoint / LoRA / seed。这是启动器相对网页端最有价值的差异点之一。
- **缩略图**：后台生成 256px webp，列表用虚拟滚动，千级文件不卡。
- **去重**：按 `sha256`（或 ComfyUI 的 `--enable-asset-hashing` 产出的 blake3）识别重复产物。
- **模型库**：扫描 `models/*`，按目录归类；工作流缺模型时给出精确缺失清单 + 下载入口（HF 镜像）。

---

## 5. 安全

| 面 | 措施 |
|---|---|
| 本地服务 | 只绑 `127.0.0.1`；随机端口；启动时生成一次性 token，前端通过 `window.__OLIVIA_BOOT__` 注入；校验 `Origin`/`Sec-Fetch-Site` |
| 路径 | 所有用户路径 `Path.resolve()` 后校验在允许根内；拒绝 `..`；Windows 保留名（CON/PRN） |
| 子进程 | 参数数组传递，绝不拼 shell 字符串；git ref / 端口做白名单校验 |
| 插件 | custom_nodes 是任意代码执行。安装前显示"该节点会执行任意代码"，默认不自动安装 |
| 更新 | Tauri updater 签名校验，公钥内置 |

---

## 6. 画布接入方案（已拍板：同源嵌入 + 主题注入）

ComfyUI 前端（`ComfyUI_frontend`）是十万行级的图编辑器：节点渲染、连线命中、撤销栈、子图、虚拟化、扩展 API。**M1 从零重写等于重做一个 ComfyUI，必然失败。**

分三层推进（详见 ADR-0002）：

- **M1：外壳重构 + 同源嵌入**。启动器自己实现实例/队列/硬件/资产/设置五页（这些是 ComfyUI 网页端根本没有的）。画布同源嵌入并注入主题，让它"看起来是启动器的一部分"。
- **M1.6：画布增强**。注入脚本：快捷键接管、拖拽产物到画布、节点搜索中文化、显存预估。
- **M2：自研编辑器**。只覆盖高频 20% 节点，复杂工作流仍回退嵌入画布。双模式并存。

### 6.1 嵌入的技术路线（关键，已查证）

**不能用子路径反代。** 查证结果：

| 事实 | 影响 |
|---|---|
| aiohttp 路由全部注册在根路径（`/ws`、`/view`、`/object_info`、`/api/jobs`） | 后端无 basePath，无法整体挂前缀 |
| `web.static('/', self.web_root)` | 静态服务同样吃根路径 |
| 前端 `base: ''`（相对），但运行时 API 调用是绝对根路径 | 资源能搬，API 不能搬 |

因此采用**路径命名空间合并**（详见 ADR-0001）：

```
启动器 127.0.0.1:<port>
├─ /              → Olivia 前端
├─ /assets/*      → Olivia 资源
├─ /api/*         → Olivia 本地服务（优先级最高）
├─ /comfy/*       → 反代到 ComfyUI 实例，HTML 内相对资源改写为 /comfy/...
└─ /ws            → 启动器持有的 WebSocket（同源，无需跨域鉴权）
```

**三个必须处理的副作用**：

1. `/api/*` 命名空间冲突 —— 启动器优先匹配，ComfyUI 的走 `/comfy/api/*`，需集成测试
2. localStorage 同源共享 —— 启动器所有 key 加 `olivia.` 前缀
3. 反代必须正确透传 `Upgrade` 头，否则 ComfyUI 的 `/ws` 进度推送失效

**主题注入的两条路径**（都要用）：

- `user.css`：ComfyUI 前端原生支持，覆盖配色变量最稳妥
- 注入脚本：隐藏原生顶栏/侧栏、接管快捷键、做 DOM 级改造

注入脚本必须做**特性检测**：上游改版导致选择器失效时，降级为原生外观，绝不能白屏。

如果目标就是"完全自研、不依赖官方前端"，那是一个 6–12 人月的工作量，需单独排期。

---

## 7. M1 里程碑拆分

仅 Windows（见 ADR-0006）。

| 版本 | 内容 | 验收标准 |
|---|---|---|
| M1.0 | 设计系统、启动动效、主界面外壳 | 视觉原型通过评审；页面骨架可点 |
| M1.1 | 部署引擎 + 进程守护 | 空机器 → 点一次 → 出图，全程无终端 |
| M1.2 | 硬件看板 + 归因 | 跑一条工作流能看到峰值显存与节点耗时 |
| M1.3 | 资产库 + 反向关联 | 产物目录必填；PNG → 一键重跑 |
| M1.4 | 画布同源嵌入 + 主题注入 | `/comfy/` 下跑通完整工作流，启动器 `/api/*` 未被污染 |
| M1.5 | 打包更新 | 安装包 ≤ 60 MB（含 Python 运行时），自动更新可用 |
| M1.6 | 画布增强 + 隔离模式 | 快捷键/拖拽生效；精确计量可选 |

---

## 8. 主要风险

| 风险 | 影响 | 对策 |
|---|---|---|
| GitHub / HF 国内不稳 | 部署失败率 | 多镜像 + 测速 + 手动兜底 + 离线包导入 |
| torch 轮子组合爆炸 | 装完不能跑 | 兼容矩阵 + 装后冒烟测试 + 一键换 torch |
| NVML 归因被质疑不准 | 信任崩塌 | 明确标注口径，提供隔离模式 |
| ComfyUI 上游破坏性变更 | 启动器失效 | 锁版本 + CI 每日跑冒烟测试 + 参数白名单 |
| 前端 HTML 结构变更导致注入失效 | 主题/布局错乱 | 特性检测 + 降级为原生外观，绝不白屏 |
| `/api/*` 命名空间冲突 | 启动器接口被 ComfyUI 抢 | 路由优先级 + 集成测试 |
| 全自研编辑器范围失控 | 项目烂尾 | 双模式并存，M1 不碰编辑器核心 |
