# 数据模型 · WeChat Liberator

所有持久化数据都在 IndexedDB,通过 Dexie.js 操作。数据库名 `wechat_liberator`。

---

## v1 Schema(Act 2 引入)

### `articles` · 公众号文章

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | string | 🔑 PK | `${__biz}_${mid}_${idx}_${sn}`,去重锚 |
| `__biz` | string | idx | 公众号唯一 ID(base64) |
| `mid` | string | | 文章组 ID |
| `idx` | string | | 同组内序号 |
| `sn` | string | | 内容签名 |
| `source_url` | string | | `https://mp.weixin.qq.com/s?__biz=...` |
| `clean_source_url` | string | idx | 清洗 tracking 后的稳定分享 URL |
| `title` | string | idx (full-text) | 文章标题 |
| `author` | string | idx | 文章作者(可空) |
| `pub_account_biz` | string | idx | = `__biz`,冗余便于 join |
| `pub_account_name` | string | | 公众号名 |
| `pub_account_avatar_url` | string | | 公众号头像 URL |
| `pub_time` | number | idx | Unix ms |
| `captured_at` | number | idx | 首次归档时间 Unix ms |
| `last_seen_at` | number | | 最近一次访问时间 |
| `is_original` | boolean | | 是否原创 |
| `copyright_stat` | number | | 微信版权状态码 |
| `summary` | string | | 摘要(< 200 字) |
| `cover_url` | string | | 封面图 URL |
| `content_md` | string | (full-text) | 转好的 Markdown 正文 |
| `content_html` | string | | 原始 HTML 快照(已去噪) |
| `image_urls` | string[] | | 正文中所有图片 URL,便于后续本地化 |
| `read_count` | number | | 阅读数(若拦截到 XHR) |
| `like_count` | number | | 在看数 |
| `look_count` | number | | 点赞数 |
| `comment_count` | number | | 评论数 |
| `album_ids` | string[] | multi-idx | 所属合集/专辑 ID,可空 |
| `wayback_snapshot_url` | string | | Wayback 成功后的快照 URL |
| `wayback_status` | string | idx | `none` / `queued` / `saved` / `failed` |
| `wayback_archived_at` | number | idx | Wayback 快照时间 |
| `wayback_error` | string | | 最近一次提交失败原因 |
| `tags` | string[] | multi-idx | 用户加的 tag |
| `notes` | string | | 用户给本篇的备注 |
| `archive_version` | number | | schema 版本,便于将来重抓 |

**主键策略**:`__biz + mid + idx + sn` 组合,微信本身用这套去重,我们沿用。重复打开同一篇 → 更新 `last_seen_at` + `reads` 表追加一条。

### `pubs` · 公众号档案(派生订阅)

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `biz` | string | 🔑 PK | 公众号 `__biz` |
| `name` | string | idx | 公众号名 |
| `avatar_url` | string | | |
| `description` | string | | 公众号简介(若能抓到) |
| `first_seen_at` | number | | 首次出现时间 |
| `last_article_at` | number | idx | 最近一篇文章时间 |
| `article_count` | number | | 已归档文章数(衍生,可缓存) |
| `notes` | string | | 用户备注 |
| `tags` | string[] | multi-idx | 用户给公众号打的 tag |

### `reads` · 阅读历史

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | number | 🔑 PK auto | |
| `article_id` | string | idx | FK → `articles.id` |
| `opened_at` | number | idx | Unix ms |
| `read_duration_ms` | number | | 估算,基于 visibilitychange |
| `from_url` | string | | 来源(分享链接 / 搜一搜 / 直接打开) |

### `settings` · 设置(单行 KV)

| key | value 类型 | 默认 |
|---|---|---|
| `auto_archive` | boolean | `true` |
| `archive_images_inline` | boolean | `false` |
| `obsidian_vault_handle_id` | string | `null` |
| `webhook_url` | string | `""` |
| `wayback_mode` | string | `"manual"` (`off` / `manual` / `auto_public_articles`) |
| `wayback_auth_ref` | string | `""`(可选,指向浏览器安全存储/本地 helper 的凭据引用;不在 IndexedDB 明文存 secret) |
| `dashboard_default_view` | string | `"library"` |
| `db_schema_version` | number | `1` |

### `assets` · 图片 blob(默认不用,可选)

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `hash` | string | 🔑 PK | sha256(url),小写十六进制 |
| `source_url` | string | idx | 原始远端 URL |
| `mime` | string | | `image/jpeg` 等 |
| `blob` | Blob | | 二进制 |
| `bytes` | number | | 大小 |
| `referenced_by` | string[] | multi-idx | article id 列表,用于引用计数 |
| `captured_at` | number | | |

---

