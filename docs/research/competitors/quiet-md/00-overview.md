---
title: "00-overview"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-22
---

# Quiet.md 总览侦察（汇总报告骨架 · 总览章）

> 来源：quiet-md-main 自带 docs/ARCHITECTURE.md（178 行）+ docs/FORMAT.md（132 行）直接读取。本文件是总览底稿，最终报告合并各域研究后写入 clairis `docs/research/competitors/`。

## 0. 项目定性（影响全部借鉴策略的三个事实）

1. **不是 Web 应用，无"反编译"必要**：Rust + GPUI（Zed 的 GPU 直绘框架）原生渲染，MIT 开源，~90k 行 Rust（core ~36k，其中画板 ~20k）。全部源码可读。
2. **磁盘真相源是 DocxXML（飞书文档格式），不是 Markdown**：富文档存 `.xml`（DocxXML），Markdown 只是导入/导出的转换目标；纯 `.md` 文件也支持。未知元素原样保留（`BlockKind::Raw`）、inline 对象 XML 原文回写。**这是"格式永不程序性错乱"的第一根因**：不存在"Markdown 文本 ↔ 富文档"的双向有损转换，只有单向解析 + 原样回写。
3. **编辑引擎与 UI 分离**：`crates/core`（fdl_core）独立可测（`cargo test -p fdl_core`），含随机编辑 fuzzer（fuzz_tests.rs），每步随机编辑后检查 9 条结构不变量（选区端点可见且同 scope、块 ID 唯一、run 不越界不重叠、列比例和为 1、合并单元格不重叠、嵌套合法性、代码块无样式、存读回环一致、undo→redo 回到同一状态）。

## 1. 分层架构

```
main.rs → app.rs(Workspace 两栏窗口)
  ├─ sidebar / home / search / trash / docmenu / docinfo / modes
  └─ editor::Editor(view.rs)
       └─ editor::Core(core.rs) ← 文档、选区、undo 栈（在 crates/core）
```

| 层 | 文件 | 职责 |
|---|---|---|
| Model | core/model.rs | Document/Block/BlockKind/RichText(text+style runs)/Inline{kind,xml}；BlockKind::nests() 控嵌套 |
| Format | core/docxml.rs | DocxXML ↔ Document；inline 对象占一个 U+FFFC |
| 编辑引擎 | core/editor/core.rs + table_ops.rs | 打字/删除/合并/缩进/转换/拖拽/表格/折叠/undo |
| Editor 视图 | src/editor/view.rs 等 | 键鼠事件 → Core 调用；overlay/菜单/块交互 |
| 渲染 | src/editor/render.rs + text.rs | 虚拟化 List；块树 → GPUI 元素 |

## 2. 编辑流（为什么输入丝滑且稳定）

1. 键盘事件 → `core.checkpoint(kind)`：取 undo 快照、generation++、dirty。**同一块内连续打字 <700ms 自动合并为一步**。
2. Core 方法改 `core.doc` / `core.sel`（内存树直接改，无文本重解析）。
3. 通知分流：
   - 打字/导航 → `changed()` → `reveal_caret()`（展开隐藏选区的折叠标题/列表项）+ 滚动跟随光标
   - 独立目标操作（勾选 checkbox、调列宽）→ `changed_preserving_viewport()`（保光标/选区/视口）
4. `Workspace` 收到 Changed → `schedule_save`：**500ms 防抖后 flush 写盘**。
5. 少数属性级修改（图片裁剪、countdown 设置、标题、折叠）由 view 直接 `core.block_mut(id)`，用 checkpoint/changed 括起来；**一切结构性编辑只走 Core**。

## 3. Undo（恢复稳定性的设计）

- **每步全量 Document 快照**：VecDeque ≤500 步、预算 ~256MB、长文档保底 ≥20 步。
- undo/redo 时 `keep_outside_history` 保护当前图标与折叠状态不被历史覆盖。
- **每次变更（含折叠）generation++**，渲染缓存/目录/字数统计据此检测过期。
- 文件操作（建/删/改名/移动/恢复）有**独立 undo 栈**，与文档 undo 分离；写锁内记录操作，undo 前检查文件状态与层级，从磁盘读当前内容。
- 实测：百万字符文档打字 median 5.06ms/帧。

