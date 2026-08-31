---
title: "渐明 HTML 支持探讨"
type: research
status: archived
last_updated: 2026-08-01
source_of_truth: historical
superseded_by: ../../../design/explorations/
---

# 渐明 HTML 支持探讨

> **创建日期:** 2026-07-05  
> **基准文件:** `/Users/mason/Desktop/AI工具分享/安全管理智能顾问/readme-安全管理领域智能顾问Skill.html`  
> **状态:** 分析完成，结论明确  
> **下次回顾:** MVP 上架后，或用户遇到更多 HTML 阅读/编辑场景

---

## 一、基准文件分析

### 1.1 文件结构概览

| 指标 | 数值 |
|------|------|
| 文件大小 | 45,870 bytes (~45KB) |
| 总行数 | 476 行 |
| 头部依赖 | 2 个外部资源（Tailwind CDN + Google Fonts） |
| 自定义 CSS | ~50 条规则（`.glass`, `.text-gradient`, `.noise-bg`, 动画等） |
| 内嵌 SVG | 多个（装饰形状） |
| HTML 内容 | 7 个 Section + 附录 + 页脚，全中文 |

### 1.2 核心样式机制

Tailwind 的 CDN 脚本会实时扫描页面中所有 `class` 并动态生成对应 CSS。文件使用的关键 Tailwind class 包括：

- 布局：`max-w-[1080px]`, `mx-auto`, `px-16`, `py-16`, `min-h-screen`
- 排版：`text-7xl`, `font-black`, `leading-tight`, `mb-6`, `text-slate-*`
- 配色：`bg-indigo-50`, `border-indigo-200`, `rounded-*`, `bg-emerald-50`
- 效果：`backdrop-filter`, `border`, `overflow-hidden`, `z-10`
- 响应式：未使用
- 伪类：`:hover` (`.card-hover:hover`)

---

## 二、预编译 CSS 沙箱方案（WASM 路线）

### 2.1 方案描述

不依赖 Tailwind CDN，而是在 HTML 进入阅读前：  
1. 读取 HTML 文件内容  
2. 解析出所有 class 的使用模式  
3. 用 Tailwind WASM 编译器生成纯 CSS  
4. 删除 HTML 中的 `<script>` 标签（CDN 引用）  
5. 将生成的 CSS 作为 `<style>` 注入到 `<head>`  
6. 渲染到 iframe 沙箱

### 2.2 技术栈

| 层 | 方案 |
|----|------|
| Tailwind | 官方 WASM 编译器tailwindcss-wasm|
| AST 解析 | parse5 或 htmlparser2 解析 HTML 结构 |
| CSS 生成 | 走 tailwind 编译管线，输出标准 CSS |
| 注入时机 | HTML 打开时同步一次 |

### 2.3 优缺点

| 维度 | 评价 |
|------|------|
| 🛡️ 安全性 | 🔒 纯离线沙箱，不依赖外部服务 |
| 📶 可靠性 | ✅ 始终可用 |
| ⚡ 性能 | ⚠️ 首次解析需要 500ms~2s（50KB 文件） |
| 🧩 兼容 | ⚠️ tailwind.wasm 覆盖 Tailwind v3，v4 可能有限制 |
| 🔧 成本 | 🟡 1-2 周开发量 |
| 📦 体积 | 📦 .wasm 文件 ~1-2MB (打包进 app DMG) |

### 2.4 关联 Feature

### 2.4 关联技术点

| 问题 | 方案 |
|------|------|
| Google Fonts 离线 | 1. CDN 加载一次缓存到本地<br>2. app 内置 fallback（系统字体）|
| `@import` / `@font-face` URL | asset:// 协议前缀 |
| 自定义 `<style>` 块 | 原样保留（已经在 <style> 内嵌） |

---

## 三、属性级可视化编辑（右侧面板）

### 3.1 描述

在预览模式下，用户点击 iframe 中的某个元素 → 右侧栏展开 → 显示该元素的：
- Tag（`<div>`, `<section>`, `<h1>` 等）
- class 列表（可点击编辑 class）
- 内联 style（可修改属性值）
- DOM 面包屑（当前位置）

### 3.2 技术可行性

| 层 | 方案 |
|----|------|
| 事件监听 | iframe 内注入点击代理脚本，捕获 click → 序列化元素信息 → postMessage 传给父页面 |
| 父页面接收 | 右侧面板根据元素信息渲染编辑表单 |
| 写回策略 | 修改 class/style → 通过 postMessage 回传 iframe → 更新 DOM |

