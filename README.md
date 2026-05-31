<div align="center">

# 💬 WeChat Liberator(进行中 · 原 WeChat Markdown Exporter)

**让微信继续当渠道,你的阅读不再当人质。**

一个浏览器扩展。用户照常在微信 Web（公众号文章 + 合集/搜一搜 + 微信读书）上阅读,
插件在背后悄悄把数据复制一份到本地,
并提供搜索、导出、订阅、Obsidian 同步、Wayback 公共存证等出口 ——
**让你从微信「只能消费、无法拥有」的状态,回到「拥有、可携带、可连接」**。

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome-4285F4?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

</div>

---

## 🗺️ 项目愿景与路线图

本仓库目前的代码(单篇公众号文章 → Markdown)是整个项目的 **Act 1**。
完整规划已写入 [docs/](./docs/),按需展开:

| 文档 | 用途 |
|---|---|
| [docs/HANDOFF.md](./docs/HANDOFF.md) | **人类/agent 都先从这里开始** —— 30 秒了解项目、决策上下文、禁止事项 |
| [docs/IMPLEMENTATION_WORKFLOW.md](./docs/IMPLEMENTATION_WORKFLOW.md) | **远端 agent 执行入口** —— 从 GitHub 拉取后按 Gate 从头实现到尾 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 系统分层、技术选型、七条铁律、可做/不做边界 |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Act 1~5 的任务清单和退出标准 |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | IndexedDB schema + 导出 frontmatter 规范 |
| [docs/CAPTURE_SPEC.md](./docs/CAPTURE_SPEC.md) | 公众号、合集、搜一搜、Wayback、微信读书的抓取规格 / 反检测原则 |

**执行方式**:

```text
git clone https://github.com/Chrisyii/getwechatarticle.git
cd getwechatarticle
先读 docs/HANDOFF.md
再按 docs/IMPLEMENTATION_WORKFLOW.md 的 Gate 逐阶段实现
```

**Act 概览**:

```diagram
  Act 1            Act 2              Act 3             Act 4             Act 5
╭────────╮    ╭────────────╮    ╭──────────╮    ╭────────────╮    ╭──────────╮
│ 单篇导出│──▶│ 影子图书馆 │──▶│ 协议桥   │──▶│ 微信读书   │──▶│ 研究分支 │
│ 加固    │   │ Dashboard  │   │ Wayback  │   │ EPUB/笔记  │   │ 视频号等 │
╰────────╯    ╰────────────╯    ╰──────────╯    ╰────────────╯    ╰──────────╯
  当前起点       产品质变点          打通生态         会员前抢救       不承诺主线
```

---

## ✨ 当前已实现功能(Act 0)

- 📋 **一键提取** — 在微信文章页面点击扩展图标即可提取全文
- 📝 **高质量 Markdown** — 智能转换，保留标题、代码块、图片等格式
- 🖼️ **图片保留** — 自动处理微信的懒加载图片，确保图片链接完整
- 💻 **代码块支持** — 智能识别微信的代码片段，转换为标准 fenced code block
- 🎯 **智能去噪** — 自动移除二维码、赞赏区、推荐阅读等干扰内容
- 🏷️ **标题降级** — 基于视觉样式检测，将「伪标题」还原为普通段落，避免 Markdown 层级混乱
- 📥 **双模式导出** — 支持复制到剪贴板或下载为 `.md` 文件

## 🚀 安装使用

### 安装扩展

1. 克隆仓库并构建

   ```bash
   git clone https://github.com/Chrisyii/getwechatarticle.git
   cd getwechatarticle
   npm install
   npm run build
   ```

2. 在 Chrome 中加载扩展
   - 打开 `chrome://extensions/`
   - 开启右上角 **开发者模式**
   - 点击 **加载已解压的扩展程序**
   - 选择项目中的 `dist` 文件夹

### 使用方法

1. 打开任意微信公众号文章（`mp.weixin.qq.com` 域名下）
2. 点击浏览器工具栏中的扩展图标
3. 选择 **复制 Markdown** 或 **下载 .md 文件**

## 🏗️ 技术架构

```
src/
├── content/
│   └── index.js        # 内容脚本 — 提取 & 转换核心逻辑
└── popup/
    ├── index.html       # 弹出页面
    ├── popup.js         # 交互逻辑
    └── style.css        # 样式（微信绿主题）
```

### 技术栈

| 技术 | 用途 |
|------|------|
| [Vite](https://vitejs.dev/) | 快速构建工具 |
| [CRXJS](https://crxjs.dev/vite-plugin) | Vite Chrome 扩展插件 |
| [Turndown](https://github.com/mixmark-io/turndown) | HTML → Markdown 转换 |
| [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) | GitHub Flavored Markdown 支持 |
| [Readability](https://github.com/mozilla/readability) | Mozilla 内容提取引擎 |

### 核心处理流程

```mermaid
flowchart LR
    A[微信文章页面] --> B[克隆 DOM]
    B --> C[图片懒加载修复]
    C --> D[代码块标准化]
    D --> E[去噪处理]
    E --> F[标题视觉降级]
    F --> G[启发式尾部清理]
    G --> H[Readability 解析]
    H --> I[Turndown 转换]
    I --> J[Markdown 输出]
```

### 智能处理细节

- **图片懒加载** — 将 `data-src` 属性回写到 `src`，确保图片链接可被提取
- **代码块** — 将微信非标准的 `.code-snippet__fix` 等结构转换为标准 `<pre><code>` 格式
- **伪标题降级** — 通过 `getComputedStyle` 检测字号与正文相近的「标题」，将其降级为普通段落
- **尾部清理** — 基于关键词（`相关文章推荐`、`扫描二维码` 等）启发式删除文末推广内容
- **QR 码 & 赞赏** — 自动移除二维码、赞赏区、公众号名片等干扰元素

## 🛠️ 开发

```bash
# 开发模式（热更新）
npm run dev

# 构建
npm run build

# 预览
npm run preview
```

## 📄 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 获取当前标签页信息 |
| `scripting` | 向微信文章页面注入内容脚本 |
| `clipboardWrite` | 将 Markdown 复制到剪贴板 |
| `downloads` | 下载 `.md` 文件到本地 |

## 📜 License

[ISC](https://opensource.org/licenses/ISC)

---

<div align="center">

Made with ❤️ by [Chrisyii](https://github.com/Chrisyii)

</div>
