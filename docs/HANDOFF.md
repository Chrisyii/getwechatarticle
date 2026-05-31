# 交接说明 · WeChat Liberator

> 给下一个接手的 agent / 开发者:**先看本文,再按需展开其他文档**。

---

## 30 秒了解项目

**做什么**:浏览器扩展,把用户在微信 Web(公众号文章 + 合集/搜一搜 + 微信读书)上看到的内容,**自动复制一份到本地 IndexedDB**,提供搜索、导出、订阅、Obsidian 同步、Wayback 公共存证等出口。让用户不被微信封闭生态绑架。

**为什么**:微信不给导出权;一旦删文、封号、会员过期 → 用户数据消失。本项目作为「单向阀门」,趁用户有访问权时把数据搬出来。

**当前位置**:Act 1 起点。`src/content/index.js` + `src/popup/popup.js` 实现了「单篇公众号文章 → Markdown」的核心管线,质量不错。所有后续工作建立在这条管线上。

**下一步**:照 [ROADMAP.md](./ROADMAP.md) 走,从 **Act 1 加固**开始,**先不要跳过**(Act 1 的元数据完善 + 模块化抽离是 Act 2 的前置依赖)。不要提前做视频号/支付/创作者后台,这些已经降级为研究分支或不做。

---

## 文档地图

| 文档 | 何时读 |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 动手前必读 —— 系统分层、技术选型、七条铁律 |
| [IMPLEMENTATION_WORKFLOW.md](./IMPLEMENTATION_WORKFLOW.md) | 远端 agent 从 GitHub 拉取后按 Gate 逐阶段实现 |
| [ROADMAP.md](./ROADMAP.md) | 选定要做的 Act,看任务清单和退出标准 |
| [DATA_MODEL.md](./DATA_MODEL.md) | 写 IndexedDB / 导出 frontmatter 时查 |
| [CAPTURE_SPEC.md](./CAPTURE_SPEC.md) | 写 content script / 抓 API 时查 |
| HANDOFF.md(本文) | 入门 + 决策上下文 |

---

## 关键决策(已定,别再讨论)

1. **不做服务端**。整个项目是纯浏览器扩展 + 本地数据。
2. **不做主动爬虫**。只在用户已经打开的页面上提取。
3. **公众号「关注列表」用浏览历史反推**,不去碰真实关注列表(Web 端无入口)。
4. **能做的扩展菜单已经收敛**:
   - Act 2:干净阅读 + URL 净化、公众号合集/专辑批量归档
   - Act 3:Wayback 公共存证、搜一搜结果快照
   - Act 5:视频号只做 R&D spike,不承诺主线
5. **微信支付个人账单不做账号内抓取**。没有稳定 Web 表面,未来最多支持导入用户手动导出的账单文件。
6. **公众号创作者后台另起产品**。可作为 `Creator Exporter` 独立评估,不混进读者侧影子库。
7. **微信读书会员期内,把所有能读的书(含付费书)一次性抓到本地**。原则:**只搬运浏览器已渲染出来的文字,等同于「选中复制」的自动化**,不破解 DRM、不访问用户无权限内容。会员过期后,已抓的书永久在本地;新付费书因为浏览器本来也读不了,自然抓不到。把会员的「访问权」转成本地的「拥有权」 —— **这是项目核心价值**。
8. **图片默认只存 URL,不存 blob**,用户主动开启才本地化(容量考虑)。
9. **Dashboard 是常驻执行器**,Service Worker 不做长任务(MV3 SW 非持久)。
10. **存储用 Dexie.js**,全文搜索用 **MiniSearch**。
11. **不分账号**,所有数据一锅烩,按业务主键去重(详见 [DATA_MODEL.md](./DATA_MODEL.md))。

---

## 当前代码状态

```
src/
├── content/
│   └── index.js     # ✅ 公众号文章提取管线(Readability + Turndown);
│                    #   逻辑健壮,只需 Act 1 抽离为模块
└── popup/
    ├── index.html   # ✅ 复制/下载 两按钮的 UI
    ├── popup.js     # ✅ 工作正常
    └── style.css    # ✅ 微信绿主题
```

