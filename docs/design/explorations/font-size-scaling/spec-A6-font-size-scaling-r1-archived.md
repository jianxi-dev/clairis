---
title: "A-6 字号缩放设计规格"
type: design
status: archived
last_updated: 2026-08-01
source_of_truth: historical
redirect: docs/design/approved/font-size-scaling/spec.md
---

# A-6 字号缩放设计规格

> 来源：July 12, 2026 印哥 + Hermes 设计讨论
> 阶段：Phase R
> 关联：A-5 沉浸阅读（字号调整在沉浸态下的行为）

---

## 1. 问题陈述

当前字号调整逻辑太简单——`Cmd+=/-` 改的是单个数字，没有区分"阅读字号"和"编辑字号"，也没有记忆。

真正的字号体验不是 "fontSize=18"，而是：
- 读诗时 20px 享受文字本身的重量
- 写代码时 14px 看到更多上下文
- 写长文时 17px 兼顾可读和密度

不同场景有不同的字号需求，字号是阅读体验的核心维度，不能一刀切。

---

## 2. 双轨道字号模型

### 2.1 全局默认字号（持久化）

存在 `~/.config/clairis/config.json`：

```json
{
  "fontSize": {
    "reading": 17,
    "editing": 16
  }
}
```

| 字段 | 默认值 | 含义 |
|------|--------|------|
| `reading` | 17px | 所有文档的阅读字号默认值 |
| `editing` | 16px | 所有文档的编辑字号默认值 |

### 2.2 单文档覆盖字号（非持久化）

存在内存 store，key = `filePath`：

```typescript
interface PerDocFontSize {
  [filePath: string]: {
    reading?: number;    // 该文档阅读字号覆盖
    editing?: number;    // 该文档编辑字号覆盖
  };
}
```

**何时使用覆盖？**
- 用户在某文档内按 `Cmd+=/-` 调整了字号
- 沉浸态下字号自动使用覆盖值
- 关闭文档 → 覆盖丢弃
- 重启 app → 覆盖不存在

### 2.3 字号解析逻辑（运行时）

```
实际字号 = 
  该文档覆盖存在 ? 覆盖值 :
  全局对应模式字号
```

```typescript
function resolveFontSize(filePath: string, mode: 'reading' | 'editing', global: ConfigFontSize): number {
  const cover = perDocFontSize[filePath];
  if (cover && cover[mode]) return cover[mode];
  return global[mode];
}
```

### 2.4 字号范围

- **范围限制**：12px ≤ size ≤ 32px
- **步进**：1px（精细控制，无 2px 跳跃）
- **滑杆逻辑（如果未来加 UI 滑杆）**：1px 步进，无跳跃值

---

## 3. 交互规格

### 3.1 快捷键行为

| 快捷键 | 当前模式 | 改什么 | 是否持久化 |
|--------|---------|--------|-----------|
| `Cmd+=` | 阅读/预览 | `reading` 字号覆盖 +1 | ❌ 非持久 |
| `Cmd+-` | 阅读/预览 | `reading` 字号覆盖 -1 | ❌ 非持久 |
| `Cmd+=` | 编辑/源码 | `editing` 字号覆盖 +1 | ✅ 持久化 |
| `Cmd+-` | 编辑/源码 | `editing` 字号覆盖 -1 | ✅ 持久化 |

**关键：阅读改的是 overlay（非持久），编辑改的是 config（持久）。**

为什么这么设计？
- 阅读字号是"这篇文档我想大点看"——换一篇就走，不需要永远记住
- 编辑字号是"我就习惯小字写代码"——改一次以后每次都生效

唯一的例外：用户可以在 settings 里打开 **"阅读字号调整同步到全局"**，这时阅读字号调整也写入 config。默认关闭。

### 3.2 字号调整 UI 反馈

```
调整瞬间（0-100ms）：
  - 字号即时生效，无淡入淡出
  - 当前字号生效点无任何闪烁

100-1200ms 后：
  - 屏幕中央偏上（1/5 屏幕高度）浮现字号标签
  - 标签样式：font-size 是当前字号 * 0.8, color rgba(0,0,0,0.25), letter-spacing 0.05em
  - 总显示 1.0s, opacity 曲线 ease（快进慢出）
```

