---
title: "渐晰空状态 — 今日继续"
type: design
status: accepted
last_updated: 2026-08-01
source_of_truth: supporting
---

# 渐晰空状态 — 今日继续

ponytail mode: full

---

## 核心

用户没文档打开时，EmptyState 中央渲染 `0-welcome.md`。用户看到的是产品力本身，不是教程。

0-welcome.md = README.md。首次启动直接展示渲染后的欢迎页，包含格式清单、快捷键、安全感说明、结尾 CTA。

第二次启动：欢迎页下方叠加"继续上次"（RecentFile[0] + scrollPos）+ "最近保存"（list_files mtime chips）。

两张信任阶梯：第一眼看"原来我的 Markdown 这么好看" → 第二眼"它记得我停在哪"。

---

## 布局

```
+---------------------------------------+
|                                       |
|  (0-welcome.md 渲染区域)               |
|                                       |
|  # 渐晰                               |
|  > 懂你、减负、惊喜、正向陪伴           |
|  ...                                  |
|  **打开一个文件，渐晰会记住你在哪。**    |
|                                       |
+---------------------------------------+
|  上次停在这                            |
|  《无侧栏方案》· 引用关系               |
|  [ 继续阅读 ]                          |
+---------------------------------------+
|  最近保存                              |
|  welcome.md · markdown.md · ...       |
+---------------------------------------+
|  [ 打开文件夹 ]  [ 新建文档 ]          |
+---------------------------------------+
```

首次启动只有 0-welcome.md。有 RecentFile 后叠加继续区 + 最近保存 chips。

---

## 最近保存 — 视觉层级

三层递减：

| 层级 | 内容 | 样式 |
|------|------|------|
| 1（最重） | 文件名 | `text-sm font-medium text-gray-900 truncate` |
| 2（中等） | 内容首行 | `text-xs text-gray-500 truncate` |
| 3（最轻） | 时间 | `text-xs text-gray-400` |

chip 容器：`flex-shrink-0 w-44 bg-gray-50 rounded-lg p-3 space-y-1`
外层：`flex overflow-x-auto gap-3 pb-2` — 横向滚动
+N 更多：最后一个 chip 变按钮，点击 Cmd+P

ponytail: 零新组件，零新 CSS。Tailwind 工具类拼。

---

## 数据

**继续上次**：RecentFile[0] + scrollPos + lastEditOffset → 最近 heading + 内容片段

**最近保存**：EmptyStateShell mount → invoke('list_files', {dir: Jianxi目录}) → filter .md/.html → mtime desc → 5 个

---

## 边角

| 情况 | 显示 |
|------|------|
| 首次安装（无 RecentFile、无示例文件） | 只显示 0-welcome.md |
| 有 RecentFile | 0-welcome.md + 继续上次 + 最近保存 |
| 无 RecentFile 但有文件夹文件 | 0-welcome.md + 最近保存 |
| list_files 失败 | section 隐藏，不报错 |
| scrollPos=0 | 退化成"继续打开" |

---

## 示例文件（B-4）

释放路径：`~/Documents/Jianxi/`。目录名大写 J，避免 macOS 中文目录问题。失败 fallback `app_data_dir()/samples`。

三个文件：

| 文件名 | 内容 | 状态 |
|--------|------|------|
| `0-welcome.md` | 欢迎页：定位 + 格式清单 + 快捷键 + 安全感 + CTA | 已完成 |
| `1-markdown-demo.md` | GFM 全套：标题/列表/任务/链接/引用/代码块/表格/脚注 | 已完成 |
| `2-html-demo.html` | HTML + 内联 CSS：基础结构 + 渐变卡片 + 表格 | 已完成 |

Marker 机制：`.sample-bundle.json` 记录每个文件 sha256，防重复释放、支持版本升级。

Rust 命令：`ensure_sample_files()`，编译时 `include_str!("../samples/0-welcome.md")` 嵌入。

---

## 改动

- RecentFile 加 `scrollPos?: number` + `lastEditOffset?: number`
- addRecentFile 带上新字段
- 节流写入（1-3s），关闭补 flush
- EmptyStateShell：渲染 0-welcome.md + 按数据分块叠加继续区
- `src-tauri/src/lib.rs`：注册 `ensure_sample_files` 命令
- `src-tauri/src/samples.rs`：include_str! 三个文件
- 示例文件释放一起上

ponytail: 最小改动，其他复用已有。
