# 架构设计 · WeChat Liberator

> 一个浏览器扩展。用户照常在微信 Web 上读公众号文章、打开合集/搜一搜、用微信读书,插件在背后悄悄把数据复制一份到本地,并提供搜索、订阅、导出、桥接出口和公共存证 —— 让用户从微信「只能消费、无法拥有」的状态,回到「拥有、可携带、可连接」的状态。

---

## 1. 范围 · 能做什么 / 不能做什么

### ✅ 一个浏览器扩展能打穿的封闭层

| 层 | 数据源(域名) | 抓取方式 | 是否需要会员 |
|---|---|---|---|
| 公众号文章内容 | `mp.weixin.qq.com/s/*` | content script + DOM | ❌ 否,文章公开 |
| 公众号文章元数据/统计 | 同上 + 内嵌 XHR | content script 拦截 | ❌ |
| 公众号文章评论 | `mp.weixin.qq.com` XHR | content script 拦截 | ❌ |
| 公众号合集/专辑列表 | `mp.weixin.qq.com/mp/appmsgalbum*` | 用户打开合集页后解析 DOM / `getalbum` JSON | ❌ |
| 搜一搜结果快照 | `mp.weixin.qq.com/s*` 搜索结果页 | 用户搜索后解析结果列表 | ❌ |
| 干净阅读模式 + URL 净化 | `mp.weixin.qq.com/s/*` | DOM 注入 + URL 参数清洗 | ❌ |
| 派生订阅(我读过哪些号) | 浏览历史 | 被动入库 | ❌ |
| Wayback 公共存证 | `web.archive.org/save` | 用户触发或设置开启后提交公开 URL | ❌ |
| 微信读书 书架 | `weread.qq.com/web/shelf*` | content script + Web API | ❌ |
| 微信读书 笔记/划线/想法 | `weread.qq.com/web/book/bookmarklist`、`/review/list` | content script + Web API | ❌(你自己的笔记) |
| 微信读书 阅读时长 | `weread.qq.com/web/reading/*` | content script + Web API | ❌ |
| 微信读书 书籍正文 | `weread.qq.com/web/reader/{bookId}` 渲染页 | content script 抓渲染后 DOM | ⚠️ 付费书需会员或购买;免费/公版/已购书不需要 |
| 协议出口 | 本地 | 纯本地生成 | ❌ |

### ❌ 浏览器插件碰不到、本项目不做的

- 微信 App 内的「**收藏 / 浮窗 / 聊天记录 / 阅读历史**」—— 全部 App-only,Web 无入口
- **好友 / 群 / 通讯录** —— Web 端无入口,硬做就是灰产
- **微信关注公众号的真实列表** —— Web 端不暴露;本项目用「**浏览历史反推**」替代
- **公众号历史文章批量爬取** —— 后台主动 fetch 会被封,本项目**只在用户主动打开的页面上提取**
- **微信支付个人账单** —— 个人账单主要是 App-only,没有稳定 Web 表面;本项目最多支持未来「导入用户手动导出的账单文件」,不做账号内抓取
- **不绕过 DRM、不解密用户无权限内容** —— 我们**只搬运浏览器里已经渲染出来的文字**(等同于「选中复制」的自动化);只要用户是会员、能读到,我们就能抓到本地。**会员到期后**:已抓的书永久属于用户,新出的付费书因为浏览器本身也读不了,自然抓不到。**这正是「趁有会员时把访问权变拥有权」的核心价值**
- **视频号短视频下载** —— 独立的媒体流解密 / `decode_key` / WASM 维护问题,不进入主路线。仅允许作为 Act 5 R&D spike 验证「公开视频元数据归档」和「单条公开视频备份」,验证失败不影响产品路线
- **公众号创作者后台数据** —— 若用户是创作者,后台数据解放有价值,但这是创作者侧产品,权限/登录/指标体系都不同;不混入读者侧影子库主线

### 七条铁律(任何时候不能破)