### 3.3 字号与预览/编辑共用

字号只改 `--editor-font-size` 这一个 CSS 变量。预览和编辑的渲染引擎共享同一个 CSS 变量，不需要两边都设。

---

## 4. 字号与分栏

| 分栏场景 | 字号调整行为 |
|---------|-------------|
| 左右双栏（编辑+预览） | 只影响当前激活的 pane，另一 pane 不变 |
| 上下双栏（文档 A + 文档 B） | 只影响当前激活的 pane，另一文档字号独立 |
| 沉浸态单文档 | 统一字号（全屏幕只有一个字号需求） |

**每 pane 独立字号，不跨 pane 同步。**

---

## 5. 字号与沉浸态

参考 A-5 §3.2。

沉浸态下字号调整行为：
- 不区分阅读/编辑（沉浸态总是阅读）
- 字号覆盖存在 `immersionState.fontSizeOverride`
- 退出沉浸时，如果 `fontSizeOverride` ≠ null → 写入该文档的 `reading` overlay（非全局）

---

## 6. Store 变更

### 6.1 `config.ts` slice

```typescript
interface ConfigSlice {
  fontSize: {
    reading: number;   // 默认 17
    editing: number;   // 默认 16
    syncReadingToGlobal: boolean; // 默认 false
  };
}
```

### 6.2 `tabs.ts` slice

```typescript
// 每文档字号覆盖
interface TabPerDocPrefs {
  [filePath: string]: {
    reading?: number;
    editing?: number;
  };
}
```

### 6.3 新增 action

```typescript
// 调整字号
setFontSizeAdjust(delta: 1 | -1, context: 'reading' | 'editing'): void {
  const current = this.resolveFontSize(this.activeTab.filePath, context);
  const next = Math.max(12, Math.min(32, current + delta));
  
  if (context === 'editing' || this.config.fontSize.syncReadingToGlobal) {
    // 持久化路径
    this.config.fontSize[context] = next;
    scheduleConfigSave();
  } else {
    // 覆盖路径（仅内存）
    this.perDocFontSize[this.activeTab.filePath] = {
      ...this.perDocFontSize[this.activeTab.filePath],
      reading: next
    };
  }
  
  document.documentElement.style.setProperty('--editor-font-size', `${next}px`);
}
```

---

## 7. 不做的事（YAGNI 声明）

1. **不做字号"重置为默认"的快捷键** — 如果需要，加到 settings UI 或通过"关闭文档后自动重置"解决
2. **不做字号滑杆** — 只在 settings UI 中放，不在主 UI 常驻
3. **不做"字号跟随系统"** — macOS 系统字号缩放由 `Cmd+=/-` 替代，不再做跟随
4. **不做多光标/同步字号** — 单编辑器的字号是局部的，不做"所有文档同步字号"
5. **不做字号保存到 frontmatter** — 字号是阅读偏好，不是文档元数据
6. **不做字号变更的历史记录** — 不需要 Cmd+Z 撤销字号变更

---

## 8. 验收标准

| # | 场景 | 预期 |
|---|------|------|
| 6.1 | 编辑态按 Cmd+= | 字号 +1px，"16px→17px" 短暂浮现，config.json 同步更新 |
| 6.2 | 预览态按 Cmd+= | 字号 +1px，perDoc overlay 存储，config.json 不变 |
| 6.3 | syncReadingToGlobal=true + 阅读按 Cmd+= | 字号 +1px，config.json 同步更新 |
| 6.4 | 字号超出 32px 再按 = | 字号不变，无任何反馈提示 |
| 6.5 | 字号低于 12px 再按 - | 字号不变 |
| 6.6 | 分栏 A=17px B=16px，焦点在 A | 按 = 后 A=18px B=16px |
| 6.7 | 关闭文档再打开 | perDoc 覆盖丢弃，字号回到全局默认 |
| 6.8 | 字号调整切换文档 | 目标文档字号根据其 overlay 或全局默认解析 |
| 6.9 | 沉浸态按 Cmd+= | fontSizeOverride 写入，退出沉浸后变为 perDoc overlay |
| 6.10 | 全局字号编辑覆盖 + 新建文档 | 无任何覆盖，字号解析为全局默认 |
