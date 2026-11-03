<div align="center">

# Olivia ComfyUI 启动器

**把 ComfyUI 的部署、运行、监控、产物管理收进一个客户端。**

Olivia = 橄榄树。启动即生长，长成即工作。

[![status](https://img.shields.io/badge/status-M1%20%E8%AE%BE%E8%AE%A1%E9%98%B6%E6%AE%B5-5C6B39?style=flat-square)](#m1-目标)
[![platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-23261C?style=flat-square)](#系统要求)
[![license](https://img.shields.io/badge/license-GPL--3.0-5C6B39?style=flat-square)](LICENSE)
[![afdian](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-%E8%B5%9E%E5%8A%A9-C09A46?style=flat-square)](https://ifdian.net/)

</div>

---

## 这是什么

ComfyUI 是当前最强的节点式图像生成前端，但它的开箱体验几乎为零：装 Python、装 CUDA 版 torch、克隆仓库、拉模型、改端口、刷新网页、找不到产物在哪、爆显存后不知道原因。

**Olivia ComfyUI 启动器**是一款免费、开源的第三方 ComfyUI 桌面客户端，目标只有一个：**让 ComfyUI 点开即用**。

- 不是 ComfyUI 官方产品，不隶属、不代表、不替代官方项目
- 不修改 ComfyUI 源码，只做**环境、进程、数据、界面外壳**四件事
- 前端先做 Web，再套桌面壳；同一套界面代码在浏览器和桌面端完全复用

---

## M1 目标

| # | 能力 | 用户可见的结果 |
|---|------|----------------|
| 1 | **一键本地部署** | 运行环境自动准备，真实进度条 + 分步日志，可自定义 ComfyUI 版本与 torch/CUDA 组合 |
| 2 | **重新设计的图形界面** | 不用再对着浏览器标签页，实例/队列/硬件/产物/设置一体化 |
| 3 | **实时硬件看板** | GPU 利用率、显存、温度、功耗、风扇，以及**每条工作流的资源占用归因** |
| 4 | **资产目录** | 产物统一落在你指定的位置；未指定时界面明确提示，不静默丢失 |
| 5 | **启动动效** | 量化线场绘制的橄榄树随真实加载进度向上生长，可用鼠标拨动线条，加载完成自然过渡到主界面 |
| 6 | **四套主题** | 石墨靛（默认）/ 暗房琥珀 / 瓷白朱砂 / 深青仪表，即时切换；配色服务于"让作品突出、让数据可读" |

M1 之外的补充能力：队列中心、OOM 自愈建议、环境自检报告、产物 ↔ 工作流反向关联（从 PNG 读回 workflow 一键重跑）、模型缺失检查。

---

## 技术选型

| 层 | 选择 | 理由 |
|----|------|------|
| 桌面壳 | **Tauri 2**（Rust） | 体积小、内存低、进程与文件权限可控；WebView2 系统自带，不打包 Chromium |
| 前端 | **React 19 + TypeScript + Vite + Tailwind** | 生态成熟，便于"先 Web 后桌面" |
| 本地服务 | **Python 3.12 + FastAPI + WebSocket** | ComfyUI 本身是 Python，venv/pip/进程管理天然同语言，硬件采集有 pynvml / psutil |
| Python 环境 | **uv** | 毫秒级解析、内置 CPython 下载、全局硬链接缓存（多实例共用一份 torch） |
| 渲染 | **Canvas 2D** | 启动动效零依赖，不引入动画库 |

**两条架构铁律**：

1. 前端与本地服务之间**只走 `127.0.0.1` 上的 HTTP + WebSocket**，不走 Tauri IPC 传业务数据 —— 这是"先 Web 后桌面"能成立的前提
2. 画布走**路径命名空间合并**的同源嵌入，不做子路径反代 —— ComfyUI 的 API 全部是根路径绝对地址，反代必 404

---

## 文档

| 文档 | 内容 |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | M1 技术方案：部署流水线、镜像策略、进程守护、硬件归因、资产库、画布接入 |
| [docs/DESIGN.md](docs/DESIGN.md) | 设计语言：四套主题与用色纪律、令牌、四档线宽、启动动画完整参数、主界面与状态设计 |
| [docs/ADR.md](docs/ADR.md) | 架构决策记录：每条已拍板判断的**理由与代价** |

新贡献者建议按 `ADR → PLAN → DESIGN` 顺序读。

---

## 仓库结构（规划）

```
OliviaComfyUi/
├─ apps/
│  ├─ web/               # React 前端（同时也是桌面端界面）
│  └─ desktop/           # Tauri 2 壳：窗口 / 托盘 / 单实例 / 自动更新
├─ services/
│  └─ core/              # Python 本地服务：部署引擎 / 进程守护 / NVML 采集 / 资产索引
├─ packages/
│  └─ design/            # 设计令牌：橄榄 + 量化线场
├─ docs/                 # PLAN / DESIGN / ADR
└─ README.md
```

---

## 路线图

| 版本 | 内容 |
|---|---|
| M1.0 | 设计系统、启动动效、主界面外壳 |
| M1.1 | 部署引擎 + 进程守护 |
| M1.2 | 硬件看板 + 工作流归因 |
| M1.3 | 资产库 + 反向关联 |
| M1.4 | 画布同源嵌入 + 主题注入 |
| M1.5 | 打包与自动更新 |
| M1.6 | 画布增强 + 进程隔离计量 |
| M2 | 自研节点编辑器（覆盖高频 20% 节点）、模型市场、兼容矩阵推荐 |

---

## 系统要求

- **Windows 10 1809+ / Windows 11，x64**
- NVIDIA 显卡需驱动 522+（CUDA 12 系列）
- 磁盘：ComfyUI 本体 + 单个 torch 环境约 8–12 GB；模型另计
- M1 **不支持** macOS 与 Linux（见 ADR-0006）

---

## 赞助

如果这个项目帮你省下了半天折腾环境的时间：

- **爱发电**：<https://ifdian.net/>（发布前替换为真实 ID）
- **赞助商位**：总览页底部一个 + 侧栏一个，均可在设置中关闭

赞助不换取任何功能，没有付费墙，不影响开源许可。项目以 GPL-3.0 开放，任何人可 fork 自建。

---

## 参与贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。提交前请先读 [ADR](docs/ADR.md)，已拍板的架构决策请在 Issue 里讨论而不是直接改代码。提交 Issue 请使用模板（Bug 请附环境自检报告）；CI 会自动检查文档 BOM、内链与主题对比度。

---

## 许可证与声明

- 本项目采用 [GPL-3.0](LICENSE)。因为它调用/分发 ComfyUI（GPL-3.0），这是最省心的合规路径。
- ComfyUI 版权归其作者所有；本启动器仅作为独立客户端调用其公开接口与命令行参数。
- 生成内容的合规与版权责任由使用者承担。
