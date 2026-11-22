---
title: "widgets-refs-math"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-22
---

# Quiet.md 源码级拆解：小组件 + 引用体系 + 公式

> 对应 Clairis 关心的三个问题：⑧ 页尾反向引用 / 文内引用；⑫ 倒计时与日期提醒小组件；⑬ 公式（LaTeX math）。
> 所有结论均来自 `/Users/mason/ToHighs/quiet-md-main` 真实源码，路径:行号以该仓为准。
> 架构总览见 `docs/ARCHITECTURE.md`（单进程 GPUI 应用，文档 = 内存块树 `crates/core/src/model.rs` + 磁盘 DocxXML `docxml.rs`，编辑引擎在 `crates/core/src/editor/core.rs`，视图层在 `src/editor/`）。

---

## 一、引用体系：@文档 mention + 反向引用

### 1.1 数据模型：引用是"内联对象"，不是文本语法

Quiet 没有 `[[wikilink]]` 或 `@` 存进正文的语法——mention 是一个**内联对象 run**：

- 富文本模型：`RichText { text, runs: Vec<Run> }`，`Run { len, marks }`（`crates/core/src/model.rs:210-216`）。内联对象在文本里占一个 U+FFFC 字符，`marks.inline = Some(Inline { kind, xml })`（`model.rs:50-63`）。
- mention 的 kind：`InlineKind::DocLink(InlineDocLink)`（`model.rs:71`），结构体 `InlineDocLink { id: String, title: String }`（`model.rs:197-201`）。注释原文（`model.rs:193-196`）点明设计意图：
  > `@文档` a mention (`<cite type="doc" doc-id file-type>`)。The title is kept as its text, for exports and for a document that is gone; **the live title comes from the library**.
- 磁盘格式：`docxml.rs:554` 序列化为 `<cite type="doc" doc-id="…" file-type="docx">标题</cite>`；读回时 `doc-id` 缺失则退回 `href` 属性（`docxml.rs:600`）。`xml` 字段原样保存，**没建模的属性在读写往返中不丢**（`model.rs:54-56`）。

**标题变了引用怎么办？——不重写存量文本，渲染时查库取活标题：**

- 渲染层维护 thread_local 表 `DOC_TITLES: HashMap<doc-id, (title, icon)>`（`src/editor/text.rs:428-430`），由工作区经 `Editor::set_links` 注入（`src/editor/links.rs:66-80`）。
- mention 绘制函数 `doc_geom`（`text.rs:433-465`）：先查 `DOC_TITLES`；查到 → 用 `display_title(&t)`（去文件后缀等）+ 文档 emoji 图标 + 链接色 weight 500 绘制；查不到 → 显示"此文档已被删除"、`text_disabled` 色（`text.rs:437-441`）。
- 存储里的 `InlineDocLink.title` 只用于导出和已删除文档的兜底，**重命名文档不会触碰任何引用方文档的正文**。重命名只改目标文档标题并写索引（`crates/core/src/store.rs:2557-2572 Store::rename`）。标题变化时 `set_links` 把 `Links.generation += 1`（`links.rs:74-79`），触发所有 mention 行高与引用列表重排。
- 代价：`title` 快照会陈旧（导出的 Markdown/HTML 里可能是旧标题），换来 O(1) 重命名。

### 1.2 引用索引：保存时提取，随索引持久化

- 文档级提取：`Document::doc_links()`（`model.rs:1071-1091`）遍历所有块（含表格单元格，`for_each_block` model.rs:1039-1057），对每个含 U+FFFC 的块，为其中每个 mention 产出**去重后每 (target, block) 一条**：
  ```rust
  pub struct DocLink { pub target: String, pub block: usize, pub line: Vec<(String, Option<String>)> }
  // model.rs:974-979；block = for_each_block 序数，line = 段落文本的段落级"密文段"
  ```
  `line` 由 `link_line()`（`model.rs:981-1000`）构建：普通文本段 → `(文本, None)`；mention 段 → `(标题, Some(doc-id))`；公式段 → LaTeX 源码；U+FFFC/换行替换为空格。**反向引用面板因此能展示"引用它的那一行的原文，且行内其他 mention 用活标题渲染"。**
- 库级缓存：`store.rs` 的 `Parsed { title, icon, body, reminders, links }`（`store.rs:347`）解析缓存；`Entry.links: Vec<DocLink>`（`store.rs:296`）在打开库时批量解析（`store.rs:1465, 1662`），并**随 `.quiet/index.json` 一起持久化**（写出 `store.rs:1706`，读回 `store.rs:1697`）。所以反向链接查询不需要打开任何源文档。
- 保存时增量更新：`Workspace::flush` 保存成功后把 `doc.doc_links()` 写回当前 entry（`src/app.rs:1264`）；markdown 镜像被外部修改重读时同样更新（`app.rs:1225`）。哪个文档需要失效由 `store.rs:1516` 判断（有 mention 指向受影响 target 的 entry 重新解析）。
- 反向链接汇总：`Workspace::sync_links`（`app.rs:1405-1422`）：遍历 entries，`e.links.iter().filter(|l| l.target == 当前文档id)` → `Backlink { id, lines }`（`links.rs:31-35`）传给编辑器 `set_links`。

### 1.3 @ 输入面板：触发、过滤、键盘导航

