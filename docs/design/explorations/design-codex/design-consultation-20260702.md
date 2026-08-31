---
title: "设计咨询备忘"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
superseded_by: ../README.md
redirect: docs/design/explorations/design-codex/README.md
---

# 设计咨询备忘

> 日期: 2026-07-02
> 触发: /design-consultation
> 关联: DESIGN-REVIEW.md, CORE-REQUIREMENTS.md

---

## 决策记录

### D1: 设计叙事方向

**决定: Notion + Linear 中间路线**

- **表面层**（chrome / 工具栏 / 侧栏）→ Linear 风格：低饱和度、高效率、不抢戏
- **内容层**（阅读区 / 编辑区）→ 偏 Notion 风格：柔和、纸张感、让用户注意力在内容上

**备选:** 纯 macOS 原生 app 风格（文字按钮为主）——与下面的 icon 决策不冲突，是互补的。

### D2: CSS Token 架构

**决定: 两层架构，不做语义中间层**

```
Layer 1 — 原子 Token（颜色/间距/圆角/阴影字面量）
  --color-neutral-0 ~ --color-neutral-900
  --color-indigo-400/500/600（品牌色）
  --space-1 ~ --space-8
  --radius-sm/md/lg
  --shadow-sm/md/lg

Layer 2 — 组件直接引用 Layer 1 变量
  /* toolbar.css */  → background: var(--color-neutral-50)
  /* tabbar.css */   → border-bottom: 2px solid var(--color-indigo-500)
```

**暗色模式:** 只需切换 Layer 1 的值，用 `:root` / `.dark` 区分。

**废弃:** 原 DESIGN-REVIEW.md 中的三层方案（Layer 2 语义映射如 `--toolbar-bg` 不再使用），理由：维护成本高，迭代时影响面不可控。

### D3: Icon 方案

**决定: 使用 Lucide React，配合 macOS 原生文字风格**

- **库:** `lucide-react`，tree-shaking，14 个 icon ~3KB total
- **风格参数:** `strokeWidth={1.5}`, `size={14}` 或 `size={16}`
- **配色:** `currentColor` 继承父元素文字色
- **与文字共存的规范:** icon 在文字左侧，间距 6px，icon 和文字垂直居中对齐
- **暗色模式自动适配:** 只需 `currentColor`

**必须的 14 个 icon:**

| 位置 | 语义 | Lucide 名称 | 尺寸 |
|------|------|-----------|------|
| 工具栏 | 打开文件 | `FolderOpen` | 16 |
| 工具栏 | 保存 | `Save` | 16 |
| 工具栏 | 新建 | `FilePlus` | 16 |
| 工具栏 | 左侧栏 | `PanelLeft` | 16 |
| 工具栏 | 右侧栏/翻译 | `Languages` | 16 |
| 工具栏 | 主题-亮 | `Sun` | 16 |
| 工具栏 | 主题-暗 | `Moon` | 16 |
| 工具栏 | 预览模式 | `Eye` | 16 |
| 工具栏 | 编辑模式 | `Edit3` | 16 |
| 工具栏 | 源码模式 | `Code2` | 16 |
| 工具栏 | 阅读模式 | `BookOpen` | 16 |
| Tab 栏 | 关闭 | `X` | 12 |
| 文件树 | 文件 | `FileText` | 14 |
| 文件树 | 文件夹展开 | `ChevronRight` | 14 |

### D4: 侧边栏目录移出

**决定: 将 Outline (目录) 从左侧 SidebarPanel 的 Tab 中移除，改为右侧浮动面板**

**理由:**
- 目录是"当前文档的结构地图"（单文档），文件树是"跨文档导航"（跨文档），不应该在同一组 Tab 中
- 当前需要点击左侧第三个 Tab 才能看到目录，违反了"高频=低成本"原则

**新方案:**
- 左侧边栏 Tab 从「文件 | 最近 | 目录」→ 改为「文件 | 最近」
- 在编辑/预览区的右侧新增浮动目录面板（详见下方 §F1）

### D5: 排版优先级调整

**决定: 先做字号阶梯，后做阅读氛围**

| 优先级 | 内容 | 
|--------|------|
| Phase 0 | 字号阶梯：H1-H6 的 font-size/font-weight/line-height/margin 比例关系 |
| Phase 0 | 字体系列：中文 `"PingFang SC"`，英文 `"Inter", system-ui` |
| Phase 0 | 段落间距：0.8em |
| Phase 1 | 窄栏宽 + 背景层效果（阅读区"浮"出来） |
| Phase 1 | 代码块/引用/表格细节美化 |
| P2+ | 微信读书级阅读氛围（背景色渐变等） |

**具体数值:**

```
正文: 16px / 1.7 / letter-spacing: 0.3px
H1: 28px / 1.3 / 700
H2: 22px / 1.35 / 600
H3: 18px / 1.4 / 600
H4: 16px / 1.5 / 600
段落间距: 0.8em
标题前距: 1.5em, 标题后距: 0.5em
```

### D6: 过渡动画

**决定: 最小可行动画方案，只做有感知价值的**

