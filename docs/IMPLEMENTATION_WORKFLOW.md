# 实施工作流 · WeChat Liberator

> 给从 GitHub 新拉仓库的 agent 使用。目标是按顺序把项目从当前「单篇公众号 Markdown 导出器」实现成完整的 WeChat Liberator。不要跳读;每个 Gate 通过后再进入下一阶段。

---

## 0. Bootstrap

### 0.0 给远端 agent 的启动提示

如果你要让另一个 agent 从 GitHub 拉取后接手,可以直接把下面这段给它:

```text
你正在实现 WeChat Liberator。先读 docs/HANDOFF.md,再读 docs/IMPLEMENTATION_WORKFLOW.md。必须按 Gate 顺序从 Act 1 开始实现,不要跳到 Act 2/3/4。每个 Gate 通过 npm test、npm run build 和手动验证后再进入下一 Gate。任何新增数据字段同步 DATA_MODEL.md,任何新增抓取端点/选择器同步 CAPTURE_SPEC.md。不要实现微信支付账号内抓取、好友/群/聊天记录/收藏/浮窗,不要把视频号下载做进主线。视频号只允许 Act 5 研究报告。
```

### 0.1 先读这些文档

按顺序读:

1. [HANDOFF.md](./HANDOFF.md) —— 当前状态、已定决策、不要做什么
2. [ARCHITECTURE.md](./ARCHITECTURE.md) —— 系统分层、权限模型、七条铁律
3. [DATA_MODEL.md](./DATA_MODEL.md) —— IndexedDB schema、frontmatter、主键策略
4. [CAPTURE_SPEC.md](./CAPTURE_SPEC.md) —— 页面选择器、接口、风控边界
5. [ROADMAP.md](./ROADMAP.md) —— Act 任务清单和退出标准
6. 本文 —— 执行顺序、验证门槛、交付节奏

### 0.2 环境命令

```bash
npm install
npm run build
```

当前仓库一开始可能还没有测试脚本。Act 1 必须补上:

```bash
npm install -D vitest jsdom
```

并在 `package.json` 增加测试脚本,保留已有 `dev` / `build` / `preview`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### 0.3 全局执行规则

- 每个 Act 都必须能独立发布,不要把 Act 2/3/4 混在一个巨大改动里。
- 每个任务先写测试或夹具,再改实现。
- 每个新增 capture 端点、DOM selector、数据字段,必须同步更新 `CAPTURE_SPEC.md` 或 `DATA_MODEL.md`。
- 任意长任务必须由 Dashboard 执行;MV3 Service Worker 只做轻量调度。
- 遇到 403 / 429 / 验证码 / 异常登录提示,立即暂停任务,不要自动重试刷请求。
- 不实现微信支付账号内抓取,不把视频号下载做进主线,不碰好友/群/聊天记录/收藏/浮窗。

---

## 1. Implementation Gates

每个 Gate 都要留下可验证证据:测试输出、构建输出、手动验证截图或简短记录。

| Gate | 进入条件 | 必须验证 |
|---|---|---|
| Gate 1 · Act 1 完成 | 单篇提取逻辑已模块化 | `npm test`、`npm run build`;3~5 个 fixture 通过;真实公众号文章可复制/下载 MD、ZIP、HTML |
| Gate 2 · Act 2 数据层完成 | Dexie + SW + Dashboard 基础可用 | 打开 10 篇文章后 Dashboard 出现 10 篇;刷新后数据仍在;关闭自动归档后不再入库 |
| Gate 3 · Act 2 入口层完成 | 干净阅读、URL 净化、合集归档可用 | 干净模式不破坏正文;URL 净化测试通过;10+ 篇合集可暂停/继续 |
| Gate 4 · Act 3 完成 | 本地库有对外出口 | OPML/RSS/JSON dump/Obsidian/Webhook/Wayback/搜一搜快照均可手动验证 |
| Gate 5 · Act 4 完成 | 微信读书模块可用 | 书架、笔记、划线、单本 EPUB/MD 导出可用;风控暂停逻辑可模拟 |
| Gate 6 · Act 5 报告完成 | 主线已稳定 | 视频号/创作者后台只提交验证报告;不得无报告直接实现 |