### `albums` · 公众号合集/专辑

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | string | 🔑 PK | `${__biz}_${album_id}` |
| `album_id` | string | idx | 微信合集 ID |
| `__biz` | string | idx | 所属公众号 |
| `pub_account_name` | string | | 公众号名(若能抓到) |
| `title` | string | idx (full-text) | 合集标题 |
| `description` | string | | 合集简介(若能抓到) |
| `cover_url` | string | | 封面(若能抓到) |
| `source_url` | string | | 合集页 URL |
| `article_count` | number | | 已发现文章数 |
| `last_scanned_at` | number | idx | 最近扫描时间 |
| `created_at` | number | | 首次看到时间 |

### `album_items` · 合集文章索引

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | string | 🔑 PK | `${album_id}_${msgid}_${itemidx}` |
| `album_record_id` | string | idx | FK → `albums.id` |
| `album_id` | string | idx | 微信合集 ID |
| `article_id` | string | idx | 若已归档,FK → `articles.id`;未归档时可空 |
| `source_url` | string | idx | 文章 URL |
| `title` | string | idx (full-text) | 列表标题 |
| `summary` | string | | 列表摘要(若有) |
| `cover_url` | string | | 列表封面 |
| `msgid` | string | | 分页锚 |
| `itemidx` | string | | 分页锚 |
| `rank` | number | idx | 合集内顺序 |
| `pub_time_text` | string | | 页面展示的日期文本 |
| `archive_status` | string | idx | `pending` / `archived` / `skipped` / `failed` |
| `error` | string | | 最近一次失败原因 |

### `search_snapshots` · 搜一搜结果快照

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | string | 🔑 PK | `${sha256(query + captured_at)}` |
| `query` | string | idx (full-text) | 搜索词 |
| `source_url` | string | | 搜一搜结果页 URL |
| `captured_at` | number | idx | 抓取时间 |
| `result_count` | number | | 本次抓到的结果数 |

### `search_results` · 搜一搜单条结果

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | string | 🔑 PK | `${snapshot_id}_${rank}` |
| `snapshot_id` | string | idx | FK → `search_snapshots.id` |
| `rank` | number | idx | 展示顺序 |
| `title` | string | idx (full-text) | 结果标题 |
| `summary` | string | | 结果摘要 |
| `pub_account_name` | string | idx | 展示的公众号名 |
| `source_url` | string | idx | 文章 URL |
| `article_id` | string | idx | 若已归档,FK → `articles.id`;未归档时可空 |
| `cover_url` | string | | 封面 |
| `archive_status` | string | idx | `none` / `queued` / `archived` / `failed` |

---

## v2 Schema(Act 4 · 微信读书表)

### `books` · 微信读书 书架

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `bookId` | string | 🔑 PK | 微信读书的 bookId |
| `title` | string | idx (full-text) | |
| `author` | string | idx | |
| `translator` | string | | |
| `cover_url` | string | | |
| `isbn` | string | | |
| `category` | string | idx | |
| `intro` | string | | 简介 |
| `type` | number | | 0=正常书、1=漫画、... |
| `is_finished` | boolean | | 是否已读完 |
| `is_owned` | boolean | | 是否买断 |
| `is_in_shelf` | boolean | | 是否在书架 |
| `progress_pct` | number | | 阅读进度百分比 |
| `added_to_shelf_at` | number | | |
| `last_read_at` | number | idx | |
| `total_read_ms` | number | | 总阅读时长(可周期性更新) |
| `synced_at` | number | | 上次拉取时间 |

### `highlights` · 划线

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `bookmarkId` | string | 🔑 PK | 微信读书的 bookmarkId |
| `bookId` | string | idx | FK → `books.bookId` |
| `chapter_uid` | number | | 章节 ID |
| `chapter_title` | string | | |
| `range` | string | | 划线 range(用于排序) |
| `marked_text` | string | (full-text) | 被划的文本 |
| `style` | number | | 0=直线、1=波浪、2=高亮 |
| `color_style` | number | | |
| `note` | string | | 自己写的想法(若有) |
| `created_at` | number | idx | |
| `synced_at` | number | | |

### `reviews` · 想法 / 书评

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `reviewId` | string | 🔑 PK | |
| `bookId` | string | idx | |
| `chapter_uid` | number | | 0 = 整本书的书评 |
| `chapter_title` | string | | |
| `abstract` | string | | 关联的原文片段(若是章节内想法) |
| `content` | string | (full-text) | 自己写的想法 |
| `type` | number | | 1=划线想法、4=书评 |
| `created_at` | number | idx | |
| `synced_at` | number | | |

### `reading_sessions` · 阅读时长