状态：`Mention { block, trigger, start, selected }`（`links.rs:54-60`），trigger = "@" 的字节偏移。

- **触发**：文本变更后检查光标前最后一个字符是否 `@` 或全角 `＠`（`src/editor/view.rs:2727-2728`）→ `maybe_open_mention`（`links.rs:136-148`）。守卫：不在标题、不在代码块、块必须有文本。
- **保持条件**：每次变更跑 `sync_mention`（`links.rs:152-171`），任一命中即关：选区非折叠 / 块模式 / 光标换了块 / 光标回退到 start 之前 / 越过文本末尾 / trigger 处不再是 `@` / query 含换行 / query 超 40 字符 / query 以空格结尾且无结果。
- **过滤排序**：`mention_results`（`links.rs:179-191`）：候选 = 全库文档 + 文件夹（`DocRef { id, title, icon, folder, modified, opened }` links.rs:19-27），排除本文档。空 query 按**最近打开 → 最近修改**排序（"最近使用优先"）；有 query 按标题小写包含过滤，按修改时间倒序，截断 20 条。
- **键盘导航**：`mention_key`（`links.rs:197-225`）处理 Up/Down（循环 + `scroll_to_item`）/ Enter（选中或关闭）/ Esc；接线在 `view.rs:774-781`。鼠标：hover 即改 `selected`，mousedown 选中（`links.rs:309-323`）。
- **选中**：`pick_mention`（`links.rs:227-240`）把选区设为 `[trigger, head)`，`core.insert_doc_link(&InlineDocLink)`（`core.rs:1036-1038` → `insert_object` `core.rs:1040-1064`）把 `@query` 整段替换为 U+FFFC 对象 run。**面板宽度 280px、行高 48px（图标 32px + 标题 13pt + "最近修改：xx" 11pt 灰字）**，query 子串在标题中以主题色高亮（`links.rs:265-283`）；面板随光标，视口下方不足 380px 时翻到上方（`links.rs:348-352`）。

### 1.4 页尾反向引用 / 本文引用列表

- 位置与形态：文档正文之后作为列表的 `Item::Below` 渲染（`docs/ARCHITECTURE.md` 渲染节）；实现 `refs_list`（`links.rs:386-566`）。整块是圆角 5、`bg_overlay` 底、上下 margin 40 的"卡片"。
- **双 tab**：「反向引用 (n)」/「本文引用 (n)」（`links.rs:401-424`），活动 tab 主题色 + 加粗 + 底部 2pt 主题色条；默认 tab 按数量自动选（反向链接存在则优先，`links.rs:393`），手动切换记在 `Links.tab`。
- 反向引用每组一个文档行（文档图标/emoji + 链接色标题 15pt，点击 → `EditorEvent::OpenDoc`），带折叠 chevron（`Links.collapsed: HashSet`）；展开后逐行列出引用行文本（mention 段用活标题、链接色），**点击某行 → `EditorEvent::OpenDocAt(target, ordinal)`**（`links.rs:466-509`）→ 工作区 `open_at`（`app.rs:1424-1443`）：打开目标文档后用 `for_each_block` 数到第 ordinal 块 `scroll_to_block`。即"反向链接不只是跳到文档，而是跳到那一行"。
- 分页：超过 `INIT_RENDER=10 + 2` 条只显示 10 条 + 「查看更多」（每 tab 独立，`Links.more: [bool; 2]`，`links.rs:395-396, 512-521`）。
- 空状态文案："本文暂未被其它文档引用" / "本文暂未引用其它文档"（`links.rs:437-443`）。
- 可隐藏：右上 ✕ → `EditorEvent::HideRefs`；偏好存 `meta.refs_hidden`（`links.rs:391, app.rs:1419`）；隐藏要走确认对话框（"不再提示"可跳过，`app.rs:1452+ ask_refs`）。
- 行 key：`links_key`（`links.rs:94-110`）把引用数据哈希成 row key，虚拟列表只在数据变化时重排。

### 1.5 URL 链接的 hover 卡（对照参考）

`src/editor/link.rs` 是**网页链接**体系（与 mention 平行）：URL 识别正则族（`link.rs:15-72`，input rule `is_link_input` / `contains_url` / `normalize` 补 scheme）、⌘K 链接面板（`link.rs:118-160`）、1000ms 延迟 hover 卡（URL 预览 + 编辑/移除/复制 + 更多菜单，`link.rs:86-90, 404-470`）、点击打开（`link_release` `link.rs:605-615`：`quiet-wiki:` 前缀或相对链接 → `EditorEvent::OpenRelative` 进应用内打开）。

### 1.6 子页面列表与目录（catalogue）

