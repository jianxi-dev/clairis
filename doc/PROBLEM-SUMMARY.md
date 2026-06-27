# MDWRT — 问题总结与方案讨论

> 更新时间: 2026-06-27

---

## 一、当前架构

```
文件 → store (markdown)
    ↓ marked.parse (GFM)
    → HTML → TipTap (ProseMirror)
    → onUpdate → turndown.turndown(HTML)
    → markdown → store
```

核心矛盾: store 存 markdown, 但 TipTap 原生操作 PM doc/HTML, 每次渲染/保存都要做格式转换.

---

## 二、已确认问题

### 1. TipTap × GFM 兼容性 (根源问题)

| 格式 | 状态 | 原因 |
|------|------|------|
| 标题 / 段落 / 粗斜体 / 链接 | ✅ | 基础 PM schema 覆盖 |
| `code` 行内代码 | ✅ | 去掉 prose 后 CSS 可控 |
| 代码块 fenced | ✅ | pre + code CSS |
| 表格 | ⚠️ 表格宽度调整不能交互 | 关掉了 resizable, 否则残留 `<col style=...>` |
| 无序/有序列表 | ✅ 修复 | 自定义 list CSS |
| 任务列表 - [ ] | ❌ 只显示一个 checkbox | marked → TipTap HTML 格式不匹配 |
| 引用 blockquote | ✅ | 基础 CSS |
| 分割线 hr | ✅ | CSS |
| 图片/链接 | ✅ | 基础 PM schema |

### 2. 数据流损耗

```
原始 markdown: `- [x] done\n- [ ] todo`
    ↓ marked.parse
HTML: <ul><li><input type="checkbox" checked="" disabled=""> done</li>...
    ↓ adaptTaskListHtml (加 data-type, 包 label)
HTML: <ul data-type="taskList"><li data-type="task-item"><label>...
    ↓ TipTap.useEditor 解析
    ↓ onUpdate → turndown.turndown(html)
    ↓
输出 markdown 与原始不一定一致 (标记符号/缩进/格式差异)
```

每一轮 WYSIWYG 编辑 → 保存都要经过 markdown→HTML→markdown, 格式符号会逐渐漂移.

### 3. 视觉/CSS 不稳定

| 问题 | 根因 |
|------|------|
| inline code 样式被覆盖 | Tailwind `@tailwindcss/typography` prose 类优先级高 |
| 列表标记消失 | prose 类移除后无后备 CSS |
| 代码块暗底白字 | prose 默认暗色主题 |
| 任务 checkbox 不显示 | prose 去除了 input 样式 |
| 标题/正文字体差于上个版本 | prose 类带了排印优化 (字号/行距/颜色) |

去掉 prose 类后, 需要手动复刻所有 typography 样式, 工作量不小.

### 4. 测试覆盖

| 类型 | 状态 | 用例数 |
|------|------|--------|
| 纯函数/数据流 | ✅ | 50 (types/store/markdown roundtrip/HTML adapt) |
| React 组件渲染 | ❌ | 0 |
| CSS/视觉对比 | ❌ | 0 |
| E2E 流程 (Tauri) | ❌ | 0 |

---

## 三、待讨论的方案

### 方案 A: 维持现有架构, 完善细节

继续用 `marked` + `turndown` 做双向转换, 每个格式逐一覆盖:
- 人工实现完整 typography CSS (替代 prose)
- 继续打补丁解决 task list / 表格 / 格式符号漂移
- 补 Playwright E2E

**优点:** 改动小
**缺点:** 每个 markdown 格式都要手动适配, GFM 有几十种语法, 长期维护成本高

### 方案 B: 前端转 HTML 做唯一数据源

store 不再存 markdown, 而是存 TipTap 输出的 HTML (或 PM JSON).
- 打开文件: markdown → HTML (marked) → store, 不再转回去
- 编辑: TipTap → HTML → store
- 保存时: store 的 HTML → markdown (turndown), 写文件
- 源码模式: 显示 store 的 HTML (或转回 markdown 预览)

**优点:** 减少 onUpdate 的转换次数; 编辑期间 TipTap 内容不经过转换, 格式无损
**缺点:** 源码模式不能直接编辑 markdown; 保存时仍有一次转换; 文件存的是 markdown, 但编辑时存 HTML, 两棵数据树

### 方案 C: 双引擎 —— 轻量 WYSIWYG (ProseMirror) + 原生 markdown 编辑

参考 Obsidian/MWeb 模式:
- 放弃 TipTap 完整 WYSIWYG, 采用 **半 WYSIWYG** (渲染时实时预览, 编辑时直接写 markdown)
- 或: 左边源码, 右边实时预览 (split view)

**优点:** 不需要格式转换, 存储=编辑=显示全是 markdown
**缺点:** 不是真 WYSIWYG (点哪改哪), 用户习惯不同

### 方案 D: 换用原生 markdown 编辑器内核

考虑使用:
- **CodeMirror + 实时预览插件** (如 CodeMirror 6 的 GFM preview extension)
- **Typora 风格** (edit in place, markdown 语法实时替换为渲染效果)

**优点:** 天然支持 GFM, 不需要格式转换
**缺点:** 需要重度定制, 比 TipTap 集成更复杂

### 方案 E: 补 prose 类 + 白名单小修

回到使用 `prose prose-sm` 类, 只针对已知的冲突补 CSS override:
- code: `@apply prose-code:bg-gray-100`
- pre: `@apply prose-pre:bg-gray-50`
- task checkbox: 单独 fix
- table resizable: 关闭 (已做)

**优点:** prose 的排印质量可以直接用, 不用手写全部 typography
**缺点:** prose 的幽灵样式可能继续在其他地方冒出来

---

## 四、建议决策树

1. **确定目标用户:** 纯粹 markdown 写作者? 还是习惯 Word 式 WYSIWYG 的用户?
2. **确定 markdown 完整度:** 需要完整 GFM? 还是基础语法就够?
3. **确定编辑模式:** 纯 WYSIWYG / 纯源码 / 分屏 / 实时预览?
4. **确定测试要求:** 需要到什么级别的测试保障?

你的意向和优先级是什么? 我可以把选定方案细化成实施步骤.