| 动画 | Phase | 说明 |
|------|-------|------|
| 主题切换 color/background 过渡 | Phase 0 | `transition: background-color 200ms, color 200ms` |
| 侧栏展开/折叠 width 过渡 | Phase 0 | 已有 |
| 阅读模式进入/退出 | Phase 1 | 工具栏淡出 + 内容区 expand |
| **不做:** Tab 切换淡入 | — | VS Code 也没有这动画，用户切换 tab 时 opacity 动画是干扰 |
| **不做:** 拖拽分隔条颜色过渡 | — | 4px 线做 150ms 动画不可见 |

**全局默认:**

```css
*, *::before, *::after {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 150ms;
  transition-timing-function: ease;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
```

### D7: 品牌色

**决定: indigo 色系，toned down 版本**

- Primitive: `#4f5bd5`（介于 indigo 和 macOS gray-blue 之间）
- Light mode accent: `#6366f1` (indigo-500)
- Dark mode accent: `#818cf8` (indigo-400)
- 仅用于 accent（活跃态指示器、链接、focus ring）
- Chrome 底色用 neutral 色系

---

## 特性规格

### F1: 浮动目录面板 (Floating Outline)

**视觉效果:**

```
┌──────────────────────────────────────────────┐
│                                              │
│   正文内容...                                  │  ┌─────────────────┐
│                                              │  │ ## 概述         │
│   ## 概述                                    │  │   ## 架构总览   │
│   ## 架构总览                                │  │   ## 数据模型   │
│   正文正文正文...                              │  │ ## 设计系统     │  ← 当前高亮
│                                              │  │   ## Token      │
│   ## 数据模型                                │  │   ## 排版       │
│   正文正文正文...                              │  │ ## 实施路线图    │
│                                              │  └─────────────────┘
│   ## 设计系统     ← 视口在此                   │
│   正文正文正文...                              │
│   ...                                        │
│                                              │
└──────────────────────────────────────────────┘
```

**规格:**
- 宽度: 160-180px
- 位置: `position: sticky; top: 32px; right: 0; float: right;`（吸附在预览区右上角）
- 背景: `rgba(255,255,255,0.85)` + `backdrop-filter: blur(8px)`（苹果原生浮层感）
- 暗色: `rgba(15,23,42,0.85)` + 相同模糊
- 边框: 1px solid，色板 token
- 圆角: `--radius-lg`（8px）
- 字号: 12px
- 标题缩进: H2 → 0px, H3 → 14px, H4 → 28px, H5 → 42px, H6 → 56px
- 当前标题高亮: 左侧 2px 竖线 indigo + 背景微变色（不破坏克制感）
- hover 时背景变为 95% opacity

**行为逻辑:**
- 文档有标题 → 显示
- 无标题 → 完全不渲染（不是空壳）
- 只渲染在活跃的主面板（分栏时不渲染在 split 面板）
- 阅读模式 → 隐藏（全屏沉浸不需要导航）
- 点击标题 → `scrollIntoView` + 目录对应项高亮
- IntersectionObserver → 滚动时自动跟踪当前标题位置，目录自动切换高亮

**交互细节:**
- 整个面板不做任何 hover 显示/隐藏的交互（始终可见）
- 标题过长时省略号截断
- 当前标题始终在面板可见区域内（如列表过长，自动 scroll 到当前项）

### F2: 侧边栏改进

**决定: 侧边栏「文件」Tab 使用 Unicode 字符替代 emoji**

不再使用 📁📄 emoji。使用:
- 文件夹前缀: `▸`（折叠）/ `▾`（展开）
- 文件前缀: 无特殊前缀，用缩进 + `FileText` lucide icon
- 字体粗细区分: 文件夹用 `font-medium`，文件用 `font-normal`

### F3: 工具栏文字+Icon混合风格

**决定: icon 在左，文字在右，保持 macOS 原生 app 风格**

当前中文文字按钮可保留，在 icon 替换时新增 Lucide icon 在文字左侧。

每个按钮: `[icon 14px] [文字 12px]`，间距 4px。

按钮组之间用分隔线（`w-px h-5 bg-neutral-200 mx-1.5`）。

---

## 实施路线图

```
Phase 0.8  — CSS Token 系统建立（Layer 1 原子 Token）
Phase 0.85 — 浮动目录面板（F1）
Phase 0.9  — Lucide icon 替换 emoji 和纯文字（F2, F3）
Phase 0.95 — 组件 Token 套用（Toolbar → TabBar → Sidebar 视觉改造）
Phase 1.0  — 排版精调 + 动画 + 空状态补齐
```

每个 Phase 完成后独立验证，不阻塞后续 Phase。

---

## 实现注意事项

1. **浮动目录的 IntersectionObserver**: 需要在 PreviewView 渲染后注册观察所有标题元素的 observer。如果标题在 Markdown 渲染后变化（用户编辑后切回预览），需重新注册。
2. **Lucide icon 组件的统一样式**: 建议在 `src/components/Icon.tsx` 或类似位置封装一个 `FolioIcon` 组件，统一 `strokeWidth={1.5}` 和 `size`。
3. **CSS Token 迁移**: 现有 `theme-light.css` 和 `theme-dark.css` 合并为一个 `tokens.css`，用 `:root` 和 `.dark` 区分。这是破坏性修改，需确保所有组件同时迁移。
4. **品牌色选择留有调整空间**: `#4f5bd5` 是起点，实际效果需在亮/暗模式下验证后微调。