- **子页面列表**（`src/editor/subpages.rs`）：块类型 `BlockKind::SubPageList`（`model.rs:757`），渲染成"本文档名小标题 + 子文档行列表"的卡片（1pt hairline、radius 5，行点击 → `OpenDoc`）。数据来自工作区注入的 `Editor::sub_pages`（`view.rs:206, 616-619`）——**它显示的是库层面的文件夹成员，不是文内块**。注：`menus.rs:381` 测试注释表明"子页面列表已随文件夹机制退出斜杠菜单"，即旧块类型仅兼容存量文档。
- **文档目录 catalogue**（`src/editor/catalogue.rs`）：页面左上角 pin 按钮的大纲面板，不是文内块。
  - 条目提取 `entries()`（`catalogue.rs:88-131`）：文档标题（带 emoji 图标）+ 所有标题块（跳过表格与高亮块内），编号标题带 `heading_orders` 的"1.2 前缀"；**level 是"出现的标题级别序"**（只有 h2/h4 的文档也只缩进一级）。
  - 布局模式 `CatMode { None, Pinned(f32), Unpinned, Forced }`（`catalogue.rs:30-38`）：无标题不显示；可 pin 在左侧占 144–265px；窗格太窄时变浮层（`page_layout` `catalogue.rs:44-77`，编辑列最窄 520px）。
  - 缓存：`update_catalogue`（`catalogue.rs:214-223`）按 `core.generation` 缓存 `cat_entries`（每次编辑 undo 栈 generation++，`ARCHITECTURE.md` Undo 节）。
  - **scroll-spy**：`spy()`（`catalogue.rs:237-271`）——视口顶部 90px（`ACTIVE_LINE`）内的最后一个标题为当前项；光标移动（未滚动）时取光标上方最近标题；点击跳转的项在跳转动画期间保持高亮（`cat_jump`）。点击 → `jump_to_heading`（`catalogue.rs:278-291`）：展开折叠链 + `Reveal::Block` 滚动。
  - 目录自身可折叠（`cat_collapsed`，隐藏更深层级行，`catalogue.rs:316-330`），行高 30px、每级缩进 14px，截断的行 hover 显示 tooltip。

---

## 二、倒计时（`src/editor/countdown.rs`，1045 行）

### 2.1 数据模型

块级 widget：`BlockKind::Countdown(Countdown)`（`model.rs:759`），结构体（`model.rs:816-830`）：

```rust
pub struct Countdown {
    pub duration: f64,      // 秒；= 设定时长 + 1（兼容 add-on 存储）
    pub start: u64,         // 开始的 unix ms；0 = 从未设置（显示 00:00:00:00）
    pub notify: bool,       // 倒计时结束时显示气泡提醒
    pub color: String,      // COUNTDOWN_COLORS 之一
    pub by_date: bool,      // 选择具体日期（否则输入时长）
    pub dhms: [u32; 4],     // 设置对话框记住的 天/时/分/秒
    pub date: String,       // "YYYY-MM-DD"
    pub time: String,       // "HH:mm"
}
```

- `remaining(now_ms) = round(duration) - ceil((now - start)/1000)`，下限 0（`model.rs:873-879`）。**存"时长 + 开始时刻"而非截止时刻**——同一份数据兼容浏览器插件导出的 `{duration, startTime, isNotify, color, timingType, settingData}` 记录（`model.rs:815` 注释），也意味着倒计时不会因重启应用而漂移。
- 七色常量 `COUNTDOWN_COLORS = ["#F76964", "#FF8800", …]`（`model.rs:853`），默认橙（`model.rs:855-868`）。

### 2.2 创建交互

- 斜杠菜单注册：`SlashKind::Countdown`，label「倒计时」，icon `timer`，色 ORANGE，**group 3「小应用」**，keywords `["倒计时","djs","timer","daojishi","countdown"]`（`src/editor/menus.rs:341-346`）。菜单过滤是四级排名：item 前缀 > group 前缀 > item 包含 > group 包含（`menus.rs:333-353 filter_slash`），拼音缩写关键词（"djs"）直接命中。
- 分发（`src/editor/view.rs:979-987`）：插入 `BlockKind::Countdown(Default::default())` 块 → `ensure_paragraph_after` 把光标放到后续空段落 → **立即打开设置对话框**。即创建即配置，不留"空白倒计时"。

### 2.3 渲染（`countdown.rs:186-330`）

- 四个色块「天 时 分 秒」右对齐排布（`ITEM_RIGHT = [204., 136., 68., 0.]`，`countdown.rs:21`）：每块 52px 高、radius 5、彩色底 + 白色加粗 26pt 数字（`{v:02}` 补零），块下 13pt 同色单位字，块间 28pt 加粗冒号。
- **"wave" 余量动画**：数字块上覆盖一层白色 15% 水洗层，其顶边位置 `top = 49 - 60 * progress`（progress = 剩余秒/总时长，`countdown.rs:196, 216-226`）——随时间流逝"水位下降"，是纯 CSS 式位移而非逐帧动画。
- hover 工具条：设置（pen-line 图标，打开对话框）+ 颜色（七色板 popover，22px 色片、radius 6、选中项主题色描边；**色板 hover 打开、离开 120ms 后关闭**，`cd_palette_hover` countdown.rs:299-323）。
- 改色走 `block_mut` 直改 + `checkpoint`（`countdown.rs:325-336`），属于 ARCHITECTURE.md 说的"直接属性修改"类（结构不变，不入通用编辑操作）。

### 2.4 刷新与到期行为