---

## 2. Act 1 Workflow · 单篇导出加固

目标:把现有 `src/content/index.js` 的提取逻辑变成可测试、可复用的纯函数,为后续自动归档和合集批处理打地基。

### 2.1 文件结构

创建:

```text
src/lib/extractors/wechat-article.js
src/lib/utils/frontmatter.js
src/lib/utils/url-cleaner.js
tests/fixtures/
tests/extractors/wechat-article.test.js
tests/utils/frontmatter.test.js
tests/utils/url-cleaner.test.js
```

修改:

```text
manifest.json
src/content/index.js
src/popup/popup.js
src/popup/index.html
package.json
```

### 2.2 执行步骤

1. 清理 `manifest.json`:移除 `http://localhost:5173/*`,把公众号匹配扩到 `https://mp.weixin.qq.com/*`。
2. 新增 `url-cleaner.js`,按 [CAPTURE_SPEC.md](./CAPTURE_SPEC.md#b-url-净化文章页辅助能力) 实现白名单式 URL 净化。
3. 写 `url-cleaner.test.js`,覆盖普通文章、短链、非微信 URL、重复参数、缺参。
4. 把 `src/content/index.js` 中的提取逻辑抽到 `extractArticle(document, window)`。
5. `extractArticle` 返回 [DATA_MODEL.md](./DATA_MODEL.md#articles--公众号文章) 中的 `ArticleRecord` 字段,至少包含 `id`、`__biz`、`mid`、`idx`、`sn`、`source_url`、`clean_source_url`、`title`、`content_md`、`content_html`、`image_urls`、`captured_at`。
6. 新增 `frontmatter.js`,输出 [DATA_MODEL.md](./DATA_MODEL.md#frontmatter-spec) 指定字段。
7. popup 保留复制/下载,新增 HTML 快照和 ZIP 导出。
8. 放入 3~5 个真实文章 HTML fixture,测试元数据、正文、图片、代码块、frontmatter。

### 2.3 验证

```bash
npm test
npm run build
```

手动验证:

- 打开一篇 `mp.weixin.qq.com/s*` 文章
- 复制 Markdown
- 下载 `.md`
- 下载 HTML 快照
- 下载 ZIP,确认图片路径已重写

---

## 3. Act 2 Workflow · 影子图书馆

目标:让用户正常阅读公众号文章时,文章自动进入本地 IndexedDB,并能在 Dashboard 搜索、筛选、导出。

### 3.1 文件结构

创建:

```text
src/background/index.js
src/lib/db/index.js
src/lib/archive/article-service.js
src/lib/archive/archive-queue.js
src/content/wechat-article.js
src/content/wechat-clean-reader.js
src/content/wechat-listing.js
src/content/shared/toast.js
src/dashboard/index.html
src/dashboard/main.js
src/dashboard/style.css
tests/db/db.test.js
tests/archive/archive-queue.test.js
```

修改:

```text
manifest.json
src/popup/popup.js
src/popup/index.html
vite.config.js
package.json
```

### 3.2 数据层

1. 安装 `dexie`、`minisearch`,按需安装 `jszip`。
2. 在 `src/lib/db/index.js` 建 `wechat_liberator` 数据库。
3. v1 schema 必须包含 `articles`、`pubs`、`reads`、`assets`、`albums`、`album_items`、`search_snapshots`、`search_results`、`settings`。
4. 写单元测试:新增文章、重复文章更新 `last_seen_at`、用户字段 `notes/tags` 不被覆盖、合集 item 能关联文章。

### 3.3 Background SW

实现消息:

```text
ARCHIVE_ARTICLE
GET_ARCHIVE_STATUS
OPEN_DASHBOARD
EXPORT_BATCH
QUEUE_ALBUM_ARCHIVE
QUEUE_URLS
SUBMIT_WAYBACK
```

规则:

- SW 不做长任务。
- SW 收到长任务只写队列状态,由 Dashboard 认领执行。
- 所有失败都返回结构化错误 `{ code, message, retryable }`。

### 3.4 静默归档

1. `wechat-article.js` 调用 `extractArticle`。
2. 根据 `settings.auto_archive` 决定是否投递 `ARCHIVE_ARTICLE`。
3. 成功后 toast 显示「已归档 / 撤回 / 设置」。
4. popup 显示本页归档状态。

### 3.5 Dashboard

必须实现这些页面:

```text
#/library
#/pubs
#/pubs/:biz
#/reads
#/albums
#/settings
#/about
```

最小功能:

- 文章列表
- 公众号视图
- 全文搜索
- 批量导出 JSON/ZIP
- 设置项:自动归档、图片本地化、Wayback 模式、Webhook URL、Vault 路径

### 3.6 干净阅读 + URL 净化

1. `wechat-clean-reader.js` 注入浮动工具条。
2. 干净模式只隐藏噪声,不删除正文资产。
3. 字号、夜间模式使用局部 class,不要污染全局。
4. 复制干净链接调用 `url-cleaner.js`。
5. 对微信限制页只提示,不绕过。

### 3.7 合集归档

1. `wechat-listing.js` 匹配 `mp/appmsgalbum`。
2. 解析 DOM `data-link/data-title`,必要时同源调用 `action=getalbum&f=json`。
3. 用户点击「归档本合集」后创建 Dashboard 任务。
4. Dashboard 串行处理,每篇 2~5 秒随机等待。
5. 每完成一篇就写 `album_items.archive_status`。
6. 403/429/验证码/异常登录时暂停任务。

### 3.8 验证

```bash
npm test
npm run build
```

手动验证:

- 打开 10 篇公众号文章,Dashboard 能看到 10 篇。
- 搜索标题和正文都能命中。
- 关闭自动归档后,新打开文章不入库。
- 在文章页启用干净模式,正文不丢。
- 复制干净链接,tracking 参数消失。
- 打开一个 10+ 篇合集,归档任务可暂停、继续、失败可见。

---

## 4. Act 3 Workflow · 协议桥与公共存证

目标:把本地库变成可迁移、可连接、可公开存证的数据层。

### 4.1 文件结构

创建:

```text
src/lib/exporters/opml.js
src/lib/exporters/rss.js
src/lib/exporters/json-feed.js
src/lib/exporters/json-dump.js
src/lib/bridges/obsidian-sync.js
src/lib/bridges/webhook.js
src/lib/bridges/wayback.js
tests/exporters/
tests/bridges/
```

### 4.2 导出

实现:

- OPML:从 `pubs` 派生公众号订阅列表。
- RSS 2.0:整库或筛选结果。
- JSON Feed 1.1:整库或筛选结果。
- JSON dump:全库导出/导入,按主键合并。
- ZIP:选中文章导出 Markdown + 图片。

### 4.3 Obsidian

1. Chrome/Edge 使用 File System Access API。
2. Firefox fallback 到 downloads API。
3. 写入路径按 [DATA_MODEL.md](./DATA_MODEL.md#文件命名约定导出到-obsidian-vault-时)。
4. 已存在文件不覆盖。
5. 提供全量回填。

### 4.4 Webhook

1. 用户配置 URL 时再申请对应 host permission。
2. 新归档文章 POST `{ event, article }`。
3. 失败最多重试 3 次,指数退避。
4. Dashboard 展示最近 50 条推送日志。

### 4.5 Wayback

1. 默认 `manual`,自动模式必须用户显式打开。
2. 只提交公开公众号文章的 `clean_source_url`。
3. 优先实现 `src/lib/bridges/wayback.js` 的状态机:`idle -> queued -> saving -> saved|failed`。
4. 浏览器 CORS/认证失败时,给出明确错误,不要假装成功。
5. 成功后写 `wayback_snapshot_url`、`wayback_archived_at`、`wayback_status`。

### 4.6 搜一搜快照

1. 用户主动打开搜一搜结果页后才能保存。
2. 保存 `search_snapshots` + `search_results`。
3. Dashboard 可按 query 查看历史快照。
4. 勾选结果加入归档队列时仍串行限速。

### 4.7 验证

```bash
npm test
npm run build
```

手动验证:

- OPML 可被阅读器导入。
- RSS / JSON Feed 文件格式合法。
- JSON dump 导出后可重新导入且不重复。
- Obsidian 写入不覆盖用户修改文件。
- Webhook 失败会重试并记录日志。
- Wayback 成功/失败状态都能写回文章详情。
- 搜一搜结果保存后 Dashboard 可回看。

---

## 5. Act 4 Workflow · 微信读书

目标:把微信读书的书架、笔记、划线、已渲染正文导出为开放格式。

### 5.1 文件结构

创建:

```text
src/content/weread-shelf.js
src/content/weread-reader.js
src/lib/extractors/weread-api.js
src/lib/extractors/weread-dom-reader.js
src/lib/exporters/weread-markdown.js
src/lib/exporters/weread-epub.js
tests/weread/
```

### 5.2 书架和笔记

1. 按 [CAPTURE_SPEC.md](./CAPTURE_SPEC.md#微信读书--wereadqqcom) 先用 Web API 抓书架、划线、想法。
2. API 失效时优先读页面 store,再考虑 DOM fallback。
3. 所有接口都必须依赖用户已登录且页面可访问。

### 5.3 正文导出

默认只做 DOM 抓取:

- 用户打开阅读器页并点击「导出本书正文」。
- 程序自动切章,等 DOM 稳定后抓 `.readerContent` / `.app_content`。
- 章节间 1~3 秒随机延迟。
- 每章完成立即保存进度。
- 403/429/异常登录立即暂停。

不要默认实现 API 解密 Turbo。若要做,必须作为实验功能且默认关闭。

### 5.4 EPUB / MD 输出

单本书目录:

```text
{书名}/
├── {书名}.epub
├── {书名}.md
├── cover.jpg
├── highlights.md
├── reviews.md
└── meta.json
```

EPUB 必须包含封面、版权页、目录、按章 XHTML、笔记附录。

### 5.5 验证

```bash
npm test
npm run build
```

手动验证:

- 书架同步后 Dashboard 有书架视图。
- 单本书笔记导出为 Markdown。
- 单本书正文可断点导出。
- EPUB 可被 Calibre / Apple Books / KOReader 之一打开。
- 模拟 429 时任务暂停,不继续重试。

---

## 6. Act 5 Workflow · 研究分支

Act 5 只能产出验证报告或独立分支,不能阻塞主线发布。

### 6.1 视频号 spike

先写 `docs/research/channels-spike.md`,回答:

- 能否从公开 Web 页拿到元数据?
- 能否拿到视频 URL?
- 是否需要 `decode_key`?
- 是否依赖 WASM / Isaac64 / XOR?
- 签名 URL 有效期多长?
- 普通扩展能否本地完成?
- 账号风险和维护成本是否可接受?

只有报告结论为“无需长期维护解密链路”时,才允许写原型代码。

### 6.2 创作者后台 spike

先写 `docs/research/creator-backend-spike.md`,回答:

- 登录后台有哪些稳定 Web 表面?
- 数据是否属于创作者自己的可导出数据?
- 是否需要新的权限模型?
- 是否应该新建独立产品?

默认不混入读者侧 schema。

---

## 7. 最终完成标准

项目完成时应满足:

- README 能让普通开发者安装、构建、加载扩展。
- HANDOFF 能让新 agent 30 秒内知道当前状态和禁止事项。
- ROADMAP 的 Act 1~4 任务全部勾选或有明确替代说明。
- DATA_MODEL 与实际 Dexie schema 一致。
- CAPTURE_SPEC 与实际 content scripts / API 调用一致。
- IMPLEMENTATION_WORKFLOW 的每个 Gate 都有验证证据。
- `npm test`、`npm run build` 通过。
- 没有硬编码 secret。
- 所有外发能力默认关闭或需要用户显式授权。
