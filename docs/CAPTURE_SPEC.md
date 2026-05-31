# 抓取规格 · WeChat Liberator

每个域名 / 每种页面下,**能抓到什么、怎么抓、抓到后映射到哪张表**。

---

## 公众号 · `mp.weixin.qq.com`

### A. 文章页 `/s?__biz=...&mid=...&idx=...&sn=...`(也就是 `/s/*`)

#### URL 参数(必抓)

```
https://mp.weixin.qq.com/s?__biz=MzIxxxx==&mid=2247491234&idx=1&sn=abcdef...&chksm=...
```

- `__biz`、`mid`、`idx`、`sn` 直接从 `location.search` 解析(必有)
- 短链 `/s/xxxx` 也要支持:页面里有 `var biz = ""`、`var mid = ""` 等全局 JS 变量

#### 页面内 JS 变量(在 `<script>` 块里,用正则提)

| 变量 | 含义 |
|---|---|
| `var biz = "..."` | `__biz` |
| `var mid = "..."` | `mid` |
| `var idx = "..."` | `idx` |
| `var sn = "..."` | `sn` |
| `var ct = "..."` | 创建时间 unix |
| `var nickname = "..."` | 公众号名(也可从 `#js_name` 取) |
| `var user_name = "..."` | gh_xxx,公众号 username |
| `var msg_title = "..."` | 标题(也可从 `#activity-name` 取) |
| `var msg_desc = "..."` | 摘要 |
| `var msg_cdn_url = "..."` | 封面 |
| `var ori_head_img_url = "..."` | 公众号头像 |
| `var copyright_stat = ` | 版权码 |
| `var is_only_read = 1/0` | 是否原创 |
| `var item_show_type = ` | 类型 |
| `var appmsg_type = "9"` | 9=图文 |

实现:

```js
function pickWindowVar(name) {
  const m = document.documentElement.outerHTML.match(
    new RegExp(`var\\s+${name}\\s*=\\s*["']?([^"';]*?)["']?\\s*[;\\|\\|]`)
  );
  return m ? m[1] : null;
}
```

#### DOM 选择器(主体抓取,已有代码用着的)

| 选择器 | 用途 |
|---|---|
| `#activity-name` | 标题 |
| `#js_content` | 正文容器(必须存在,否则不是图文) |
| `#js_name` | 公众号名(冗余) |
| `#meta_content em#publish_time` | 显示的发布时间(冗余) |
| `#js_author_name` | 作者(若标了) |
| `.rich_media_meta_list` | 元信息区(标题下) |