1. **用户触发或被动旁路** —— 不主动爬取用户没访问过的页面
2. **本地优先** —— 数据默认存在用户机器上,不上传任何第三方服务器
3. **开放格式** —— Markdown / JSON / OPML / RSS / EPUB,不发明私有格式
4. **可关、可见、可撤回** —— 静默归档默认开启但用户能一键关闭,UI 永远显示「本页已归档 ✓ / 撤回」
5. **账号安全优先于抓取速度** —— 章节抓取最少 1~3 秒随机间隔(不可关、不可改更短);单日抓书有默认上限;同一时刻只抓一本绝不并发;任何风控信号(403/429/账号警告)立即全面停手 + 弹窗通知,不傻重试;只用 weread 自己的 API,不引第三方逆向方案
6. **导出物必须是「完整的书」** —— 微信读书单本绝不能是纯 TXT/纯 MD 散文件。必须产出:**EPUB**(标准 EPUB3,封面+版权+目录+按章 XHTML+附录笔记,在任何主流阅读器里 = 一本正版书)+ **MD**(带 frontmatter + 内嵌划线)+ 独立 cover.jpg / highlights.md / reviews.md / meta.json。每本书一个文件夹,U 盘拷走也能完整阅读。详见 [ROADMAP.md § 4.4](./ROADMAP.md#44-正文抽取核心--把会员期内的访问权转成拥有权)
7. **公共存证显式授权** —— Wayback / Webhook 等外部出口必须让用户看见并授权;默认本地归档,外发前显示目标 URL 和结果状态

---

## 2. 系统分层

```diagram
                       微信 Web 域
   ─────────────────────────────────────────────
   mp.weixin.qq.com/s/*       ───┐
   mp.weixin.qq.com/mp/*      ───┤
   mp.weixin.qq.com/s/search  ───┤
   web.archive.org/save       ───┤
   weread.qq.com/web/*        ───┘
                                  │
                                  ▼
   ╭───────────────────────────────────────────────────────╮
   │  Capture 层(content scripts,按域分包)              │
   │  ─────────────────────────────────────                │
   │  - wechat-article.js   公众号文章提取 + 静默归档       │
   │  - wechat-listing.js   搜一搜/合集页 元数据抓取        │
   │  - wechat-clean-reader.js 干净阅读/URL 净化 UI        │
   │  - weread-shelf.js     书架抓取                       │
   │  - weread-reader.js    正文/笔记/划线抓取             │
   ╰───────────────┬───────────────────────────────────────╯
                   │ chrome.runtime.sendMessage
                   ▼
   ╭───────────────────────────────────────────────────────╮
   │  Background(Service Worker · orchestrator)           │
   │  ─────────────────────────────────────                │
   │  - 归档队列、去重、错误重试                            │
   │  - 长任务派发到 Dashboard 页(SW 非持久,重活不在此)   │
   │  - Wayback 提交任务与状态同步                         │
   │  - Webhook 推送                                       │
   │  - 跨 tab 状态同步                                    │
   ╰───────────────┬───────────────────────────────────────╯
                   │
                   ▼
   ╭───────────────────────────────────────────────────────╮
   │  Store 层(IndexedDB · Dexie.js)                     │
   │  详细 schema 见 docs/DATA_MODEL.md                    │
   │  articles  pubs  reads  albums  album_items           │
   │  search_snapshots  search_results  assets  settings   │
   │  books  highlights  reviews  reading_sessions         │
   ╰───────────────┬───────────────────────────────────────╯
                   │
   ┌───────────────┼─────────────────┬──────────────────┐
   ▼               ▼                 ▼                  ▼
╭────────╮   ╭───────────╮     ╭──────────╮      ╭──────────╮
│ Popup  │   │ Dashboard │     │ Exporter │      │ Bridges  │
│        │   │           │     │          │      │          │
│ 当前页 │   │ 整库搜索  │     │ MD/HTML/ │      │ Obsidian │
│ 快速   │   │ 公众号视图│     │ EPUB/ZIP │      │ Webhook  │
│ 动作   │   │ 书架视图  │     │ 整库     │      │ RSS/OPML │
│        │   │ 统计/设置 │     │ JSON dump│      │ 文件夹同步│
╰────────╯   ╰───────────╯     ╰──────────╯      ╰──────────╯
```

### 各层职责清单

| 层 | 运行环境 | 寿命 | 职责 | 不做 |
|---|---|---|---|---|
| **Capture** | content script,目标域页面内 | 跟随页面 | DOM 提取、XHR 拦截、向 SW 投递结构化数据 | 不直接写 IndexedDB(避免每个 tab 各自写引发竞态) |
| **Background SW** | 浏览器后台 | 非持久,空闲 30s 被回收 | 接收 Capture 投递、去重入库、推送 webhook、消息路由 | 不做长任务、不建索引、不渲染 UI |
| **Store** | IndexedDB | 持久 | 数据存储与查询 | 不做业务逻辑,纯数据层 |
| **Dashboard** | 扩展自带页面 | 用户打开期间,可常驻 | 全文搜索索引、批量操作、UI 渲染、繁重导出 | 不接管 Capture 职责 |
| **Popup** | action popup | 每次打开重新加载 | 当前页面状态、快速动作 | 不做长任务,不做整库操作 |

### 为什么 Dashboard 才是「常驻执行器」?

MV3 Service Worker **非持久**,空闲 30 秒就会被浏览器杀掉。把「全文搜索索引构建」「批量导出整库」「Obsidian 整库同步」这种长任务放 SW 里会被中途打断。

解法:**Dashboard 是一个用户主动打开的 chrome-extension 页面**,只要用户开着这个 tab,它就是常驻 JS 环境,可以跑长任务、维护内存索引、轮询 SW 消息队列。SW 只做轻量调度和事件中转。

---

## 3. 关键技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 构建工具 | **Vite + CRXJS**(现状保留) | 已在用,HMR 体验好 |
| Manifest | **MV3**(现状保留) | Chrome 强制 |
| 存储 | **IndexedDB via Dexie.js** | 容量大(磁盘 60%);Dexie 比裸 IDB API 友好十倍;支持事务、版本迁移 |
| 全文搜索 | **MiniSearch** | 纯前端、无依赖、增量索引、中文需开 `tokenize` 自定义(jieba-wasm 可选) |
| HTML → MD | **Turndown + gfm 插件**(现状保留) | 已用,稳定 |
| 内容主体提取 | **Mozilla Readability**(现状保留) | 已用;微信读书正文不走 Readability,直接抓渲染 DOM |
| EPUB 生成 | **epub-gen-memory** 或自己拼 zip | 仅在用户主动「整书导出」时按需加载 |
| Markdown 化笔记 | 手写模板,不引依赖 | 笔记结构简单 |
| URL 净化 | `URL` / `URLSearchParams` 白名单重建 | 不做字符串替换;仅删除 tracking 参数,保留 `__biz/mid/idx/sn/chksm` 等内容锚 |
| Wayback 提交 | `fetch` + SPN2 状态轮询;必要时让用户配置 archive.org S3 key | 浏览器 CORS/认证不稳定,不能只依赖裸 `GET /save/{url}` |
| Webhook 推送 | `fetch` + retry,无队列库 | 单条任务足够 |
| 文件落盘 | **File System Access API**(Obsidian Vault 同步) | 仅 Chrome/Edge 支持;Firefox 走 `downloads` API |
| 图片本地化 | **可选,默认不存** —— 默认只存远端 URL,用户勾选「永久保存」才下载 blob 到 IndexedDB 或写入 Vault | 容量与隐私平衡 |
| 中文分词 | v1 用空格 + 单字切分;v2 评估 `jieba-wasm`(~3MB) | 体积权衡 |
| 测试 | Vitest + Playwright(可选) | 提取逻辑用 Vitest 跑 HTML 固件;Playwright 留给 E2E |

---

## 4. 权限模型

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "clipboardWrite",
    "downloads",
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "https://mp.weixin.qq.com/*",
    "https://weread.qq.com/*"
  ],
  "optional_permissions": [
    "notifications"
  ],
  "optional_host_permissions": [
    "https://web.archive.org/*",
    "https://*/*"
  ]
}
```

- `storage`:settings、轻量小数据
- `alarms`:Webhook 失败重试、定期清理
- `optional_host_permissions: web.archive.org`:仅在启用 Wayback 提交时申请
- `optional_host_permissions: *`:仅在用户配置自建 Webhook URL 时,运行时申请该域名权限
- **必须移除**当前 [manifest.json](file:///Users/chris/dev/tools/wechat-markdown-exporter/manifest.json) 里的 `http://localhost:5173/*` 残留

