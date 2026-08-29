---
title: "Folio 设计审查报告"
type: design
status: archived
last_updated: 2026-08-01
source_of_truth: historical
superseded_by:
  - ../../../design/approved/
  - ../../../design/explorations/
---

# Folio 设计审查报告

> 日期: 2026-07-02
> 基于 CORE-REQUIREMENTS.md v3 和 Phase 0.9 主题系统目标
> 当前状态: Phase 0 功能核心完成，UI 设计未启动

---

## 一、现状评估

当前界面是"Tailwind 默认"风格——纯功能堆砌，没有统一设计语言。对照四条评审红线：

| 原则 | 评分 | 主要问题 |
|------|------|----------|
| **快** ⚡ | 6/10 | 功能层面 OK，但空状态/加载态/Tab 切换无过渡，体验"脆" |
| **方便** 🖐️ | 5/10 | 快捷键覆盖好，但工具栏按钮/侧栏 Tab 样式粗糙，点击区域不合理 |
| **舒服** 😌 | 3/10 | **最大问题** — 没有设计系统，配色平、间距乱、无层次、无质感 |
| **喜欢** ❤️ | 1/10 | 没有任何超出预期的细节，打开后是"A 货 Typora"即视感 |

**核心诊断：缺少一个完整的设计系统，从 CSS 变量到组件级视觉语言全部缺失。**

---

## 二、设计差距分析

### 2.1 排版与阅读体验（§3.1）

| 需求 | 现状 | 差距 |
|------|------|------|
| Medium/微信读书级别排印 | 16px/1.8 行距，无窄栏宽，无优雅字距/段距 | 整个排版系统需要重新设计 |
| 字号缩放 | Cmd+/Cmd-= 已实现，但无过渡动画 | 功能 OK，体验欠缺 |
| 阅读模式 | 隐藏工具栏，但全屏区域无任何引导/进度/动画 | 过于朴素 |

### 2.2 主题系统（Phase 0.9 未启动）

| 需求 | 现状 | 差距 |
|------|------|------|
| CSS 变量骨架 | 有零散 `--reader-*` 变量，无组件级完整 token 系统 | **缺失** |
| 字体/颜色/间距/圆角/阴影规范 | 无规范，各处硬编码 Tailwind classes | **缺失** |
| Dark/Light 切换 | 逻辑存在，但样式是黑/白两套独立 CSS，非同一变量系统派生 | 架构不合理 |
| 3-5 套主题 | 不存在 | **缺失** |
| 过渡动画 | 主题/阅读模式切换无过渡 | **缺失** |

### 2.3 组件级视觉效果

| 组件 | 现状 | 问题 |
|------|------|------|
| **Toolbar** | 灰底+灰色按钮，hover 为纯色背景 | 无图标、无分组分隔、高度 32px 过挤 |
| **TabBar** | 纯文字标签+灰色边框，活跃态为蓝色下划线 | 关闭按钮 hover 区域太小 |
| **SidebarPanel** | Tab 切换用蓝色下划线，内容区域无内边距规范 | 切换生硬，无过渡 |
| **FileTree** | 文字列表+emoji 图标（📁📄），行高 28px | emoji 作为图标不专业 |
| **RecentFiles** | 同 FileTree，emoji 图标 | 同上 |
| **Outline** | H1-H6 左侧间距用 paddingLeft 硬编码 | 无缩进线/背景色 |
| **PreviewView** | 白底+16px 内边距+680px 最大宽度 | 无背景装饰、无阴影层、无呼吸感 |
| **ContentArea** | 模式切换按钮小、位置不统一 | 预览/编辑/源码按钮位置不一致 |
| **SplitResizeHandle** | 4px 线，hover 变蓝色 | 功能完整但缺乏精致感 |

### 2.4 缺失的 UI 细节

- **空状态**：无文件时只显示引导文字，无插画/icon/手势提示
- **过渡动画**：tab 切换、sidebar 折叠展开、阅读模式进入/退出——**全部无动画**
- **loading 状态**：文件打开只有纯文字"加载中..."
- **阴影/层级**：任何地方都没有 `box-shadow`，界面"平躺"在屏幕上
- **圆角系统**：只有 Toolbar 按钮有 `rounded`，其余全部直角
- **iconography**：没有 SVG 图标系统，用文字和 emoji 代替
- **touch target**：file list 行高只有 24-28px，间距过小

---

## 三、设计系统方案

### 3.1 CSS Token 系统（三层架构）

#### Layer 1 — 全局色板

```css
:root {
  /* Brand */
  --fol-brand: #6366f1;
  --fol-brand-light: #818cf8;
  --fol-brand-dark: #4f46e5;

  /* Neutral */
  --fol-bg: #ffffff;
  --fol-bg-subtle: #f9fafb;
  --fol-bg-muted: #f3f4f6;
  --fol-surface: #ffffff;
  --fol-border: #e5e7eb;
  --fol-border-subtle: #f3f4f6;

  /* Text */
  --fol-text: #111827;
  --fol-text-secondary: #6b7280;
  --fol-text-tertiary: #9ca3af;
  --fol-text-inverse: #ffffff;
}
```

#### Layer 2 — 语义映射

```css
:root {
  /* Toolbar */
  --toolbar-bg: var(--fol-bg-subtle);
  --toolbar-border: var(--fol-border);
  --toolbar-height: 36px;

  /* Tab bar */
  --tab-bg: var(--fol-bg-subtle);
  --tab-active-bg: var(--fol-bg);
  --tab-active-border: var(--fol-brand);
  --tab-height: 32px;

  /* Sidebar */
  --sidebar-bg: var(--fol-bg-subtle);
  --sidebar-width: 280px;
  --sidebar-item-height: 28px;
  --sidebar-item-hover: var(--fol-bg-muted);

  /* Reader */
  --reader-max-width: 680px;
  --reader-padding: 32px;
  --reader-bg: var(--fol-bg);
  --reader-text: var(--fol-text);
  --reader-line-height: 1.75;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* Animation */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-normal: 250ms;
}
```