### 3.3 与沙箱的关系

编辑功能**不需要放宽 CSP**：
- 点击代理脚本运行在沙箱 iframe 内部（同源内任意执行，不受 `script-src 'none'` 限制）
- 父页面接收外部事件时遵循沙箱策略
- 沙箱内 `script-src 'none'` 仍然阻止外部脚本（CDN 等）

### 3.4 实现关键

```
[CSP: script-src 'none'] 含义：
  ❌ 不执行外部脚本文件（cdn.tailwindcss.com）  
  ✅ 同源 <script> 内联脚本正常工作（点击代理）
  ✅ 内联事件处理器（onclick）独立于此限制（HTML 属性）
  ✅ DOM API 自由使用（document.querySelector 等）
```

---

## 四、移动节点保存回写

### 4.1 描述

用户在 iframe 内拖拽一个 DOM 节点改变位置：
- 记录拖拽起点和终点
- DOM 操作后，重新读取 `document.body.innerHTML`
- 序列化为完整 HTML 源码
- 写入原始文件

### 4.2 核心难点

| 难点 | 影响 |
|------|------|
| HTML 源码格式破坏 | 用户得到的 HTML 可读性下降 |
| Tailwind class 顺序重排 | CDN 编译后不影响功能，但源码 diff 不可读 |
| 事件处理器丢失 | 监听器绑定在拖拽元素上时，移动后可能失效 |
| 自定义 `<style>` 块分割 | 编辑 DOM 后，自定义 CSS 与 DOM 关系需要重新映射 |

### 4.3 可行简化

> **仅支持源码编辑（MVP 策略），不做 DOM 拖拽回写：**
> 技术上限制用户不能可视化编辑 DOM，只能编辑源码。
> 编辑源码后 → 配合"源码+预览分栏"方案 → 即时可看到结果。

---

## 五、源码+预览实时同步

### 5.1 描述

用户在"编辑模式"时，左右分栏：
- 左：CM6 源码编辑
- 右：iframe 预览

编辑左右任一栏 → 自动更新另一个栏的内容。

### 5.2 实现

```typescript
// 监听器架构
editContent -> updatePreview(srcdoc rebuild)
previewClick -> syncToSource(element xpath -> CM6 highlight)

// 核心挑战：双向同步的互锁
需要设计 updateFlag 避免循环触发
```

### 5.3 体验边界

| 行为 | 是否支持 |
|------|----------|
| 源码编辑→预览更新 | ✅ |
| 预览点击定位→源码高亮 | ⚠️ 需要维护 XPath 映射 |
| 预览编辑 DOM→源码回写 | ❌（不做）|

### 5.4 入口条件

只有在"源码+预览分栏模式"下才启用，不追求实时双向同步。默认：

- 编辑模式：左=源码，右=预览  
- 分栏后的窄窗口体验优化（拖拽栏帮助用户调整）

---

## 六、方案总结与阶段归属

| 方案 | 原理 | 阶段归属 |
|------|------|----------|
| Tailwind CDN CSP放宽 | 改 iframe CSP | ✅ MVP 执行 |
| Tailwind WASM 沙箱 | 预编译 Tailwind class → 纯 CSS | 🟡 P1 备选 |
| Google Fonts 离线缓存 | CDN 加载→缓存到本地 | 🔵 远期待办 |
| 属性级可视化编辑 | 右侧面板编辑元素 class/style | 🟡 P1 候选 |
| 移动节点保存 | DOM 序列化回写文件 | ❌ 搁置 |
| 源码+预览实时同步 | 左右分栏双向同步 | 🔵 远期 |

---

## 七、结论

### MVP 决策
- **采用方案 A**：放宽 iframe CSP，放行 `cdn.tailwindcss.com` 和 Google Fonts
- **不追求** Tailwind WASM 沙箱、属性可视化编辑、节点拖拽保存
- 这是**已确定决策**，无歧义

### 完整预编译沙箱方案（下次研究时的参考）
- Tailwind WASM 路线可行但需要 1-2 周
- 核心是：读取 + 解析 + WASM 编译 + 注入 + 沙箱渲染
- 触发条件：用户需求升级或 CSP 信任模型变化时重新评估

---

*本文档为技术探讨记录，非执行规格。具体实现以代码为准。*
