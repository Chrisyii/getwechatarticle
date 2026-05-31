<div align="center">

# 💬 WeChat Markdown Exporter

**一键将微信公众号文章导出为高质量的 Markdown 文件**

一个轻量级的 Chrome 扩展，让你轻松保存微信文章内容，告别手动复制的烦恼。

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome-4285F4?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

</div>

---

## ✨ 功能特点

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