- **250ms tick 循环**（`CdUi::new` `countdown.rs:120-128`）→ `tick_countdowns`（`countdown.rs:349-368`）：只刷新**最近 1.5s 内实际绘制过的块**（`drawn: RefCell<HashMap<BlockId, Instant>>`，渲染时登记、5s 清理）——**离屏倒计时零开销**；秒位变化才 `cx.notify()` 重绘。
- 到期：`prev > 0 && left == 0 && c.notify` → 应用内 toast「倒计时已结束」（`ToastKind::Success`）。**不发系统通知**（与 reminder 的系统通知形成对照：倒计时是"在场"组件，提醒是"离场"信号）。
- 设置对话框（600px 模态，`cd_dialog` countdown.rs:551-724）：两张选项卡「输入倒计时时长」（4 个数字输入框，上限 999/23/59/59，各配下拉列表 100/24/60/60）/「选择具体日期」（日期 + 时间戳输入，278px 日历下拉，月切换）；未选模式的输入被遮罩层禁用（点击直接切模式）。校验：按日期且截止早于当前 → toast「设置的倒计时时间必须晚于当前 GMT+8 的时间」（`countdown.rs:408-412`）。确定时 `duration = (end - now)/1000 + 1`（`countdown.rs:414-417`）。
- 对话框内点击任意处先收起下拉并归一化输入值（`capture_any_mouse_down`，`countdown.rs:736-743`），Esc 先关下拉再关对话框（`cd_escape` countdown.rs:383-391）。

---

## 三、日期提醒（`src/editor/reminder.rs`，929 行）

### 3.1 数据模型

**内联对象**（不是块）：`InlineKind::Reminder(InlineReminder)`（`model.rs:115`）：

```rust
pub struct InlineReminder { pub expire: i64, pub notify: i64, pub should_notify: bool, pub whole_day: bool } // model.rs:178-186
```

- 时间都是 unix ms；`notify - expire` = 提前量（jet lag）。全天提醒到期时间 = 当日本地 23:59:59（`DAY_END = DAY - 1000`，reminder.rs:19-20）。
- 磁盘：`<time>` 元素（`docxml.rs:546-553`），写 `is-whole-day` 属性；**兼容旧文件**：无该属性且到期恰为本地 23:59 也按全天处理（`model.rs:172-175` 注释）。
- 文档级枚举：`Document::reminders()`（`model.rs:1060-1068`）收集全部提醒 → 存进 store `Entry.reminders` 缓存与 index.json（供 app 层调度，见 3.4）。

### 3.2 chip 呈现

- 正文里渲染为内联 chip（`src/editor/text.rs:473-486 reminder_geom` + `paint_reminder` text.rs:1359+）：文本 = `time_string`（`reminder.rs:62-102`）：今天/明天/昨天/本周X/下周X → M月D日 → 跨年 Y年M月D日，定时另加 " HH:MM"；多语言（9 种语言各有单测，reminder.rs:753-836）。
- **状态色**（`reminder.rs:117-127`）：已过期 红 R400；7 天内 橙 O400；更远 蓝 B600。配时钟图标 filled/outline 两态（text.rs:1368）。
- hover 卡显示完整日期「2026年10月23日，14:00」（`reminder.rs:468-491`）；**30s tick 重绘 chip**——跨天/状态变色无需手动刷新（`RmUi::new` reminder.rs:362-368）。

### 3.3 编辑交互（reminder_popover，`reminder.rs:521-660`）

- 插入：斜杠菜单「日期提醒」group 2「团队协作」keywords 含 `rqtx/tixing/reminder/date`（`menus.rs:331-336`）→ `insert_new_reminder`（`reminder.rs:471-478`）：`default_reminder` = **明天、当前半小时槽**（`reminder.rs:190-195`），插入后立即打开编辑器。另有快捷键 `on_insert_reminder`（`view.rs:2160, 2341`）。
- 编辑面板 314px：日历（周日起始、选中日主题色底）+ 两个 checkbox 选项：
  - **设置时间**：勾选后出现时间下拉 = 00:00–23:30 每 30 分钟一槽（`time_slots` reminder.rs:141-148），支持**键入搜索**（TextField 可输 `9:5`、`14：30`（全角冒号）、`3:00 pm`，`parse_time` reminder.rs:151-172，测试覆盖）；非整点时间插入到槽列表中保持有序。改为定时态时默认取"当前最近的槽"（`current_slot` reminder.rs:155-159）。
  - **提醒（提前量）**：定时态 9 档：事件发生时 / 提前 5 分钟 / 15 分钟 / 30 分钟 / 1 小时 / 2 小时 / 1 天 / 2 天 / 1 周（`TIMED` reminder.rs:31-42）；全天态 4 档，全是当天/提前 N 天的 09:00（`WHOLE` reminder.rs:43-46，因全天到期是 23:59:59）。
  - 切换全天↔定时（`toggle` reminder.rs:197-213）：改时间到当前槽或 23:59:59，**提前量重置为第一档**（保持 `notify - expire` 语义一致）；`on_day`/`at_time`/`with_jet`（reminder.rs:215-231）是三个纯函数，改日/改时/改提前量互不干扰。
- 所有点击先经 `capture_any_mouse_down` 统一"提交键入时间 + 收起下拉"再分发给具体控件（reminder.rs:630-645）；点击面板外即关闭并保留已键入时间（`reminder_blur` reminder.rs:436-442）。

### 3.4 提醒如何触发：应用级轮询 + 系统通知

- **15s 轮询**（`app.rs:546-557`，Workspace 启动时挂起）→ `check_reminders(from, to)`（`app.rs:1170-1181`）：
  ```rust
  for r in rs.iter().filter(|r| r.should_notify && from < r.notify && r.notify <= to) {
      notify_system(&display_title(&e.title), &crate::editor::reminder::notification(r));
  }
  ```
  当前打开文档读实时 `core.doc.reminders()`（含未保存编辑），其余文档读 entry 缓存。