---

## 5. 数据流示例

### A. 用户打开一篇公众号文章 → 自动入库

```diagram
1. 用户打开 mp.weixin.qq.com/s/xxxxx
2. content script (wechat-article.js) 注入
3. 等 DOMContentLoaded + 1s(等懒加载图片就位)
4. 提取:
   - 文章正文(现有 Readability + Turndown 管线)
   - 元数据(__biz, mid, idx, sn, title, author, pub_time)
   - 拦截 getappmsgext XHR 拿到 阅读数/在看数(可选)
5. sendMessage({type:'ARCHIVE_ARTICLE', payload}) → SW
6. SW 去重(主键 = __biz + mid + idx + sn),写入 IndexedDB
7. SW 回 {archived:true, id} → content script
8. content script 在页面右上角注入「已归档 ✓」浮窗
9. (可选)SW 触发 Webhook:POST 用户配置的 URL
```

### B. 用户在 Dashboard 搜索 + 导出 ZIP

```diagram
1. 用户打开 dashboard.html(扩展自带页)
2. Dashboard 启动时:从 IndexedDB 读 articles 表,喂给 MiniSearch 建索引
   (大库时增量构建,不阻塞 UI)
3. 用户输入「rust async」,MiniSearch 返回 hit ids
4. 用户勾选 N 篇 → 点「导出 ZIP」
5. Dashboard 用 JSZip 打包 md + 图片(若已本地化)
6. 调用 chrome.downloads.download 触发下载
```

