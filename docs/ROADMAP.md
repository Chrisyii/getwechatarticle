# 路线图 · WeChat Liberator

五个 Act,每个 Act 自成体系、可独立发布。Act 1~4 是主线;Act 5 是研究分支,不承诺进入主线。后一个主线 Act 依赖前一个 Act 的数据层。

> 远端 agent 从 GitHub 拉取后,先读 [HANDOFF.md](./HANDOFF.md),再按 [IMPLEMENTATION_WORKFLOW.md](./IMPLEMENTATION_WORKFLOW.md) 的 Gate 顺序执行。本文只列路线和退出标准,具体执行节奏以 Implementation Workflow 为准。

---

## Act 1 · 加固楔子 · 公众号单篇导出无可挑剔

**目标**:在不引入 IndexedDB / 不改架构的前提下,把当前导出器做到「单篇 100% 信得过」,作为产品信任锚。

**预估工作量**:2~3 天

### 任务

- [ ] **manifest 清理**:移除 `host_permissions` 里的 `http://localhost:5173/*`;`host_permissions` 改为 `https://mp.weixin.qq.com/*`(覆盖到搜一搜、合集页等)
- [ ] **提取函数模块化**:把 [src/content/index.js](file:///Users/chris/dev/tools/wechat-markdown-exporter/src/content/index.js) 里的提取逻辑抽成 `src/lib/extractors/wechat-article.js`,导出 `extractArticle(): ArticleRecord`(返回结构见 [DATA_MODEL.md](./DATA_MODEL.md));content script 变成薄壳调用它
- [ ] **元数据完善**:从 URL / 页面 `<script>` 里抽取 `__biz`、`mid`、`idx`、`sn`、`source_url`、`author`、`pub_time`、`copyright_stat`、`is_original`、`pub_account_name`、`pub_account_avatar`、`captured_at`
- [ ] **frontmatter 输出**:导出的 MD 顶部加 YAML frontmatter(字段见 [DATA_MODEL.md](./DATA_MODEL.md#frontmatter-spec))
- [ ] **HTML 快照**:popup 增加「下载 HTML 快照」按钮,保存原始 `<article>` 的 outerHTML 防删文
- [ ] **ZIP 打包导出**:popup 增加「下载 ZIP(MD + 图片)」选项,使用 JSZip 抓所有 `<img src>` 并打包,图片用 hash 命名,MD 内链接重写为相对路径
- [ ] **抓取失败兜底**:Readability 失败时,直接用 `#js_content` 的 innerHTML 走 Turndown,而不是丢错
- [ ] **测试夹具**:`tests/fixtures/` 放 3~5 个真实文章 HTML 备份,Vitest 跑 `extractArticle` 验证关键字段

### 退出标准

- 任意打开一篇公众号文章,popup 三个按钮(复制 MD / 下载 MD / 下载 ZIP / 下载 HTML 快照)全部能用
- 导出的 MD frontmatter 完整,可直接放进 Obsidian
- 测试夹具全部通过

---

## Act 2 · 影子图书馆 · 公众号被动建库

**目标**:从「一次性工具」变成「持续资产」。打开过的文章自动入库,Dashboard 全文搜索。

**预估工作量**:2~3 周

### 任务

#### 2.1 数据层

- [ ] 引入 `dexie` 依赖
- [ ] 按 [DATA_MODEL.md](./DATA_MODEL.md) 在 `src/lib/db/index.js` 建库,定义 `articles`、`pubs`、`reads`、`settings` 四张表
- [ ] 写 v1 schema 迁移
- [ ] 单元测试:增删查改 + 主键去重

#### 2.2 Background Service Worker

- [ ] 新建 `src/background/index.js`,在 manifest 注册
- [ ] 消息路由:`ARCHIVE_ARTICLE`、`GET_ARCHIVE_STATUS`、`OPEN_DASHBOARD`、`EXPORT_BATCH`
- [ ] 归档队列:简单串行(同时只处理一个),失败重试 3 次,持久化到 `storage`
- [ ] 去重逻辑:主键 = `__biz + mid + idx + sn`,已存在则更新 `last_seen_at` 而不是覆写

#### 2.3 静默归档

- [ ] content script 在 `wechat-article` 提取后,**默认自动**向 SW 投递 `ARCHIVE_ARTICLE`
- [ ] 设置项:`auto_archive: true|false`,默认 `true`
- [ ] **页面右上角注入 toast**:「✓ 已归档 / 撤回 / 设置」—— 透明、可关闭、3 秒自动隐藏
- [ ] 同步记录到 `reads` 表(`article_id, opened_at`)

#### 2.4 Dashboard 页面

新建 `src/dashboard/`,作为扩展自带页面(在 popup 加一个「打开图书馆」按钮跳转)。

- [ ] 路由(纯前端,hash router):`/library`、`/pubs`、`/pubs/:biz_id`、`/reads`、`/settings`、`/about`
- [ ] **图书馆视图**:文章列表,按 `pub_time` 倒序,卡片显示封面 + 标题 + 公众号名 + 摘要;支持按公众号筛选 / 按 tag 筛选 / 按时间区间筛选
- [ ] **公众号视图**:从 `pubs` 表渲染,显示头像 + 名称 + 已归档文章数 + 最近一篇;点进去看该号所有文章
- [ ] **阅读统计**:本周/本月阅读数、Top 10 公众号、阅读时段热力图(基于 `reads`)
- [ ] **全文搜索**:用 MiniSearch,启动时增量建索引;搜索框支持 `pub:科技美学` / `tag:rust` / `after:2024-01` 语法
- [ ] **批量操作**:全选 / 反选,批量导出 ZIP / 批量加 tag / 批量删除
- [ ] **设置**:auto_archive 开关、图片本地化开关、Webhook URL、Vault 路径

#### 2.5 Popup 升级

- [ ] 显示「本页已归档 ✓ 2024-05-01」/「未归档」状态
- [ ] 加「打开图书馆」按钮
- [ ] 已有的「复制/下载」按钮保留

#### 2.6 性能

- [ ] 库 > 1000 篇时,MiniSearch 建索引超过 500ms → 拆成 worker
- [ ] 列表用虚拟滚动(`@tanstack/virtual` 或手写)

#### 2.7 干净阅读 + URL 净化

> 这是「入口层解放」,价值高、风险低,和自动归档共用同一套 content-script UI 基础。

- [ ] 新建 `src/content/wechat-clean-reader.js`,匹配 `https://mp.weixin.qq.com/s*`
- [ ] 页面右下角注入「干净模式」浮按钮,可展开工具条:干净模式 / 字号 / 夜间 / 复制干净链接 / 归档状态
- [ ] 干净模式只隐藏引导关注、赞赏、推荐阅读、底部公众号卡片、二维码推广、评论引导等噪声区;不删除正文中的图片、音频、代码块
- [ ] URL 净化用 `URL` / `URLSearchParams` 白名单重建,保留 `__biz`、`mid`、`idx`、`sn`、`chksm`、`scene` 中真正影响打开的必要字段;删除 `from`、`sessionid`、`clicktime`、`enterid`、`ascene`、`devicetype`、`version`、`lang` 等 tracking 参数
- [ ] 复制干净链接时写入剪贴板,toast 显示「已复制干净链接」
- [ ] 对「请在微信里打开」类错误页只提示原因和可选手动操作,不承诺绕过
- [ ] 单元测试:URL 净化函数覆盖普通文章、短链、缺参、重复参数、无关 URL

#### 2.8 公众号合集/专辑批量归档

> 这是从「单篇」升级到「系列」的高价值功能,但仍遵守用户触发、串行、限速、可中止。

- [ ] content script 匹配 `https://mp.weixin.qq.com/mp/appmsgalbum*`
- [ ] 打开合集页后解析 `__biz`、`album_id`、合集标题、文章列表;优先读 DOM `data-link/data-title`,必要时调用 `action=getalbum&f=json`
- [ ] 页面注入「归档本合集」按钮,点击后把文章列表交给 Dashboard 长任务队列
- [ ] Dashboard 显示合集任务进度:总数、已完成、失败、跳过、当前文章标题
- [ ] 每篇文章按标准 Act 1 `extractArticle` 管线处理;已存在则跳过正文重抓,只补 `album_id` / `album_title`
- [ ] 串行打开/抓取,每篇之间随机等待 2~5 秒;遇到 403/429/验证码/异常登录提示立即暂停整个任务
- [ ] 断点续跑:任务状态写入 IndexedDB,关闭 Dashboard 后下次可继续
- [ ] 失败记录可导出为 JSON,便于用户手动补抓

### 退出标准

- 用户安装插件后什么都不用做,读 10 篇文章 → Dashboard 里能看到这 10 篇
- 全文搜索能命中标题 + 正文
- 公众号视图能显示「我读过 X 个号、共 Y 篇」
- 设置里能关掉静默归档
- 文章页干净模式和干净链接可用
- 合集页能用户触发地批量归档一个 10+ 篇合集,可暂停、可继续、不会并发刷请求

---

## Act 3 · 协议桥 · 让本地库长出对外接口

**目标**:坐实「解耦层」叙事 —— 本地库不是孤岛,可以喂给 RSS 阅读器、Obsidian、自己的脚本。

**预估工作量**:1~2 周

### 任务

- [ ] **OPML 导出**:Dashboard 的「公众号视图」加「导出 OPML」按钮,生成派生订阅列表
- [ ] **JSON Feed 生成**:整库或筛选后的文章列表 → 生成符合 [JSON Feed 1.1](https://www.jsonfeed.org/) 规范的 `.json` 文件下载
- [ ] **RSS 2.0 生成**:同上,生成 `.xml`
- [ ] **整库 JSON dump**:全表导出为单个 `.json`,可重新 import(双向)
- [ ] **Obsidian Vault 同步**:
  - 用 File System Access API 让用户授权一个本地文件夹
  - 新归档文章自动写入 `<Vault>/WeChat/{公众号名}/{YYYY-MM-DD} {title}.md`
  - 图片落到 `<Vault>/WeChat/_attachments/{hash}.{ext}`,MD 内用 wikilink 引用
  - 已存在文件不覆盖(用户可能改过)
  - 提供「全量回填」按钮:把已归档的历史文章一次性灌入 Vault
- [ ] **Webhook 推送**:
  - 设置里填一个 URL
  - 新归档时 POST `{event:"article.archived", article:{...full record...}}`
  - 失败重试 3 次,指数退避
  - Dashboard 显示推送日志(最近 50 条)
- [ ] **Wayback Machine 公共存证**:
  - 设置项:`wayback_mode: off|manual|auto_public_articles`,默认 `manual`
  - 文章详情页和 popup 显示「提交 Wayback」按钮
  - 提交前使用干净 URL,只允许公开公众号文章;微信读书、登录态页面、Dashboard 私有页一律禁用
  - 调用 `https://web.archive.org/save` 的 SPN2 流程;若浏览器端 CORS/认证失败,提示用户配置 archive.org S3 key 或改用本地 helper(后续)
  - 轮询保存状态,把快照 URL、状态、错误原因写回 `articles.wayback_*` 字段
  - Dashboard 用徽章显示「本地 ✓ / Wayback ✓」或失败原因
- [ ] **搜一搜结果快照 / 派生订阅增强**:
  - content script 匹配用户实际打开的搜一搜结果页
  - 提取 query、结果标题、公众号名、摘要、文章 URL、展示位置、抓取时间
  - 写入 `search_snapshots` 表,用于「我搜过什么、微信给我看了什么」
  - 可从结果列表一键选择若干文章加入归档队列,仍然串行、限速、可中止
  - Dashboard 支持按 query 查看结果历史,但不称为算法解构;只展示用户实际看到的结果
- [ ] **import 入口**:Dashboard 支持上传整库 JSON dump,合并入当前库(用主键去重)

### 退出标准

- 用户把 OPML 喂给 NetNewsWire / Inoreader → 能看到自己的公众号列表
- Webhook 接到 n8n / 自建脚本 → 每篇新文章自动触发
- Obsidian 用户安装插件 + 配置 Vault → 读文章 = Obsidian 多一个笔记
- 公开公众号文章能手动提交 Wayback,成功后在文章详情看到快照 URL
- 搜一搜结果页能保存一次结果快照,Dashboard 可按关键词回看

---

## Act 4 · 微信读书 · 把书架和笔记搬回家

**目标**:在 `weread.qq.com` 上做和公众号对称的事 —— 抓书架、抓笔记、抓正文,统一进同一个影子图书馆。

**预估工作量**:2~3 周

> 详细抓取规格见 [CAPTURE_SPEC.md § 微信读书](./CAPTURE_SPEC.md#微信读书-wereadqqcom)。

### 任务

#### 4.1 数据层扩展

- [ ] 按 [DATA_MODEL.md](./DATA_MODEL.md#weread-tables) 增加 `books`、`highlights`、`reviews`、`reading_sessions` 四张表
- [ ] 写 v2 schema 迁移

#### 4.2 书架同步

- [ ] content script `weread-shelf.js`,匹配 `weread.qq.com/web/shelf*`
- [ ] 抓 Web API 拿全量书架(参见 CAPTURE_SPEC)
- [ ] 写入 `books` 表(`bookId, title, author, cover, type, owned, finished_at, ...`)
- [ ] Dashboard 加「我的书架」视图,显示封面墙 + 状态(在读/已读/想读)

#### 4.3 笔记 / 划线 / 想法同步

- [ ] content script `weread-reader.js`,匹配 `weread.qq.com/web/reader/*`
- [ ] 在阅读器工具栏注入「同步本书笔记」按钮
- [ ] 一键拉取该书所有 bookmark + review,写入 `highlights` / `reviews` 表
- [ ] **「同步全部」批量入口**:Dashboard 触发,后台依次拉取书架中每本书的笔记
- [ ] 单本书的笔记导出为 MD:章节分组,每条划线带上下文 + 自己的想法

#### 4.4 正文抽取(核心 —— 把会员期内的「访问权」转成「拥有权」)

> **原则**:只搬运用户浏览器里已经渲染出来的文字,等同于「选中 + 复制」的自动化。**不破解、不解密、不访问用户无权限的内容**。用户是会员/已购 → 浏览器能渲染 → 我们能抓;用户无权限 → 浏览器本来就不渲染 → 我们也抓不到。
>
> **UX 承诺(铁律)**:**用户只点一次按钮,脚本全自动完成,绝不要求用户手动翻页**。一本书 2~5 分钟,一架 50 本书挂机 2~4 小时。失败可断点续抓。

**默认模式:自动翻页(Reader-Driven)**

- [ ] 在阅读器页加按钮「导出本书正文」(单本入口)
- [ ] Dashboard 加「批量导出书架」(全量入口),可全选 / 多选 / 排队
- [ ] 自动翻页实现:
  - 程序化调用 weread 的章节切换(优先用其内部 React store action,降级用模拟点击「下一章」按钮)
  - 用 MutationObserver 等本章 DOM 渲染稳定(连续 500ms 无变更视为渲染完成)
  - 从 `.readerContent` / `.app_content` 抓 `textContent`(保留段落结构)
  - **每章之间随机延迟 1~3 秒**(反检测必需,不可去掉)
- [ ] 后台运行:tab 可最小化、可切到后台,用户能去做别的事;不强制保持前台
- [ ] **断点续抓**:每抓完一章立即写 IndexedDB 进度表;中途崩溃/关闭 Chrome → 下次点「继续」从上次卡的章节接着抓
- [ ] 进度 UI:Dashboard 显示「正在抓《XXX》第 7/24 章,预计还需 X 分钟」,可暂停、跳过本书、中止
- [ ] 风控应对:遇到 403 / 429 → **立即暂停整个批次**,弹通知告诉用户「微信读书暂时拒绝,建议等待 30 分钟后继续」;**不要傻重试**
- [ ] **输出格式(必须是「完整的书」,不接受纯 TXT)**:每本书产出一个独立文件夹,包含:
  - **`{书名}.epub`** —— 主交付物,标准 EPUB3 格式,含:封面页(高清封面)、版权页(标题/作者/译者/ISBN/出版社/出版年/简介/标签)、完整可跳转目录(NAV+NCX)、按章节独立的 XHTML、附录(我的笔记/划线汇总)。在 Apple Books / Calibre / KOReader / Kindle 等阅读器打开 = 和正版电子书无异
  - **`{书名}.md`** —— 给 Obsidian/知识库用,YAML frontmatter + 章节 + 内嵌划线/想法(blockquote 引用) + 附录全划线
  - **`cover.jpg`** —— 独立封面图(备用)
  - **`highlights.md`** —— 划线独立文件(可单独导入笔记 App)
  - **`reviews.md`** —— 想法/书评独立文件
  - **`meta.json`** —— 结构化元数据(便于将来 re-import 回库)
- [ ] **整架导出额外产物**:
  - `_index.md` —— 全部书的目录索引
  - `_stats.md` —— 阅读统计(总书数、总字数、总时长、Top 作者、阅读时段)
- [ ] **EPUB 生成实现要点**:每章独立 XHTML(支持阅读器原生翻章节);保留段落结构(`<p>`);图片内嵌进 epub(若书内有图);提取真实出版信息(从 weread `/web/book/info` API);划线作为 EPUB Annotation 或附录章
- [ ] **必须显式警告 UI**:仅供个人离线备份;不得分享、不得二次发布;版权归原作者/出版社

**可选模式:Turbo / API 直取(默认关)**

- [ ] 实验性功能,设置里要主动开启
- [ ] 直接 POST `/web/book/chapter/...` 拿加密载荷
- [ ] 提取 weread 自己的解密函数(从其 webpack chunk 里找),本地解密
- [ ] 速度 5~10 秒一本,比默认快 30~60 倍
- [ ] **预期会随 weread 更新而失效**,失效时自动 fallback 到默认模式 + 提示用户「Turbo 暂时不可用,已切回标准模式」
- [ ] 维护策略:每季度检查一次,失效时社区贡献修复(不强求维护者立即响应)

**核心使用引导**

- [ ] Dashboard 首次进入「微信读书」tab 时,**显眼提示**:「趁还在会员期,把你想长期保留的书一次性归档到本地。会员到期后,已归档的书永远是你的。」
- [ ] 提供「**一键归档整架**」按钮,排队夜跑

#### 4.5 阅读时长归档

- [ ] 周期性拉 `/web/reading/readhistory`,写入 `reading_sessions`
- [ ] Dashboard 显示读书时长统计

### 退出标准

- 一键能把当前打开的书的全部笔记导出为 MD
- 「同步书架 + 笔记」按钮能把整个账号的笔记搬到本地
- 即使微信读书账号被封 / 会员过期,已归档的笔记 / 已导出的正文不受影响

---

## Act 5(研究分支,不承诺主线)· 高风险边界验证

> Act 5 不是产品路线承诺。每个 spike 都必须先写验证报告:能抓到什么、账号风险、维护成本、是否违反项目铁律。验证失败就归档为「不做」。

### 5.1 视频号 Web 归档 spike

- [ ] 只验证 `channels.weixin.qq.com` 公开页面,不碰 App-only 私域
- [ ] 阶段 A:元数据归档 —— 标题、描述、作者、发布时间、封面、公开视频 URL、可见统计
- [ ] 阶段 B:单条公开视频备份 —— 只在用户打开单个视频页时尝试,记录是否需要 `decode_key` / WASM / XOR 解密
- [ ] 不做批量作者主页、不做并发、不做登录态绕过、不承诺 mp4 稳定下载
- [ ] 若需要长期维护解密 WASM 或模拟客户端,默认判定为不进入主线

### 5.2 公众号创作者后台解放 spike

- [ ] 仅当用户明确是公众号创作者时启动
- [ ] 单独评估 `mp.weixin.qq.com/cgi-bin/*` 后台页面:文章列表、阅读数据、粉丝画像、留言、素材库
- [ ] 作为独立「Creator Exporter」规划,不混入读者侧 IndexedDB schema
- [ ] 所有后台数据默认只本地保存,不自动提交 Wayback / Webhook

### 5.3 只读静态站 / 多端导出器

- [ ] 从整库 JSON dump 生成 GitHub Pages 只读站
- [ ] 从 dump JSON 生成 Notion / Logseq / Anki 导入包

---

## 时间线建议(单人节奏)

```diagram
  Week 1-2       Week 3-5             Week 6-7        Week 8-10
╭──────────╮  ╭─────────────────╮  ╭─────────────╮  ╭──────────────╮
│  Act 1   │─▶│  Act 2          │─▶│  Act 3      │─▶│  Act 4       │
│ 加固     │  │ 影子库 + 搜索   │  │ 协议桥      │  │ 微信读书     │
│ v1.1     │  │ v2.0(质变点)   │  │ v2.1        │  │ v3.0         │
╰──────────╯  ╰─────────────────╯  ╰─────────────╯  ╰──────────────╯
```

每个 Act 完成时都发一个 GitHub Release,作为可回滚锚点。