- `notify_system`（`app.rs:402-410`）：macOS 用 `osascript -e 'display notification …'`（script 模式只打日志）。
- **启动窗口期不补发**：`last` 初始化为启动时刻（app.rs:551），"post what fell due since the last look (not what was missed while the app was closed)"——错过就错过，避免开屏通知轰炸。
- 存储就存在于文档正文 XML（随文档走），调度靠 entry 缓存，无独立数据库。

---

## 四、公式（`src/editor/math.rs`，1128 行）

### 4.1 渲染管线：KaTeX HTML → 自研 CSS 排版引擎

这是 Quiet 公式最有辨识度的部分：**它不满足于 katex-rs 的输出，而是在 GPUI 里重新实现了 katex.css（0.16）的排版**：

1. `render_html`（`math.rs:163-176`）：katex-rs `render_to_string`，`output: Html`、`throw_on_error: true`、**源码前统一拼 `\displaystyle`**、包 `catch_unwind`（katex-rs panic 不击穿应用）。
2. `parse`（`math.rs:196-246`）：quick-xml 解析 KaTeX HTML 成自制 DOM（`El { name, class, style, attrs, kids }`），class 去掉 `katex-` 前缀。
3. `Engine::el`（`math.rs:436-…`）递归排版，实现 katex.css 的**子集**：
   - 字体规则表 `FONT_RULES`（`math.rs:268-291`，20 条 class→(字体族/粗斜体) 映射：mathnormal→KaTeX_Math 斜体、mathbb→KaTeX_AMS、mathcal、mathfrak、mathtt、delimsizing size1-4、op-symbol 等）；
   - 字号 `SIZES[11] = [0.5 … 2.488]`（KaTeX 尺寸刻度，`math.rs:14`），`reset-sizeN sizeM` 换算；
   - 盒模型：margin/padding/border 解析（em/px/%，`len` math.rs:296-308；1–4 值缩写 `sides` math.rs:310-321），frac-line/overline/rule/hline/hdashline/sout/fbox/angl 各类的边框语义（`math.rs:515-560`），实线/虚线（虚线 = 3 倍线宽的虚段，`borders` math.rs:922-947）；
   - `vlist`（上下标、分式、根号的垂直堆叠）：`vlist()`（`math.rs:996-1053`）按 KaTeX 的 `top + pstrut` 语义实现；
   - 拉伸定界符/SVG（根号上横线、长箭头、花括号）：SVG markup 内容寻址缓存 `register_svg`（`math.rs:56-66`），viewBox 裁剪 + preserveAspectRatio 处理（`svg()` math.rs:949-994），`\xrightarrow` 等绝对定位件（`ABS` 类）。
4. 输出 `Math { width, ascent, depth, items: Vec<Item>, tag }`，`Item = Text(已整形字形行) | Rect(矩形) | Svg`（`math.rs:68-115`），基线坐标系统，`Math::paint` 直接 GPUI 绘制。
5. **字体**：KaTeX 20 个 TTF 内嵌 `assets/fonts/katex/`，`load_fonts` 注册（`math.rs:50-57`）；并**补丁了 fsSelection/macStyle 位**——上游 katex 字体全标 Regular，Windows DirectWrite 按 style bit 选字形，否则斜体括号画错（测试 `katex_faces_carry_their_style_bits`，`math.rs:1071-1090`，issue #214）。
6. **缓存**：thread_local `CACHE`，key = `(源码, display, 字号bits, 颜色, 公式编号)`，超 2000 条清空（`math.rs:139-160`）。

### 4.2 模型：inline 与 block 同一对象，布局二态

- **没有独立的"块级公式"BlockKind**。行内公式和展示公式都是内联对象 `InlineKind::Equation(src)`（`model.rs:66, 94`），文本里占一个 U+FFFC。
- 二态判定 `is_block(src)`（`math.rs:20-38`）：含换行 / 含 `\tag` / 含 `\begin{equation|split|align|gather|alignat|CD}` → 块级（注意 `\begin{align*}` 不算——它没有编号语义）。**用户不需要记 `$$`：多行单 `$` 公式也会自动按展示公式排版。**
- 绘制几何 `eq_geom`（`src/editor/text.rs:576-655`）：
  - 行内：`vertical-align: middle`，最小宽 16px，行高可被撑开（text.rs:25 注释："Row height: the line height, or more when an equation sticks out"）；
  - 展示：独占一行、水平居中、上下 1em margin；**过宽时整体缩放**（`d = row/(width+tag)` 比例重排至适配，带 `\tag` 时按"左公式右编号"紧凑排，`text.rs:605-645`）；
  - 源码为空 → 占位符「添加 LaTeX 公式」；KaTeX 拒绝 → 占位符「**无效公式**」+ 警告图标（`text.rs:583-613`）——语法错误有明确可视状态而非渲染残渣。
- **公式编号**：`\begin{equation}`/编号 align 行由 KaTeX 产出 `eqn-num` 元素，引擎遇之自增 `katexEqnNo` 计数器画 `(n)`（`math.rs:594-598`）；文档级计数通过 `numbers_in(src)` 预扫 + `NUMBERS` 缓存求和（`math.rs:118-136`），渲染层按块序传 `eqno`（`render.rs:21`）。即**自动编号跨文档连续**。

### 4.3 编辑交互