正文清洗、懒加载修复、代码块标准化等管线 **沿用现有 [src/content/index.js](file:///Users/chris/dev/tools/wechat-markdown-exporter/src/content/index.js) 的实现**(已经做得不错),只需把它从 message handler 里抽出来。

#### XHR 拦截(可选,获取阅读数)

文章页加载后会调用一个 POST 拿统计数据:

```
POST https://mp.weixin.qq.com/mp/getappmsgext?...
Body: __biz=...&mid=...&idx=...&sn=...&...
Resp JSON:
  {
    "appmsgstat": { "read_num": 12345, "like_num": 234, ... },
    "comment_count": 5,
    "is_temp_url": 0,
    ...
  }
```

**抓法**:content script 注入一个 `fetch` / `XMLHttpRequest` 的 monkey patch,匹配 URL 是 `getappmsgext` 时复制响应。

> 注意:**仅 host_permissions 包含该域时才能在 content script 拦截到自己页面的 fetch**;v1 可以不做,后续再加。

#### 评论(可选)

```
POST https://mp.weixin.qq.com/mp/appmsg_comment?action=getcomment&...
```

抓法同上。v1 不做,Act 2 后期考虑。

#### 映射到表

→ `articles` 一条 + `pubs` upsert + `reads` 新增一条

---

### B. URL 净化(文章页辅助能力)

#### 输入

当前页面 URL 或任意用户复制进来的公众号文章 URL。

#### 保留字段(内容锚)

| 参数 | 说明 |
|---|---|
| `__biz` | 公众号 ID |
| `mid` | 文章组 ID |
| `idx` | 同组内序号 |
| `sn` | 内容签名 |
| `chksm` | 微信校验字段,有则保留 |

#### 删除字段(tracking / 会话痕迹)

`from`、`scene`、`ascene`、`sessionid`、`clicktime`、`enterid`、`devicetype`、`version`、`lang`、`nettype`、`exportkey`、`pass_ticket`、`wx_header`、`__biz_no_redirect`、`mid_no_redirect`。

实现要求:

- 用 `new URL()` 和 `URLSearchParams`,不要用字符串替换
- 对短链 `/s/xxx` 保留原 path,只清 query
- 对非 `mp.weixin.qq.com` URL 直接返回原 URL + `changed:false`
- 如果清理后页面变成「请在微信里打开」,只展示提示,不承诺绕过

---

### C. 公众号合集/专辑 `/mp/appmsgalbum`

#### 页面形态

```
https://mp.weixin.qq.com/mp/appmsgalbum?__biz=xxx&action=getalbum&album_id=xxx
```

#### URL 参数(必抓)

| 参数 | 说明 |
|---|---|
| `__biz` | 公众号 ID |
| `album_id` | 合集 / 专辑 ID |
| `action` | 通常为 `getalbum` |

#### 列表抓法

优先级:

1. **DOM 解析**:合集页 HTML 里常见文章节点带 `data-link`、`data-title`、封面背景图、创建时间文本
2. **JSON 接口**:在用户打开合集页后,同源调用:

```
GET /mp/appmsgalbum?action=getalbum&__biz=xxx&album_id=xxx&count=20&is_reverse=1&f=json
```

分页字段:

- `begin_msgid`:上一页最后一篇文章的 `msgid`
- `begin_itemidx`:上一页最后一篇文章的 `itemidx`
- `count`:建议 10 或 20,不要拉满
- `is_reverse`:用户选择顺序;默认 `1` 从旧到新,便于系列阅读

#### 输出结构

→ `albums` upsert 一条 + `album_items` 多条。文章正文不在合集页抓,只把文章 URL 投递给归档队列,走标准 `extractArticle` 管线。

#### 风控

- 必须用户点击「归档本合集」后才开始
- Dashboard 作为常驻执行器串行处理,同一时刻只打开/处理一篇文章
- 每篇之间随机等待 2~5 秒
- 遇到 403/429/验证码/异常登录提示,暂停整个合集任务
- 不做「公众号历史消息」全站爬取

---

### D. 搜一搜结果 `/s?...`

> 只记录用户实际看到的结果,不声称能解构微信算法。

#### 触发条件

用户主动打开微信搜一搜结果页,content script 检测到结果列表容器后注入「保存本次结果」和「选择归档」按钮。

#### 抓取字段

| 字段 | 说明 |
|---|---|
| `query` | 用户搜索词,从 URL 或搜索框 DOM 读取 |
| `captured_at` | 抓取时间 |
| `result_rank` | 当前页面展示顺序 |
| `title` | 结果标题 |
| `summary` | 结果摘要 |
| `pub_account_name` | 公众号名(若展示) |
| `source_url` | 文章 URL |
| `cover_url` | 封面(若展示) |

映射:

→ `search_snapshots` 一条 + `search_results` 多条。用户勾选归档时,只把 `source_url` 投递到队列,仍按文章页标准管线处理。

---

### E. 「查看历史消息」类页面

> **不做**。即使能抓也容易触发反爬,且现已基本封掉。**保持只在用户主动打开的文章页归档**这一原则。

---

## 公共存证 · `web.archive.org`

### A. Save Page Now(公开公众号文章)

#### 触发

- 手动:文章页 / Dashboard 文章详情点击「提交 Wayback」
- 自动:用户在设置里打开 `wayback_mode = auto_public_articles`

#### 输入

必须使用 URL 净化后的公开公众号文章 URL。禁止提交:

- 微信读书正文、书架、笔记
- Dashboard / `chrome-extension://` 私有页
- 需要登录态才能访问的页面
- 用户明确标记为私密的文章记录

#### 调用策略

优先尝试 SPN2 JSON 流程:

```
POST https://web.archive.org/save
Accept: application/json
Authorization: LOW <accessKey>:<secretKey>   # 用户可选配置
Body: url=<clean_source_url>
```

若用户未配置 key,可尝试无认证保存,但必须预期失败:

- 浏览器端可能被 CORS 阻挡
- 返回头里的 `Location` / `Content-Location` 可能读不到
- Save Page Now 有限流和排队

#### 状态处理

- 若返回 job id,轮询 `/save/status/{jobId}`
- 成功后写入 `articles.wayback_snapshot_url`、`wayback_archived_at`、`wayback_status = "saved"`
- 失败后写入 `wayback_status = "failed"`、`wayback_error`
- 不自动重试超过 3 次;限流时提示用户稍后手动重试

---

## 微信读书 · `weread.qq.com`

> ⚠️ 微信读书 Web 端使用内部 API,**API 路径和签名机制可能随时变化**。下方列的是 2024-2025 年间观测到的端点,实现时请先用浏览器 DevTools 抓一遍最新的网络请求确认。
>
> 所有 API 都依赖用户已登录(cookie `wr_skey`、`wr_vid` 等),content script 因为运行在 weread 域内,fetch 时自动带 cookie。

### A. 书架 `/web/shelf*`

#### 端点

```
GET https://weread.qq.com/web/shelf/sync
GET https://weread.qq.com/web/shelf/friendCommon
GET https://weread.qq.com/web/book/wishList     # 想读
```

`/web/shelf/sync` 返回结构(简化):

```json
{
  "books": [
    {
      "bookId": "12345",
      "title": "...",
      "author": "...",
      "cover": "https://...",
      "version": 12345,
      "type": 0,
      "format": "epub",
      "category": "...",
      "isbn": "...",
      "intro": "...",
      "lastReadingDate": 1714500000,
      "progress": 78,
      "finishReading": 0,
      "paid": 1
    }
  ],
  "removed": [...],
  "synckey": "..."
}
```

#### 抓法

content script 注入到 `/web/shelf*`,从页面拿 cookie 后直接 `fetch('/web/shelf/sync', { credentials: 'include' })`,或者**优先用页面里 React store 的数据**(window 上挂载的全局 state,DevTools 找一下)。

#### 映射

→ `books` upsert 多条

---

### B. 阅读器页 `/web/reader/{bookId}`

#### 端点

```
GET /web/book/info?bookId=12345
GET /web/book/chapterInfos?bookIds=12345  # 章节列表
GET /web/book/bookmarklist?bookId=12345   # 我的划线
GET /web/review/list?bookId=12345&listType=11&maxIdx=0&count=200   # 我的想法 + 公开书评
GET /web/book/best?bookId=12345           # 最热划线(他人的)
```

#### 划线响应(简化)

```json
{
  "updated": [
    {
      "bookmarkId": "abc-123",
      "bookId": "12345",
      "chapterUid": 1,
      "chapterTitle": "第一章",
      "markText": "被划的原文",
      "range": "100-150",
      "style": 1,
      "colorStyle": 2,
      "createTime": 1714500000
    }
  ]
}
```

#### 想法响应(简化)

```json
{
  "reviews": [
    {
      "review": {
        "reviewId": "xyz-789",
        "bookId": "12345",
        "chapterUid": 1,
        "chapterTitle": "第一章",
        "abstract": "原文片段(若是章节内想法)",
        "content": "我的想法文字",
        "type": 1,
        "createTime": 1714500000
      }
    }
  ]
}
```

#### 映射

→ `highlights` upsert 多条 + `reviews` upsert 多条

#### 注意

- API 可能要求请求头里带 `Referer: https://weread.qq.com/web/reader/{bookId}`,content script 默认会带
- 部分签名参数(`s=...`)由 weread JS SDK 计算;**实测**这些端点很多不需要 `s` 也能返回数据,但若被限,fallback 方案是**从页面 React store 直接读**
- 若 store 抓不到,**最差降级**:模拟用户翻页,从 DOM 抓划线 hover 出来的 tooltip

---

### C. 正文章节内容(慎用)

#### 思路 1:API(快,但有签名机制)

```
GET /web/book/read?bookId=...&chapterUid=...
```

返回的是加密的章节文本,需要本地 JS 解密(weread 自己的 webpack chunk 里有解密函数)。**不推荐**:逆向脆弱,微信改一次就废。

#### 思路 2:DOM 抓取(慢,但稳)

让用户主动在阅读器里点「导出本书」,脚本依次:

1. 调用 weread 的章节切换 API(模拟点击下一章),等渲染完成
2. 从 `.app_content` 或 `.readerContent` 抓 `textContent`
3. 拼接成 Markdown
4. 章节之间随机延迟 1~3 秒

**这是 Act 4 默认实现**。失败优雅退出,已抓部分保存。

#### 映射

→ 不入 `books` 表的字段;**直接生成 MD 文件下载** + 可选写入 Vault;**不长期存正文 blob 进 IndexedDB**(太大)

---

### D. 阅读时长

```
GET /web/reading/readhistory                       # 全局
GET /web/book/readinfo?bookId=12345&readingDetail=1  # 单本
```

定时(每日一次)拉取,聚合到 `reading_sessions`。

---

## 跨域协同:派生订阅图谱

公众号没有官方「关注列表」可抓 → 用「我读过哪些号」做**派生订阅图谱**:

```diagram
articles 表 ──GROUP BY pub_account_biz──▶ pubs 表
                                              │
                                              ├──▶ OPML 导出
                                              ├──▶ Dashboard「我的公众号」视图
                                              └──▶ 「Top 10 我读最多的号」统计
```

- 用户打开 1 篇 → `pubs.article_count += 1`
- 用户打开 10 篇某号 → 公众号变成 Dashboard 推荐首选
- Webhook / RSS 也以 `pubs` 为单位订阅(「这个号又有新归档了」)

---

## 反检测原则(避免被微信识别为脚本)

1. **不主动 navigate**:不主动 `location.href = ...` 翻别人的文章页
2. **限速**:微信读书章节抓取每章随机 1~3 秒间隔,书架同步每日最多 N 次
3. **不并发**:同一时间只有一个抓取任务在跑
4. **失败立即停止**:遇到 403/429 → 停 30 分钟,弹通知告诉用户
5. **不修改用户身份相关**:不调登录/登出/修改密码等敏感 API
6. **可关闭**:任何自动行为都有设置项可关

---

## 视频号 · `channels.weixin.qq.com`(研究分支,不进主线)

### 允许验证的范围

- 用户主动打开的公开视频页
- 页面已展示的标题、描述、作者、封面、发布时间、可见统计
- 单条公开视频备份的技术可行性记录

### 不承诺的范围

- 不承诺稳定 mp4 下载
- 不做作者主页批量归档
- 不做并发
- 不绕过登录 / 私域 / 权限限制
- 不把 WASM 解密方案作为主线依赖

### 验证报告必须回答

1. 视频流是否可直接播放/下载,还是需要 `decode_key`
2. 若需要解密,是否依赖微信客户端 WASM、Isaac64/XOR 或其他逆向逻辑
3. 签名 URL 有效期多长
4. 普通浏览器扩展能否在页面上下文拿到足够材料
5. 失败/限流/异常登录提示出现时如何停止
6. 维护成本是否高于公众号/微信读书主线收益

默认判断:只要需要长期维护解密 WASM 或模拟客户端,就不进入产品主线。
