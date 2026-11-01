---
title: "A-6 字号缩放设计规格 v3"
type: design
status: accepted
last_updated: 2026-08-01
source_of_truth: supporting
---

# A-6 字号缩放设计规格 v3

> 来源：July 12, 2026 印哥 + Hermes 设计讨论 → Codex 两轮对抗后定稿
> 变更 v2→v3：砍掉 per-doc 字号记忆、砍掉字号数字 toast。全局字号 + CSS calc 层级缩放 + iframe rem 注入。
> 阶段：Phase R

---

## 1. 核心哲学

同一时间，全标月只有一个字号。

不存在"这篇读诗要大字、那篇写代码要小字"——那是工具软件的思路。标月的字号是"我现在的阅读状态"，不是文档的属性。

调字号本质是调"视觉舒适度"，不是调数字。用户不看 px 值，看的是文字本身大了还是小了。

---

## 2. 字号模型

```
全局 baseFontSize = 17   // 存于现有 config.json
```

**全部存储**：现有 `~/.config/biaoyue/config.json` 的 `fontSize: number = 17`。零新文件，零新字段。

**范围**：12px ≤ fontSize ≤ 32px，步进 1px。

**持久化时机**：Ctrl+=/- 后 500ms debounce 写盘，复用现有 config save 路径。

---

## 3. 层级缩放

字号不是一个数字——是一组保持比例的数字。

所有元素字号 = baseFontSize × 倍率（CSS calc 实现）：

| 元素 | 倍率 | base=17 时实际 |
|------|------|---------------|
| body / p / li / blockquote / 任务列表 | 1.00x | 17px |
| H6 | 1.10x | 18.7px |
| H5 | 1.15x | 19.6px |
| 行内代码 / 代码块 | 0.90x | 15.3px |
| H4 | 1.25x | 21.3px |
| H3 | 1.40x | 23.8px |
| H2 | 1.60x | 27.2px |
| H1 | 1.85x | 31.5px |

### 3.1 为什么用倍率而不是写死 px

过去字号调整的实现是直接给所有元素写死新 px。导致两个问题：
- H1 从 30px 调到 32px（+2），正文从 16px 调到 18px（+2），标题原本比正文大 1.875 倍，调完后只大 1.778 倍——视觉层级在缩小
- 极端情况下，H1 几乎和正文一样大

**用倍率**：H1 永远是正文的 1.85 倍，无论 base 怎么变。调大 base → 标题正文一起大，层级感始终在。

### 3.2 实现

```css
/* 编辑态（CM6 渲染层） */
.cm-editor {
  --base-font-size: var(--editor-font-size, 17px);
  font-size: var(--base-font-size);
}
.cm-editor .cm-header-1 { font-size: calc(var(--base-font-size) * 1.85); }
.cm-editor .cm-header-2 { font-size: calc(var(--base-font-size) * 1.6); }
.cm-editor .cm-header-3 { font-size: calc(var(--base-font-size) * 1.4); }
.cm-editor .cm-header-4 { font-size: calc(var(--base-font-size) * 1.25); }
.cm-editor .cm-header-5 { font-size: calc(var(--base-font-size) * 1.15); }
.cm-editor .cm-header-6 { font-size: calc(var(--base-font-size) * 1.1); }
.cm-editor .cm-comment,
.cm-editor .cm-inline-code { font-size: calc(var(--base-font-size) * 0.9); }

/* 预览态（marked 渲染层） */
.markdown-preview {
  --base-font-size: var(--editor-font-size, 17px);
  font-size: var(--base-font-size);
}
.markdown-preview h1 { font-size: calc(var(--base-font-size) * 1.85); }
.markdown-preview h2 { font-size: calc(var(--base-font-size) * 1.6); }
.markdown-preview h3 { font-size: calc(var(--base-font-size) * 1.4); }
.markdown-preview h4 { font-size: calc(var(--base-font-size) * 1.25); }
.markdown-preview h5 { font-size: calc(var(--base-font-size) * 1.15); }
.markdown-preview h6 { font-size: calc(var(--base-font-size) * 1.1); }
.markdown-preview code { font-size: calc(var(--base-font-size) * 0.9); }
```

**触发调整**：CSS 自定义属性继承。只需修改一次 `--editor-font-size` 变量，所有元素自动跟随——不需要 JS 遍历 DOM。

```typescript
document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
```

---

## 4. HTML 内容字号

HTML 文件（M 阶段 iframe 沙箱渲染）字号跟随策略：

### 4.1 原理（大白话解释）

HTML 字号单位有三类：

| 单位 | 含义 | 例 | 是否跟着全局变 |
|------|------|----|------------|
| px（像素） | 固定的、不放缩的值 | `style="font-size: 20px"` | ❌ 不变（尊重原作者的明确意图） |
| rem | 相对于"根 html 元素的字号" | `font-size: 1rem` | ✅ 变（你调根字号，我就跟着变） |
| em | 相对于"父元素的字号" | `font-size: 1.5em` | ✅ 随父连动，最终追溯到 rem |
| % | 相对于父元素的百分比 | `font-size: 150%` | ✅ 随父连动 |

html 内容改了本地全局字号 —→ 往 iframe 里注入一条"把 html 元素的字号设为全局当前值"的样式 —→ 所有用 rem/%/em 的元素自动按新字号重新渲染。用 px 的不动。

### 4.2 实现