- 插入：斜杠「公式」（group 1 常用，keywords `gongshi/gs/latex/formula/equation/math`，`menus.rs:309-316`）→ `core.insert_equation("")`（`core.rs:1021-1023`）→ **立即打开公式编辑器**（`view.rs:965-970`）。
- 公式编辑器：400px 浮层锚定在公式下方（`equation_editor` `src/editor/overlays.rs:1157-1189`）：多行 LaTeX 输入框（打开时**全选现有源码**，`open_equation_editor` view.rs:1078-1092）、提示「按 ESC 完成输入」；**输入过程中公式实时重渲染**（源码写入 run 的 inline 标记，`set_object` core.rs:1066-1083）。Esc 退出时光标落在公式后（LeftEdge/RightEdge 事件分别落到前/后，`view.rs:359-360`）。点击正文里的公式即再次打开编辑器（`view.rs:2443`）。
- **输入规则**：键入 `$x$` 或 `$$x$$` 回车闭合时自动转内联公式对象（`core.rs:3017-3036`），带完整守卫链：`$` + 首位数字且 `is_numeric_math` 不满足 → 视为金额不转换；内容为空/首尾是 `$`/两侧不接中文标点或空白边界/区间内有 code 或既有内联对象 → 全部拒绝（`core.rs:3023-3033`）。
- 光标交互：公式在正文里是一个 U+FFFC 字符，方向键原子跨越（`EQUATION = "\u{fffc}"` core.rs:361）；行内公式与普通文本同行混排。

### 4.4 Markdown 互转

- **导入**（paste.rs）：多行 `$$…$$` → 独立块（`display_math`，`paste.rs:779-792` 附近；粘贴进段落时展示公式也拆成自己的块，`markdown_inline_lines` paste.rs:771-789）；`$…$` → 行内公式对象（`md_inline`）。`has_math`（paste.rs:794-817）判断文档是否含公式（围栏代码内的 `$$` 不算）。
- **导出**（markdown.rs）：展示公式 → `$$\n{src}\n$$`、行内 → `$src$`（`markdown.rs:770-871`；含公式与普通文本同行时的拼接规则与 `<br>` 修正）；往返测试 `display_math_round_trips`（markdown.rs:970-976）。
- **HTML 导出走 MathML**：`mathml(src)`（`math.rs:177-190`）用 katex-rs 的 `OutputFormat::Mathml` 产出 `<math>` —— 导出的 HTML 无需带 KaTeX 字体/JS。
- **Markdown 镜像限制**：`markdown_ok(SlashKind::Formula) == false`（`menus.rs:320-323`）——公式块不能存进 `.md` 镜像文件（ md 镜像只承载 md 能表达的块）。

### 4.5 斜杠菜单注册方式（汇总）

`src/editor/menus.rs` 是纯数据表：`SlashItem { kind, label, icon, color, group, keywords }` + 四个分组（基础/常用/团队协作/小应用，`menus.rs:37-42`）+ `filter_slash` 排名过滤 + `markdown_ok` 白名单。分发在 `src/editor/view.rs:950-1010` 的 `match kind`：块类走 `insert_block`，对象类（Formula/Reminder/Button）走 `core.insert_*` 后立即打开对应编辑浮层，Countdown/Board/DataTable 插入后立即进入配置。**新增一个小组件 = 数据表加一行 SlashItem + view.rs match 加一臂 + 渲染函数**，三处即完成注册。

---

## 五、Clairis 对应差距与借鉴清单

> Clairis 现状核对（`/Users/mason/ToHighs/clairis/src/`，grep `math|katex|backlink|mention|countdown|reminder|倒计时|反向引用|wikilink`）：
> - **公式已有**：渲染 `src/renderers/math.ts`（marked extension，`katex.renderToString`，块级 `mathBlockExtension` / 行内 `mathInlineExtension`，`renderers/math.ts:39-75`）；编辑态装饰 `src/editors/decorations/math.ts`（非活跃公式 KaTeX widget 替换、光标进入显示源码，`decorations/math.ts:158-206`）；能力开关 `isCapabilityEnabled("math")`（`src/lib/capabilities.ts:21`）。
> - **引用/mention/backlink：完全没有**（grep mention/wikilink/backlink 均为 0 命中）。
> - **倒计时/提醒：完全没有**（仅 AI 错误文案里一个"不提醒"）。
> - 已有可复用底座：斜杠菜单 `src/editors/slash.ts`（含分组/过滤/浮层）、智能输入 `src/editors/smart-input.ts`（`$`/`[` 选区配对包裹）、CM6 装饰体系、Zustand store、Playwright E2E。

### 5.1 文内引用（mention）——缺口最大，Quiet 的"id 键 + 活标题"是关键设计

