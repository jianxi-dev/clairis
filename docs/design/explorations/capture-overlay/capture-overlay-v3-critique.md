---
title: "Capture Overlay v3 — Edit Flow 批判"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: openspec/specs/capture/spec.md
superseded_by: ../../../openspec/specs/capture/spec.md
---

# Capture Overlay v3 — Edit Flow 批判

基于 `capture-overlay-v3-draft.md` 在 minimize / 置顶 / 多显示器 / 转场碰撞上的逐条审查。每条 问题 + 修复方案，按严重度排序。

---

## 严重级（上线前必修）

### E1 置顶后 Esc 不还原
**现象**：置顶后 Escape 只会清空输入（默认行为语义），不会把浮窗 revert 到非置顶态。这与用户"Esc = 关闭/退出"的强心智模型冲突。用户按 Esc 没反应，会连按多次误清输入，或误以为浮窗卡了。
**修复**：`handleEsc` 改为三态 CLOSED ⊳ PINNED ⊳ NORMAL，Escape 总是降级到下一个状态：

```
function handleEsc() {
  if (isPinned) { unpinToNormal(); return; }   // 先退出置顶
  if (input.value.length) { clearInput(); return; } // 再清空
  closeOverlay();                               // 最后关
}
```

→ ponytail: Esc 只需 5 行逻辑，加 Esc 快捷提示文案即可（`esc` 灰色小字放输入框右侧，点击等于发 Esc 事件）。

### E2 多屏切换时浮窗越界
**现象**：浮窗口坐标只存了当前屏的 x/y。Mac 合盖/拔外接屏时窗口被抛弃到不可达区域，点击 Dock icon 回不来。同理，Capsule 在右侧屏缩小后，切到单屏时下右坐标仍可能越界。
**修复**：恢复/创建窗口前 clamp 到 `screen.frame`，单函数封装，所有 `BrowserWindow.setBounds` 调这函数：

```
function clampToScreen(win) {
  const f = screen.getDisplayNearestPoint(win.getBounds()).workArea;
  const b = win.getBounds();
  b.x = Math.max(f.x, Math.min(b.x, f.x + f.width - b.width));
  b.y = Math.max(f.y, Math.min(b.y, f.y + f.height - b.height));
  win.setBounds(b);
}
```
→ ponytail: 窗口恢复时调一次，合盖场景由 `displayRemoved` 事件驱动，零持久化开销。需 clamp 的场景再加 hook。

### E3 Capsule 点击还原与置顶点击冲突
**现象**：Capsule 用点击还原，置顶（Pin）也是小按钮点击。Pinned 状态下的点击坐标落在 Pin 按钮上时，还原逻辑与 Pin toggle 打架——还原时需要判断"当前是不是 Capsule 态"，但代码路径是 Capsule.toggle → BrowserWindow.toFullScreen 同时 Pin 在跑，视觉上闪回 + 灰框。
**修复**：Pin 按钮在 Capsule 态被盖住（Capsule 按钮 > Pin 按钮 z-order），优先 Capsule 还原。Capsule 先 `setBounds(persistentRect)`，再允许 Pin 事件。一个守卫判断：

```
ipc.handle('capsule-click', () => {
  if (isPinned) { unpinWindow(); }  // 先把窗口还回去
  restoreWindow();                  // 再展开
});
```

### E4 拖拽点与最小化按钮热区重叠
**现象**：44px Top Bar 里：拖拽点 (drag dot) 在最左，Minimize ⊟ 在右上。拖拽点 col-resize 缩到 4px 但 hover 放大到 6px。Minimize 常态 16px，100ms 淡入。如果拖拽点 hover 到 10px 半径（≈14px），拖点 reach 到 18px 半径热区时已与 ⊟ 按钮水平重叠。用户想按 ⊟ 但被识别为 window drag。
**修复**：拖拽点 hover scale 上限从 1.5x (→6px) 降到 1.2x (→4.8px)，热区仍是 18px 圆形但只对 horizontal move 响应，click 按 normal button 处理。简单做法：用 `app-region: drag` 只覆盖 dot icon 那一个 12px 子 div，旁边紧邻的 ⊟ 用 `no-drag`。CSS 一行：