## 4. 存储与可靠性（内容不丢的三道保险）

- **原子写**：`<name>.tmp` → fsync → `rename`；Unix 上还 fsync 父目录。
- **索引自愈**：写 index.json 前先备份 `.bak`；解析失败时把坏文件存为 `.corrupt-<秒>`、回退加载 .bak、提示一次；.bak 也坏则空索引起步（内容/结构/链接不丢，只丢元数据）。
- **保存失败**：顶部条报错；切文档/新建/退出前强制询问（retry / reload from disk / 存 recovery copy）；系统关机时保存失败 → 写入本地 `quiet-md/recovery/<library-id>/`，下次打开该库自动生成恢复副本。
- **版本历史**（`.quiet/history/<id>/`）：每次成功写盘后把**上一个**内存 body 存快照（文件名 = 13位毫秒时间戳-8位UUID）；自动快照 5 分钟节流；每文档 1-30 份（默认 20）；全库 200MiB 上限最旧先逐出。
  - 恢复：先强制快照当前内容再走常规保存路径 → **恢复操作本身可撤销**。
  - 预览：抽屉选中版本 → 原位只读预览（`Editor::set_preview`，持有原 Core 恢复光标/选区/undo）；预览期间 flush/schedule_save/sync_document 短路。
  - 变更高亮：block 级 LCS（changes.rs），新块浅绿底、改写块浅黄底；行级 LCS（diff.rs）给增删行数统计。
- 版本抽屉为 Google Docs/飞书模式：按天分组、可命名（40 字符 sidecar 文件）、可存副本。

## 5. 渲染与性能手段

- GPUI List 虚拟化：标题区 + 可见顶层块 + 引用区；text/heading/list 的子块独立成行（flatten），容器（quote/callout/列组/列）子块画在容器行内。
- 行 key = `hash_block`（哈希文本长度，非全文——全文哈希在百万字文档上 +3ms/键）；`sync_items` 对比新旧 key，只在未变前后缀区间 splice，仅变更行重新测高。
- 折衷：同长度变更（如段落 ⌘B）可能让屏外缓存行高短暂过期（注释里有测量依据）。
- 滚动条用 vendored `ListState::estimated_scroll_metrics` 从平均行高估算未测行。
- 图片缓存：全窗口共享，屏外解码图 >64MiB LRU 逐出、其他屏外条目 30s 过期、2s 扫描清 GPU atlas、并发解码 ≤2；首页预览缓存 128 份。

## 6. 库布局（FORMAT 4）

- 侧栏镜像文件系统：文件夹=真目录、文档=以标题命名的文件（`.xml`/`.md`）；重名加后缀 " 2"。
- `.assets/`（粘贴的图片附件 + thumbs 预览）；`.quiet/`（index.json、settings、preferences、shortcuts、emoji、themes/、trash/、history/）。
- index.json：key=相对路径（文件夹以 / 结尾），value=Attached{id,created,modified,pinned,starred,order,width,catalogue_closed,reading,info,refs_hidden}；新字段必须 `#[serde(default)]` 且默认值省略。
- 文档链接相对当前文件（`<cite type="doc" href="../Work/Weekly report.xml">`），读时解析为运行时 ID、写时转回路径 → 整库拷贝链接不断。
- 旧布局迁移 FORMAT 3→4：先整体移入 `.quiet/before-folders-4/`，失败即回滚，可 `restore_backup`。

## 7. 对 Clairis 的元级启示（跨域）

1. **最大结构性差异**：Quiet 的丝滑 = 单一块模型内存树 + 无损回写 + GPU 虚拟化渲染。Clairis（CM6 + Markdown 真相源）不可能也不必整体换成 Quiet 架构，但可以借：编辑引擎与 UI 分离 + 不变量 fuzzer 的思路、undo 快照策略、保存/可靠性协议、所有交互参数。
2. **借交互参数与边界行为**（可移植）：700ms 打字合并、500ms 保存防抖、视口保持分流、reveal_caret、恢复前强制快照、块级 LCS 变更高亮。
3. **借工程实践**：核心引擎独立 crate + 单测 + 随机 fuzzer + 存读回环逐字节测试（all-blocks.xml fixture）。这是"内容突然丢失/格式错乱"类 bug 的系统性防线——Clairis 目前靠手测，缺机检不变量。