- **(a) Quiet 做法**：mention = 内联对象 run，存 `<cite doc-id>`；渲染查 `DOC_TITLES` 用活标题；重命名零传播（1.1 节）；@ 面板空 query 按"最近打开"排序、40 字符/换行关闭守卫、选中即整段替换。
- **(b) Clairis 现状与差距**：无任何 note-to-note 引用；`smart-input.ts` 只有 `$`/`[` 的文本配对，无补全面板。CM6 侧也没有内联对象概念（装饰都是纯文本区间）。
- **(c) 可落地建议**（按 Quiet 经验取最省路径）：
  1. **引用键用稳定 id 而非路径/标题**。Clairis 是文件系统文档，可用打开时分配的稳定 id（或规范化路径 hash）写入 `[[id|快照标题]]`；**渲染时从 store 查活标题，重命名不回写正文**——这是 Quiet 最重要的架构决策（text.rs:433-441），直接复制。
  2. 触发交互直接套 CM6 的 `@codemirror/autocomplete`：输入 `@`/`[[` 开补全（等价 `maybe_open_mention` 的守卫：标题行/代码块内不触发、query 超 40 字符关闭、空格无结果关闭），过滤排序抄「空 query = 最近打开优先，有 query = 标题包含 + 最近修改倒序，截 20 条」（links.rs:179-191）。
  3. 提交时替换 `@query` 整段为 `[[id|title]]` 文本 + 行内 decoration（chip 样式、链接色、删除文档显示"此文档已被删除"灰字）。第一版**不必做内联对象**——文本 + 装饰在 CM6 里等价且可 diff，代价是 title 快照随文本走（与 Quiet 存 `InlineDocLink.title` 行为一致）。

### 5.2 页尾反向引用——先建索引，再谈 UI

- **(a) Quiet 做法**：保存时提取 `doc_links()`（target, 块序数, 行文本段）→ 存进库级 index（**反向链接查询不打开任何文件**）→ 文档尾部双 tab 卡片（反向引用/本文引用），每行可点直达"目标文档第 N 块"，可隐藏带确认（1.2/1.4 节）。
- **(b) Clairis 现状与差距**：无索引无 UI。但有现成挂点：`stores/index.ts` 管文件列表；保存流程（schedule_save 类似 Quiet 的 500ms flush）可插提取钩子；编辑器列表尾部有渲染位。
- **(c) 可落地建议**：
  1. 索引层：保存时扫描 `[[id|…]]`（正则即可，第一版不用解析器），产出 `Map<targetId, Array<{sourceId, line}>`，存内存 Zustand + 随工作区状态持久化。Quiet 的"行文本段 + mention 段分离"（`line: Vec<(String, Option<String>)>`，model.rs:974）建议照抄——反向引用行的"高亮引用词"体验全靠它。
  2. UI 层：编辑器/预览尾部引用卡片，双 tab + 每源文档折叠 + 超过 10 条"查看更多"；点击行 = 打开文件 + CM6 按 `line` 文本搜定位 `scrollIntoView`（等价 Quiet 的 `open_at` ordinal 跳转，app.rs:1424-1443）。
  3. 设置里给"隐藏引用列表"开关（Quiet 的 refs_hidden + 确认对话框是打磨项，第一版可只留开关）。

### 5.3 倒计时 / 提醒小组件——两个"即插即配置"模式可整体移植

- **(a) Quiet 做法**：见第二、三节。三个共性模式值得抄：
  1. **创建即配置**：斜杠插入后立即打开设置对话框，不留空壳（view.rs:979-987、reminder.rs:471-478）；
  2. **值域锚定**：倒计时存 `时长+开始时刻`（不漂移），提醒存 `expire + 提前量` 两个绝对时刻，编辑器纯函数 `toggle/on_day/at_time/with_jet` 保证各字段独立修改不互相破坏（reminder.rs:197-231）；
  3. **节能 tick**：只 tick 最近绘制过的块（countdown.rs:349-368），离屏零开销。