### C. 用户在微信读书页面 → 一键导出整本笔记

```diagram
1. 用户打开 weread.qq.com/web/reader/{bookId}
2. content script (weread-reader.js) 注入,在页面工具栏加按钮
3. 点击 → content script 直接调用 weread Web API:
   - GET /web/book/bookmarklist?bookId=xxx → 所有划线
   - GET /web/review/list?bookId=xxx       → 所有想法
   - GET /web/book/chapterInfos?bookIds=xxx → 章节目录
4. 整理为 Markdown,sendMessage 到 SW → 写入 books + highlights + reviews 表
5. 同时下载 .md 给用户;若配置了 Obsidian Vault,写入对应文件夹
```

---

## 6. 存储与配额策略

- **IndexedDB 默认配额**:Chrome 给磁盘的 ~60%,通常几十 GB,够用
- **图片策略**:
  - **默认模式**:只存远端 URL,容量极小(单文章 < 50KB)
  - **永久模式**:用户在设置里开启「图片本地化」,新归档时下载 blob 入 `assets` 表;旧文章可批量回填
  - **Obsidian 模式**:启用 Vault 同步时,图片直接下载到 Vault 的 attachments 文件夹
- **整库导出**:支持 JSON dump(无图片) + ZIP(含图片),用户迁移友好
- **数据迁移**:Dexie 自带版本化 schema,每次 schema 变更写一个 migration

---

## 7. UI 入口总览

| 入口 | 文件 | 触发 | 形态 |
|---|---|---|---|
| Popup | `src/popup/index.html` | 点击工具栏图标 | 小卡片,当前页动作 |
| Dashboard | `src/dashboard/index.html` | popup 「打开图书馆」/ 右键菜单 | 全屏扩展页 |
| Reader overlay | `src/content/reader-overlay.js` | 文章页右下角浮按钮 | 注入式 sidebar |
| 已归档提示 | `src/content/archive-toast.js` | 自动入库后 | 页面右上 toast |
| 设置页 | Dashboard 内一个 tab | Dashboard 侧栏 | 表单 |

---

## 8. 与现有代码的关系

当前 [src/content/index.js](file:///Users/chris/dev/tools/wechat-markdown-exporter/src/content/index.js) 实现的「公众号文章提取 + Readability + Turndown」管线**完整保留**,只做两件改造:

1. **抽离为模块**:从 `chrome.runtime.onMessage` 监听里抽出 `extractArticle()` 纯函数,既能被 popup 触发,也能被「自动归档」内部调用
2. **增强提取**:除了 markdown,同时返回结构化元数据(见 [DATA_MODEL.md](./DATA_MODEL.md))

现有 [src/popup/popup.js](file:///Users/chris/dev/tools/wechat-markdown-exporter/src/popup/popup.js) 的「复制 / 下载」按钮保留,Act 2 时再加「打开图书馆」「本页已归档」状态显示。

详见 [ROADMAP.md](./ROADMAP.md) 各 Act 的具体改造项。

---

## 9. 待决问题(交给执行 agent 时一起考虑)

1. **MiniSearch 中文分词**:v1 先用「单字 + bigram」凑合,还是直接上 jieba-wasm?(体积 vs 召回)
2. **微信读书章节正文**:走 API 解密 vs 抓渲染 DOM?(前者快但有反爬,后者慢但稳)
3. **Firefox 支持**:File System Access API 不支持,需 fallback 到 downloads API;是否在 v1 范围?
4. **多账号**:用户用两个微信号读,数据要分账号吗?v1 建议**不分**,所有数据一锅烩,按 `__biz` / `bookId` 去重
5. **同步**:同一个用户的两台电脑要不要同步?**v1 不做**,只提供 JSON dump 手动迁移