| 字段 | 类型 | 索引 | 说明 |
|---|---|---|---|
| `id` | number | 🔑 PK auto | |
| `bookId` | string | idx | |
| `date` | string | idx | `YYYY-MM-DD` |
| `read_ms` | number | | 当日阅读毫秒 |
| `synced_at` | number | | |

> 注:微信读书 API 只能拉到「最近 X 天的总时长」,无法精确到 session,所以我们用「日级」聚合。

---

## Frontmatter Spec(导出 MD 时的 YAML 头)

### 公众号文章

```yaml
---
title: "文章标题"
author: "作者名"
source: wechat
source_url: "https://mp.weixin.qq.com/s?__biz=..."
clean_source_url: "https://mp.weixin.qq.com/s?__biz=..."
wayback_snapshot_url: "https://web.archive.org/web/..."
pub_account: "公众号名"
pub_account_biz: "MzIxxxx=="
pub_time: 2024-05-01T10:23:00+08:00
captured_at: 2024-05-31T09:15:00+08:00
is_original: true
read_count: 12345        # 若抓到
like_count: 234
tags: [rust, async]      # 用户加的
liberator_id: "MzI..._2247491234_1_abc"
schema_version: 1
---
```

### 微信读书 · 单本书笔记导出

```yaml
---
title: "失控"
author: "凯文·凯利"
source: weread
book_id: "12345"
isbn: "978-..."
total_highlights: 87
total_reviews: 23
exported_at: 2024-05-31T09:15:00+08:00
schema_version: 2
---

## 第一章 ...

> **划线** [波浪线]
> 这里是被划的文本

📝 我的想法:这段提到的「自下而上」很启发……

> **划线**
> 另一段划线

...
```

---

## 文件命名约定(导出到 Obsidian Vault 时)

```
<Vault>/
├── WeChat/
│   ├── _attachments/
│   │   └── {sha256-12}.{ext}             # 图片
│   ├── 公众号名 1/
│   │   ├── 2024-05-01 文章标题.md
│   │   └── 2024-05-03 另一篇.md
│   └── 公众号名 2/
└── WeRead/
    ├── _covers/
    │   └── {bookId}.jpg
    ├── 失控 - 凯文·凯利.md
    └── 人类简史 - 尤瓦尔·赫拉利.md
```

- 文件名中的非法字符(`/ \ : * ? " < > |`)→ 替换为 `_`
- 同名冲突 → 文件名追加 `(2)`、`(3)`
- 已存在的笔记**永不覆盖**,只新增;用户可能在 Obsidian 里改过

---

## 主键去重总则

| 实体 | 主键 | 重复时行为 |
|---|---|---|
| article | `__biz + mid + idx + sn` | 更新 `last_seen_at`、补全 stats;不覆写 user-edited 字段(notes / tags) |
| pub | `biz` | 更新 `last_article_at`、`article_count`;不覆写 user-edited |
| album | `__biz + album_id` | 更新 `last_scanned_at`、`article_count`;不覆写 user-edited |
| album_item | `album_id + msgid + itemidx` | 更新 `archive_status`、`article_id` |
| search_snapshot | `sha256(query + captured_at)` | 不覆盖 |
| search_result | `snapshot_id + rank` | 更新 `archive_status`、`article_id` |
| book | `bookId` | 更新 `progress_pct`、`last_read_at`、`synced_at` |
| highlight | `bookmarkId` | 更新 `note`、`synced_at` |
| review | `reviewId` | 更新 `content`、`synced_at` |
| asset | `sha256(url)` | 追加 `referenced_by`,blob 不重存 |

---

## 数据迁移(schema_version 升级)

Dexie 自带版本化:

```js
db.version(1).stores({
  articles: 'id, __biz, clean_source_url, pub_time, captured_at, wayback_status, wayback_archived_at, *tags, *album_ids',
  pubs: 'biz, name, last_article_at, *tags',
  reads: '++id, article_id, opened_at',
  assets: 'hash, source_url, *referenced_by',
  albums: 'id, album_id, __biz, title, last_scanned_at',
  album_items: 'id, album_record_id, album_id, article_id, source_url, rank, archive_status',
  search_snapshots: 'id, query, captured_at',
  search_results: 'id, snapshot_id, rank, pub_account_name, source_url, article_id, archive_status',
  settings: 'key'
});
db.version(2).stores({ books: 'bookId, ...', highlights: 'bookmarkId, bookId', reviews: 'reviewId, bookId', reading_sessions: '++id, bookId, date' });
// 未来 v3 改字段时:
db.version(3).stores({ articles: 'id, __biz, pub_time, captured_at, *tags, *new_index' })
            .upgrade(tx => tx.table('articles').toCollection().modify(a => { a.new_field = 0 }));
```

每次发版前**测试一次跨版本迁移**(从 v1 库直接升到 v3 不能丢数据)。