```
manifest.json        # ⚠️ host_permissions 有 localhost:5173 残留,Act 1 必删
                     # ⚠️ matches 只覆盖 /s*,Act 2 扩到 mp.weixin.qq.com/*
```

```
docs/                # ✨ 本次交接新增
├── ARCHITECTURE.md
├── ROADMAP.md
├── DATA_MODEL.md
├── CAPTURE_SPEC.md
├── IMPLEMENTATION_WORKFLOW.md
└── HANDOFF.md
```

**未实现**:Background Service Worker、Dashboard、IndexedDB、微信读书模块、协议桥(全部按 ROADMAP 推进)。

---

## 开发环境

```bash
npm install        # 已装过
npm run dev        # Vite + CRXJS HMR,改完代码扩展自动重载
npm run build      # 产出 dist/,在 chrome://extensions/ 加载该目录
```

加载到 Chrome:

1. 打开 `chrome://extensions/`
2. 右上角「开发者模式」开
3. 「加载已解压的扩展程序」→ 选 `dist/`
4. 改代码后无需手动 reload,CRXJS 会处理

---

## 开始 Act 1 的具体步骤

完整任务列表见 [ROADMAP.md § Act 1](./ROADMAP.md#act-1--加固楔子--公众号单篇导出无可挑剔)。建议执行顺序:

1. **清 manifest 残留**(2 分钟)
   - 去掉 `host_permissions` 里的 `http://localhost:5173/*`
   - `matches` 改成 `["https://mp.weixin.qq.com/*"]`

2. **新建目录结构**(10 分钟)
   ```
   src/
   ├── lib/
   │   ├── extractors/
   │   │   └── wechat-article.js   # 从 content/index.js 抽出来
   │   └── utils/
   │       └── frontmatter.js      # YAML frontmatter 生成
   ├── content/
   │   ├── wechat-article.js       # 薄壳,调用 lib/extractors
   │   └── shared/                 # 各 content script 公用
   └── popup/
   ```

3. **抽离提取逻辑**(1 小时)
   - 把 [src/content/index.js](file:///Users/chris/dev/tools/wechat-markdown-exporter/src/content/index.js) 里 `EXTRACT_CONTENT` 处理块的全部逻辑移到 `src/lib/extractors/wechat-article.js`
   - 导出纯函数 `extractArticle(document, window): ArticleRecord`
   - 新 content script 只负责 `chrome.runtime.onMessage` 监听 + 调用

4. **补全元数据**(2 小时)
   - 参考 [CAPTURE_SPEC.md § A. 文章页](./CAPTURE_SPEC.md#a-文章页-sbiz_) 的「页面内 JS 变量」表
   - 实现 `pickWindowVar()` helper
   - `ArticleRecord` 返回结构按 [DATA_MODEL.md § articles](./DATA_MODEL.md#articles--公众号文章)

5. **frontmatter 输出**(30 分钟)
   - `src/lib/utils/frontmatter.js`,生成 [DATA_MODEL.md § Frontmatter Spec](./DATA_MODEL.md#frontmatter-spec) 定义的 YAML 头
   - 在 popup「下载 .md」流程里拼到 markdown 顶部

6. **ZIP 导出**(2 小时)
   - 加 `jszip` 依赖
   - 新增按钮「下载 ZIP(MD + 图片)」
   - 抓 `image_urls`,各下载一份(`fetch` + blob),按 hash 命名
   - MD 内 `![](https://...)` 重写为 `![](./images/{hash}.{ext})`

7. **HTML 快照**(30 分钟)
   - 新按钮「下载 HTML 快照」
   - 直接保存清洗后 `documentClone` 里 `<article>` 的 outerHTML + 一个最小的 `<style>` reset

8. **测试夹具**(1 小时)
   - 用浏览器「另存为完整网页」存 3 篇风格不同的真实文章到 `tests/fixtures/`
   - 装 Vitest + jsdom
   - 写一个测试:`extractArticle(loadFixture('xxx.html'))` 返回的字段 satisfies 期望

完成后 → 发个 v1.1 tag → 进 Act 2。

---

## 从 GitHub 远端接手时

如果你是新 agent,按这个顺序执行:

1. 读本文到末尾,理解当前状态和禁止事项。
2. 读 [IMPLEMENTATION_WORKFLOW.md](./IMPLEMENTATION_WORKFLOW.md),按 Gate 执行,不要跳 Gate。
3. 每个 Act 开始前重读 [ARCHITECTURE.md](./ARCHITECTURE.md) 对应范围和 [ROADMAP.md](./ROADMAP.md) 退出标准。
4. 实现时同步维护 [DATA_MODEL.md](./DATA_MODEL.md) 和 [CAPTURE_SPEC.md](./CAPTURE_SPEC.md)。
5. 每个 Gate 必须留下 `npm test`、`npm run build` 和手动验证记录。

---

## 进入 Act 2 / 3 / 4 / 5 时

每次开始一个新 Act 之前:

1. **重读** [ARCHITECTURE.md](./ARCHITECTURE.md) 对应章节
2. **看清** [ROADMAP.md](./ROADMAP.md) 该 Act 的退出标准
3. **遵守**七条铁律(用户触发 / 本地优先 / 开放格式 / 可关可见 / 账号安全 / 完整导出物 / 公共存证显式授权)
4. 任何 schema 变更 → 同步改 [DATA_MODEL.md](./DATA_MODEL.md) 并写 Dexie migration
5. 任何新 capture 端点 / 选择器 → 同步加进 [CAPTURE_SPEC.md](./CAPTURE_SPEC.md)

### Act 2 实施提醒

- 干净阅读和归档 toast 共用浮层基础,不要各写一套互相打架的 UI
- URL 净化必须用白名单重建,不要正则删字符串
- 合集归档必须放 Dashboard 长任务队列,不要让 MV3 Service Worker 扛长任务
- 合集任务永远串行;失败/风控时暂停,不要重试刷屏

### Act 3 实施提醒

- Wayback 默认 `manual`,自动提交必须用户显式打开
- Wayback 只能提交公开公众号文章的干净 URL
- 搜一搜只保存用户实际看到的结果,不要写「算法解构」类承诺

### Act 5 实施提醒

- 视频号先写验证报告,再决定是否写代码
- 一旦需要长期维护解密 WASM / 模拟客户端,默认不进主线
- 微信支付继续视为 App-only,不要在插件里设计账号抓取方案

**文档和代码同步演进,不要让任何一边漂移。**

---

## 命名 / 品牌

- 项目代码内部仍叫 `wechat-markdown-exporter`(包名、仓库名暂不动)
- **Act 2 发布时**,扩展显示名(`manifest.json` 的 `name`)改为 `WeChat Liberator`
- 中文宣传名候选:「微信影子库」/「微信解耦器」(由产品决策)
- Slogan:**「让微信继续当渠道,你的阅读不再当人质」**

---

## 容易踩的坑

1. **MV3 Service Worker 非持久** —— 任何超过 30s 的任务都要放 Dashboard,不要放 SW
2. **content script 不能直接调 chrome.downloads** —— 走 `chrome.runtime.sendMessage` 让 SW 触发
3. **IndexedDB 在隐身模式下是内存的** —— 关闭即失,要提醒用户
4. **微信改版很频繁** —— 文章页 DOM、weread API 都可能变;每个 selector / API 都要有 fallback,失败时友好提示而不是崩
5. **图片防盗链** —— 微信图片有 referer 校验,本地化下载时要带 `Referer: https://mp.weixin.qq.com/`
6. **中文文件名** —— 写入 Vault 时要处理非法字符 + 文件系统大小写敏感(macOS APFS 默认不敏感、Linux ext4 敏感)
7. **CRXJS HMR 偶尔抽风** —— 改 manifest 后必须手动在 `chrome://extensions/` 点 reload

---

## 联系信息

- 仓库:https://github.com/chrisyii/getwechatarticle
- 项目所有人:Chris
- 当前对话记录(本次架构讨论):Amp Thread `T-019e7d7c-2fe6-7098-9cd3-141c49ef2a11`

---

## 一句话总结

**别把它做成另一个导出器。它的终局是「用户本地的微信知识资产层」,公众号导出只是入口楔子。**

每写一行代码前,问自己:
- 这行代码是不是把用户更「拥有」自己的数据?
- 用户卸载插件 / 微信封掉 / 会员过期时,这行代码做的事还成立吗?

成立才写。