```
.topbar { display: flex; align-items: center; }
.drag-dot { -webkit-app-region: drag; }  /* 整个 Topbar 不用 drag */
.minimize { -webkit-app-region: no-drag; }
```

→ ponytail: 只 drag dot 热区是 14×14 而不是整个 bar，精确避让 ⊟。

---

## 中危（建议修）

### E5 "记录保存检测"悬浮窗被全局 screen recording/window list 工具识别
**现象**：开启 macOS Screen Recording 权限（浮窗需要录制屏幕用于检测活动窗口内容？）后，系统级录屏指示器（橙点）常驻。如果 Jianxi 浮窗不主动 hook screen recording API support，用户不会知道为什么。同理 Accessibility API（观察 input change）被 Screen Recording 检查工具报告可疑。
**修复**：不需要写 screen recording capture 的逻辑。只在 `About` / 偏好设置里打开一行斜体说明：
```
"本浮窗使用 macOS Accessibility API 监听当前活动应用名称，用于自动归类捕获项"
```
并在第一次启动时弹一次 `requestAccessibilityPermission()` 引导授权。

→ ponytail: `NSWorkspace.sharedWorkspace.runningApplications` 监听 `NSWorkspaceDidActivateApplicationNotification`，零录音权限，也不需 entitlement，隐私风险最低。

### E6 最小化动画期间的过渡闪烁
**现象**：draft 5.5 节 "浮窗缩小为 44×44px" 没规定过渡方式。若使用 `win.setBounds(width/height)` 直接缩到 44 像素，macOS 合成器会让窗口在两帧之间出现"缩飞"方向不确定，显得抖动。
**修复**：使用 `NSWindow.setFrame:display:animate:` + spring animation（系统原生）或 `win.setBounds(bounds, true)` 的 animate 参数（Electron 11+ 支持）。避免自己写 transform 补间。

---

## 低危 / 改善

### E7 置顶态 Capsule 还是缩小？规格没说
**现象**：叠加态是"打开 → Capsule（最小化）→ Restore → Pin"，还是"打开 → Pin（自动进 Capsule 大小）→ Restore → ?" 状态机没定义。
**修复**：补白一条状态优先级：Capsule > Pin。Capsule 下再次点 Pin 先把窗口恢复到原大小。

### E8 Escape 清空输入与国际化
**现象**：`input.value.length` 为空时 Cleared 判断会跳过日文假名 + 拼音输入法（composition）的中间态，用户按 Esc 想选词却把输入框清光了。
**修复**：监听 `compositionstart` / `compositionend`，在 composition 中禁用 Esc 清空。

---

## 汇总表单

| ID | 严重度 | 问题类别 | 修复行数 | 是否 Ponytail "一行保底" |
|----|--------|---------|---------|--------------------------|
| E1 | 严重 | Escape 还原 | ~10 | ✅ 三态机 |
| E2 | 严重 | 多屏越界 | ~10 | ✅ clamp |
| E3 | 严重 | 点击冲突 | ~5 | ✅ 守卫 |
| E4 | 严重 | 拖拽热区 | ~3 (CSS) | ✅ app-region 分工 |
| E5 | 中 | Screen Recording 误判 | ~1 (Listeners) | ✅ 零录制 |
| E6 | 中 | 过渡闪烁 | ~1 (parameter) | ✅ animate=true |
| E7 | 低 | 状态优先级 | 文档 1 行 | ✅ |
| E8 | 低 | IME | ~4 listeners | ✅ composition guard |

---

## 风险外的一行建议

>浮窗口关闭时不销毁 `BrowserWindow` 实例，`win.hide()` 保活以减少下次热启动暗跳。Capsule 是 overlay 的 `setSize(44,44) + setMovable(false)`，不是单独窗口。整个系统只需要 1 个 BrowserWindow 类，0 额外抽象。