```typescript
function injectFontSizeToIframe(iframe: HTMLIFrameElement, baseFontSize: number) {
  // 尝试进入 iframe 内部 —— 如果同源（blob: 协议/tauri 自定义协议通常同源）
  try {
    const doc = iframe.contentDocument;
    if (!doc) return;
    
    // 如果内部已经有 html { font-size: ... }，删掉旧的，避免重复注入
    const existing = doc.querySelector('style[data-biaoyue="font-inject"]');
    if (existing) existing.remove();
    
    const style = doc.createElement('style');
    style.setAttribute('data-biaoyue', 'font-inject');
    style.textContent = `html { font-size: ${baseFontSize}px; }`;
    doc.head.appendChild(style);
  } catch (e) {
    // 跨域（无法从父页面读取 iframe 内部 DOM）→ 静默放弃
    // HTML 内容字号不受全局调整影响，回到 px 写死时的样子
    console.warn('[Biaoyue] Cannot inject font size into cross-origin iframe', e);
  }
}
```

**不需要暴力覆盖**：只设根字号，让 rem/%/em 自然跟随。px 单位不动——不是 tool，是"不去强奸作者意图"。

### 4.3 M 阶段特殊处理

M 阶段 iframe 用 `sandbox="allow-same-origin"` + base64 内联内容。此时 iframe 内容同源，inject 可直达。

R 阶段若有外部 CDN/Tauri 自定义协议，如果仍同源则继续使用上述注入；若跨域则退化（iframe 内部 px 字号不变）。

### 4.4 R 阶段 HTML 源码编辑时的字号行为

源码编辑（CM6 html 模式）是普通文本。字号调整走编辑态的 `.cm-editor` 层级缩放——代码块字号 = base × 0.9。HTML 源码的字号和正文一样跟随全局。

---

## 5. 字号调整 UI

### 5.1 快捷键

| 快捷键 | 操作 |
|--------|------|
| `Cmd+=` / `Ctrl+=` | 字号 +1px（上限 32） |
| `Cmd+-` / `Ctrl+-` | 字号 -1px（下限 12） |

任何模式（阅读、编辑、预览）下改的都是同一个全局值。无"阅读字号/编辑字号"的区分。

### 5.2 UI 反馈：删

v2 原本有"按 Ctrl+= 后浮现 "20px" 数字提示 0.8s"——已删。

**理由**：字号调节是感知操作而非数值操作。文字本身变大就是 100% 充分的反馈。浮现数字反而遮挡正文、违反沉浸、是开发者语言（用户不关心 px，只关心"大到我看清楚了吗"）。

### 5.3 字号边界反馈

- 字号到 12 再按 -：字号不变（已达下限）
- 字号到 32 再按 =：字号不变（已达上限）
- **边界不需要额外 UI 提示**——按键无响应本身就是反馈。不需要弹"已经最小了"之类的信息。

---

## 6. 分栏场景

字号全局统一。左右双栏、上下双栏共享同一个字号。分栏不是独立阅读环境——是文档对照。字号分两套会让用户困惑"为什么两篇看起来不是一个标准"。

---

## 7. Store 变更

### 极简图

```
现有：
  editorStore.fontSize = 16
  config.json { fontSize: 17 }   // 持久化

已有：
  editorStore.setFontSize(n)
  useConfig().scheduleSave()     // debounce 写盘

需要新增的：无。全复用。
```

### 实际代码路径

```
Ctrl+=/- (App.tsx handler)
  → editorStore.setFontSize(next)
  → document.documentElement style setProperty --editor-font-size
  → scheduleConfigSave()  (useConfig 已有的 debounce 写盘)
  → 同步调用 injectFontSizeToIframe(currentIframe, next)
```

以上全部复用现有代码路径。**零新字段、零新文件、零新的持久化逻辑。**

---

## 8. 沉浸态字号（与 A-5 v3 联动）

沉浸态 = 改变 chrome 可见性，不创建独立字号状态。

```
沉浸态 Ctrl+= → 改全局 fontSize（同 A-6 主逻辑）
退出沉浸态后 → 字号不变（因为是全局的）
```

无需 `immersionState.fontSizeOverride`，无需 `perDocFontSize`。A-5 spec §6 同步更新。

---

## 9. 不做的事

1. **不做每文档字号记忆**——字号是全局状态
2. **不做字号滑杆 UI**——Ctrl+=/- 是唯一入口
3. **不做字号数字浮现**（toast）——已删
4. **不做"跟随字号系统设置"**——iOS/macOS 系统字号是另一回事，标月内部自己管
5. **不做"字号历史" / Cmd+Z 撤销字号**——字号调节不是编辑操作，不该出现在撤销栈里
6. **不做"字号导出"**——字号是阅读偏好，不该写入文档 frontmatter
7. **不做"字号按设备同步"**——P2 如果有云端同步再说

---

## 10. 验收标准

| # | 场景 | 预期 |
|---|------|------|
| 6.1 | 编辑态 Ctrl+= | 字号 +1，标题/code 按比例缩放（H1永远是正文的1.85倍 |
| 6.2 | 预览态 Ctrl+= | 同上 |
| 6.3 | HTML 内容（rem 单位 | HTML 字号跟随全局调整 |
| 6.4 | HTML 内容（px 写死 | HTML 字号不变。这是作者的明确意图 |
| 6.5 | 跨域 iframe（未来 | HTML 字号不变（默认行为。无 bug |
| 6.6 | 字号到 32 | 再按 = 不变，不出任何提示 |
| 6.7 | 字号到 12 | 再按 - 不变 |
| 6.8 | 沉浸态 | Ctrl+= 字号跟随全局 |
| 6.9 | 重启应用字号 = 上次关闭时的字号 |
| 6.10 | 分栏 | 字号统一 |