#### Layer 3 — 暗色模式

```css
.dark {
  --fol-bg: #0f172a;
  --fol-bg-subtle: #1e293b;
  --fol-bg-muted: #334155;
  --fol-surface: #1e293b;
  --fol-border: #334155;
  --fol-text: #f1f5f9;
  --fol-text-secondary: #94a3b8;
  --fol-text-tertiary: #64748b;
  /* ...所有其他变量自动派生... */
}
```

### 3.2 参考设计目标

| 参考目标 | 借鉴内容 | 优先级 |
|----------|----------|--------|
| **Linear App** | 极简按钮风格、干净的分组、过渡动画 | ⭐⭐⭐ |
| **Medium** | 阅读排版、窄栏宽、字体层级 | ⭐⭐⭐ |
| **微信读书** | 阅读氛围（背景色/阴影/留白）、进度条 | ⭐⭐ |
| **VS Code** | 侧边栏文件树的层级和交互 | ⭐⭐ |
| **Notion** | 编辑态的行内样式指示器、hover 响应 | ⭐⭐ |

### 3.3 组件设计要点

#### Toolbar
- 图标按钮替代文字按钮（SVG：文件夹/保存/+/左右面板/主题/阅读）
- 分组用分隔线，视觉层次清晰
- 右侧放模式切换（预览/编辑/源码）+ 阅读按钮
- hover/active 状态使用品牌色 (indigo)

#### TabBar
- 每个 tab 带分隔线，活跃 tab 有品牌色底部标识 + 稍深背景
- 关闭按钮 hover 区域扩大（padding 6px 以上）
- dirty 指示器使用品牌色小圆点
- 右击菜单加圆角和阴影

#### SidebarPanels
- 文件列表项：缩进清晰、文件类型 SVG icon、hover 行背景变色
- 目录大纲：缩进线+字体粗细区分层级
- Tab 切换有过渡动画

#### PreviewView（阅读区）
- 文档区域居中，最大宽度 680px
- 添加柔和背景层，让阅读区域"浮"出来
- 正文使用 `system-ui, -apple-system, "PingFang SC"` 字体系列
- 标题层级使用清晰的 font-weight + font-size 阶梯
- 代码块加背景色块+圆角+阴影
- 引用块左侧粗线+浅底色块
- 图片居中+圆角+浅阴影

#### ContentArea（编辑区）
- 编辑区行高 1.7，字距 0.3px
- 光标颜色和 selection 使用品牌色
- 编辑器容器加圆角边框

### 3.4 过渡动画表

| 场景 | 动画 | 时长 | 缓动 |
|------|------|------|------|
| 侧栏折叠/展开 | width transition | 200ms | ease-out |
| Tab 切换 | 淡入（opacity 0→1） | 150ms | ease |
| 阅读模式进入/退出 | 工具栏淡出 + 内容区 expand | 300ms | ease-out |
| 主题切换 | color/background 渐变 | 200ms | ease |
| 拖拽分隔条 | handle 颜色过渡 | 150ms | ease |
| 按钮 hover | 背景色 + 阴影 | 100ms | ease |

---

## 四、实施路线图

### 步骤 1：建立 CSS Token 系统（1-2 天）

合并 `theme-light.css`、`theme-dark.css`、`editor.css` 中的零散变量，统一为三层 token 系统。

### 步骤 2：Token → 组件套用（2-3 天）

按优先级逐层套用：
```
Toolbar → TabBar → Sidebar → ContentArea/PreviewView → CM6 Editor → SplitResizeHandle
```

### 步骤 3：SVG Icon 系统（1 天）

建立 10-15 个核心 SVG icon（打开/保存/新建/侧栏左/侧栏右/预览/编辑/源码/阅读/主题/分栏/关闭）。
风格：outline 风格，1.5px stroke，24x24 viewBox，使用 currentColor。

### 步骤 4：补齐缺失交互细节（2 天）

- 空状态插画/引导
- loading skeleton
- 过渡动画
- 阴影系统
- 圆角规范统一

### 步骤 5：Preview 阅读区排版精调（1-2 天）

- Medium 级别的排版
- 窄栏宽、段落间距、字号阶梯
- 代码/引用/表格样式细化

---

## 五、质量门禁

**当前预估打分：3.5/10**

主要失分项：
| 项 | 扣分 |
|---|------|
| 无设计系统 | -3 |
| 无 SVG 图标 | -1 |
| 无过渡动画 | -1 |
| Preview 阅读区排版生硬 | -0.5 |
| 空状态/loading 无设计 | -0.5 |
| 侧边栏 emoji 图标 | -0.5 |

**进入 Phase 1 目标 ≥ 7/10**

---

## 六、交付顺序建议

```
Day 1-2   建立 CSS Token 系统（Layer 1-3）
Day 3-5   Toolbar → TabBar → Sidebar → PreviewView 套用 Token
Day 6     建立 SVG Icon 系统 + 替换 emoji/文字按钮
Day 7-8   补齐过渡动画 + 阴影 + 圆角
Day 9-10  Preview 阅读区排版精调（Medium 级）
Day 11    空状态/loading 设计 + 质量验证
         ↓
Phase 1.0 设置面板 + 后续功能开发
```