- **(b) Clairis 现状与差距**：完全没有。Clairis 是 CM6 + Markdown 文件，块级小组件需要落成**文本语法**（Quiet 用二进制块树所以能塞任意 BlockKind；Clairis 的对应物是 fenced 语法或 directive，如 ```` ```countdown ```` / 行内 `@{2026-01-01}`，与现有 callout/fileEmbed 装饰同构）。
- **(c) 可落地建议**（按收益排序）：
  1. **先做提醒**：数据模型直接抄 `InlineReminder { expire, notify, should_notify, whole_day }` 四字段（含"全天 = 当日 23:59:59"的语义）；chip 装饰（状态三色 + 相对日期文案 `time_string`）可整体翻译成 TS；触发侧 Tauri 有 `tauri-plugin-notification`，工作区层 15s 轮询 entry 缓存即可复刻 `check_reminders`（app.rs:1170-1181），"启动不补发"语义一并抄。
  2. **倒计时其次**：块级 fence 语法 + CM6 block widget（复用 `decorations/math.ts` 的 widget 两态模式：光标进入显示源码）；tick 用单个 `setInterval(250ms)` + widget 自身 `eq()` 判秒位变化；到期行为第一版只做应用内 toast。
  3. 斜杠菜单注册：`src/editors/slash.ts` 的命令表加两项即可，成本极低。

### 5.4 公式：**Quiet 的公式能力在"渲染保真度"上并不比本仓强，强在编辑体验与语义层**

- **(a) Quiet 的做法**：katex-rs 出 HTML → 自研 900 行 CSS 排版引擎在 GPUI 重排（math.rs:436+）+ 内嵌 KaTeX 字体（补 fsSelection 位）+ vlist/SVG 拉伸件/边框/尺寸刻度手写 + (源码,display,字号,颜色,eqno) 五元组缓存。这是**为了脱离浏览器做原生排版**付出的巨大工程。
- **(b) Clairis 现状**：直接用官方 KaTeX + `katex.min.css` 在 webview DOM 里渲染（renderers/math.ts:27-33, decorations/math.ts:52-60），block/inline 双 extension、货币守卫、围栏代码跳过、能力开关、编辑态两态（源码可见可编辑）。**渲染正确性上两者等价**——Quiet 手写引擎的目标就是逼近 katex.css 在浏览器里的效果，而 Clairis 本来就在浏览器里。
- **逐项对比 Quiet 强在哪 / Clairis 差在哪**：
  | 维度 | Quiet | Clairis | 判定 |
  |---|---|---|---|
  | 渲染保真 | 自研 katex.css 子集（覆盖大部分但非全部 CSS 语义） | 官方 katex.css 全量 | **Clairis ≥ Quiet** |
  | 编辑态公式 | 点击公式 → 400px 源码浮层（打开全选、实时重渲、Esc 退出、左右边缘落点控制，view.rs:1078-1105, overlays.rs:1157-1189） | 光标进入区间显示源码，无浮层、无实时预览、无"完成后落点"控制 | **Quiet 明显更强**：长公式在行内编辑易错位，浮层编辑 + 原位实时预览体验好得多 |
  | 输入规则 | 键入 `$x$` 自动转对象，含金额/边界/嵌套守卫链（core.rs:3017-3036） | 只有选区配对包裹（smart-input.ts #4），键入闭合后不自动转换 | **Quiet 更强**（可低成本补：inputHandler 里检测 `$…$` 闭合即转 decoration） |
  | display 判定 | `is_block`：多行 / `\tag` / `\begin{equation|split|align|gather|alignat|CD}` 即便写成单 `$` 也按展示排版（math.rs:20-38） | 仅按 `$$` vs `$` 定界 | **Quiet 更强**（一条 `/\n/` 判断即可补：inline tex 含换行或 `\begin{align}` 时走 displayMode） |
  | 语法错误呈现 | 专属占位「无效公式」+ 警告图标；空源码占位「添加 LaTeX 公式」（text.rs:583-613） | `.katex-error` 显示原文（throwOnError:false 的兜底） | Quiet 更完整；Clairis 可加同款占位 |
  | 公式编号 | `\begin{equation}`/编号 align 自动 (1)(2)… 且**文档级连续**（katexEqnNo 计数器，math.rs:118-136, 594-598）；过宽带 tag 时缩放排布（text.rs:605-645） | KaTeX 支持 `\tag`（手动编号），无自动连续编号 | **Quiet 更强**（进阶项，非刚需） |
  | 导出 | HTML 导出走 MathML（math.rs:177-190）；Markdown 镜像明确排除公式块（menus.rs:322） | 未见 MathML 导出 | Quiet 更强（若 Clairis 有 HTML 导出需求可补一行 `output:"mathml"`） |
  | 性能 | 布局缓存五元组 key + 2000 条上限；离屏不排 | KaTeX 每次重建 widget 重渲（CM6 `eq()` 缓存 widget 实例，同 tex 不重渲，已够用） | 等价 |
- **(c) 结论与建议**：**"Quiet 的公式能力是否比本仓强"——渲染内核不比本仓强（本仓用官方 KaTeX，保真度反而更高）；强的是四件事：① 点击式源码编辑浮层（带实时预览），② 键入 `$…$` 自动转换，③ display 判定启发式，④ 无效公式/空公式的占位态。** 四件事都能低成本移植：①② 各一个 CM6 扩展（浮层复用现有 orchestration/placement 的锚定机制）；③ 在 `decorations/math.ts` 的 parseInlineMath 里对 tex 加一次 `/\n|\bbegin\{(equation|align|…)/` 判断升级为块级；④ `MathWidget.toDOM` 里对空 tex 与渲染失败分支输出占位 DOM。无需引入任何新依赖。

### 5.5 目录（catalogue）附带观察

Quiet 的目录是**布局参与者**（pin 后压缩正文列宽、参与 bleed 计算，catalogue.rs:44-77），且 scroll-spy 用"视口顶 90px 内最后一个标题"的稳定算法（catalogue.rs:237-271）。Clairis 的预览若有 toc 需求，值得抄的是它的 level 排名（只有 h2/h4 时也只缩进一级，catalogue.rs:113-124）与"点击跳转期间保持高亮"的细节。

---

## 附：Quiet 三个体系的一张图

```
保存/打开 ──► store 解析缓存 Parsed{links, reminders} ──► Entry.links / Entry.reminders ──► index.json 持久化
                                                        │
     Document::doc_links() / reminders() ───────────────┘
（model.rs:1071 / 1060，遍历块树，mention = U+FFFC run 的 marks.inline）

Workspace::sync_links (app.rs:1405)                      Workspace 15s 轮询 (app.rs:546)
  └─► Editor.set_links ─► Links{docs, backlinks}          └─► check_reminders ─► osascript 系统通知
        ├─ @面板 mention_results / pick_mention → core.insert_doc_link
        ├─ DOC_TITLES thread_local ─► text.rs doc_geom 活标题渲染
        └─ refs_list 双 tab 卡片（Item::Below）→ OpenDocAt(ordinal)

公式：InlineKind::Equation(src) ─► katex-rs HTML ─► quick-xml DOM ─► Engine 排版 ─► Math{items} ─► GPUI paint
      is_block() 定二态；CACHE 五元组缓存；eqno 文档级连续；错误 → 「无效公式」占位
```
