---
title: "标月主界面 Shell 设计 — 定稿"
type: design
status: accepted
last_updated: 2026-08-01
source_of_truth: supporting
---

# 标月主界面 Shell 设计 — 定稿

> R 阶段 | Tauri + React + CM6 | 超越 Xcode  
> 综合 Codex 评审 + 印哥 6 大问题修订

---

## 核心设计决策

### 决策 1：消除"未保存"态

传统编辑器 `Cmd+N → path=null → 用户编辑 → 等待 Cmd+S` 的路径被彻底消除。

```
Cmd+N → 立即在 ~/Documents/Jianxi/ 创建 Unnamed-2026-07-13-1030.md
      → 2s debounce 写入该路径
      → 用户全程无需关心保存
      → 想改名时双击页签直接编辑
```

**amber 点 / dirty indicator / morph 动画 —— 全部删除。**

| 场景 | 状态栏显示 |
|------|-----------|
| 编辑中等待 debounce | （无显示 — 不打扰） |
| 保存成功 | （无显示 — 无需告知正常的事） |
| 保存失败 | `保存失败 ⚡` （红色，常驻，点击展开详情） |

ponytail: 不打扰用户，除非出错。Apple Notes / Bear 全部这么做。

### 决策 2：双击页签重命名

替代 Cmd+Shift+S → 弹窗 → 选路径 → 命名的老路径。

- 双击页签 → 文件名进入编辑态（input 替换 span）
- 按 Enter / 点击外部 → 重命名文件 + 更新 path
- 按 Esc → 取消
- 文件名输入框：只读扩展名部分（`.md`），只让用户改主名

ponytail: 一个双击事件 + 一个 input。零新组件。

### 决策 3：Cmd+Shift+S 的未来规划

P2 再做"另存为"—— 用户有明确需求时再加。R 阶段：
- 双击页签 = 重命名（原地重命名文件）
- 不弹对话框

如果未来需要"移动到另一个目录"，用拖拽页签到 Cmd+P 面板里的文件夹实现。

---

## 快捷键总表（修订版）

| 快捷键            | 动作                                              |
| ----------------- | ------------------------------------------------- |
| Cmd+E             | 预览 ↔ 编辑循环；源码 → 编辑                      |
| Cmd+Shift+E       | 源码模式                                          |
| Cmd+Shift+R       | 阅读模式                                          |
| Cmd+Shift+I       | 沉浸模式                                          |
| Cmd+Option+→/↓    | 水平/垂直分栏                                     |
| Cmd+Shift+W       | 关闭当前分栏面板                                  |
| Cmd+F             | 文档内查找                                        |
| Cmd+Shift+F       | 全局跨文档搜索                                    |
| Cmd+P             | 统一上下文浏览器（模态）                          |
| Cmd+N             | 新建（自动生成文件名+路径）                       |
| Cmd+O             | 打开文件                                          |
| Cmd+S             | **不需要** — 2s 自动保存已足够                    |
| Cmd+Shift+D       | 亮/暗主题切换                                     |
| **Ctrl+Tab**      | 直接循环切换已打开页签                            |
| Cmd+[ / Cmd+]     | 后退/前进（分栏面板历史）                         |
| **双击页签**      | 重命名文件                                        |

ponytail: Cmd+S 从快捷键表里移除。不是因为保存不重要，是因为自动保存已经做了这件事。用户在特殊场景下想立刻保存 → Ctrl+S 原地触发（仅保存，无 UI）。

---

## 语义色规则

| 颜色       | 值（亮/暗）     | 含义             | 使用场景                    |
| ---------- | --------------- | --------------- | --------------------------- |
| 品牌蓝     | #0071e3         | 激活/选中        | 时钟徽章、选区、聚焦环      |
| 红         | #ff3b30         | 错误专用         | 保存失败                    |

（删除琥珀 — 不再需要"未保存"颜色）

---

## Token

亮色：shell-bg #f5f5f7 | canvas #ffffff | glass rgba(255,255,255,.72) |
       品牌蓝 #0071e3 | 文本 #1d1d1f | 次要文本 #6e6e73
暗色：shell-bg #000000 | canvas #1c1c1e | glass rgba(28,28,30,.72) |
       品牌蓝 #0071e3 | 文本 #f5f5f7 | 次要文本 #a1a1a6

品牌蓝：白底 4.6:1，#1c1c1e 底 7.1:1。双模式 OK。

---

## 整体布局

```text
[<] [文件1] [文件2] [文件3] ... >> [眼睛 预览] [...=]
 导航 | ---- 页签 ---- |  溢出   模式+标签   更多
Chrome Bar 40px
+----------------------------+
|        编辑画布            |
|        max 720px           |
+----------------------------+
行 12 · 1,284 字 · 68% · 预览    Status Bar 24px
```

- 新建 `Cmd+N` 时：立即在 `~/Documents/Jianxi/` 生成 `Unnamed-YYYY-MM-DD-HHMM.md`
- 页签标题显示文件名，双击编辑，扩展名 `.md` 只读
- 保存失败时状态栏红色提示，平时不打扰用户

---

## Chrome Bar（唯一顶栏）

### 分隔线
底边 1px `var(--border-subtle)`。

### 截断级联
1. 页签溢出 → `>>` 下拉
2. 导航图标缩到 24px
3. 模式切换丢标签 → 图标 only

### 导航（左）
- 后退/前进：28x28
- 分栏面板内各自独立维护历史栈
- 双指水平滑动触摸板 = 触发后退/前进（deltaX > 30 阈值）

ponytail: 删掉快捷时钟。原因：时钟的核心用途是承载未保存徽章，未保存态消除后时钟无内容。Cmd+P 已经在做"最近文档"的完整场景。一个无功能的图标占用 40px 是不必要的 chrome。如果未来需要（如同步状态、AI 对话指示），再按需加回来。

### 页签（中间）
椭圆胶囊，半径 20px，高 32px。

**双击页签 → 重命名：**

```css
.tab-title-input {
  background: var(--canvas-bg);
  border: 1px solid var(--accent);
  border-radius: 4px;
  outline: none;
  padding: 0 4px;
  font-size: 13px;
  font-family: inherit;
}
```

- 双击标题区域进入编辑态
- 扩展名部分（`.md`）以 disabled span 缀在 input 后面
- Enter / blur → commit（调用 Rust `rename_file` 命令）
- Esc → cancel
- 非法字符弹窗校验（`/ \ : * ? " < > |`）

ponytail: 一个双击 handler + 一个 input + 一个正则校验。

### 活跃页签：无缝

```css
.tab.active { background: var(--canvas-bg); border-bottom: none; }
```

### 模式切换

| 当前模式 | 图标           | 标签     | 点击后 |
| -------- | -------------- | -------- | ------ |
| 预览     | Maximize2      | 全屏     | 进全屏 |
| 编辑     | PenSquare      | 预览     | 预览   |
| 源码     | Code           | 编辑     | 编辑   |

- 预览模式下图标从 Eye 变成 **Maximize2**（外向箭头），hover tooltip "展开全屏 (Cmd+Shift+I)"
- 用户心态："我在预览，想全屏 → 点那个箭头"，零学习成本
- Cmd+E 仅在预览↔编辑循环，源码→编辑（对称退出）

固定宽度 60px，中英文无布局跳动。

### 图标统一：Lucide Icons（1.5px stroke, 24px grid, 线型）

| 用途 | Lucide 名 | 用途 | Lucide 名 |
| ---- | --------- | ---- | --------- |
| 预览 | Eye | 前进/后退 | ChevronLeft/Right |
| 编辑 | PenSquare | 更多/折叠 | ChevronDown/Right |
| 源码 | Code | 关闭 | X |
| 全屏 | Maximize2 | 时钟 | Clock |
| 恢复 | Minimize2 | 新建 | Plus |
| 打开 | FolderOpen | | |

选 Lucide 的理由：
- 1.5px stroke 与 Apple SF Symbols 同构，比 Heroicons 2px 更精致
- 24px grid 像素对齐，不发虚
- 圆角线头（Rounded），1200+ 图标全覆盖
- MIT 许可，商用 OK
- tree-shakeable，打包只算用到的
- React 生态标准（`lucide-react`）

ponytail: 一个 import 完事。不用自定义 SVG、不用 Font Awesome、不用 Heroicons。

### 更多菜单

```text
文件
  新建           Cmd+N
  打开           Cmd+O
  重命名...      双击页签
  导出 PDF...    Cmd+Shift+E (P2)
视图
  源码模式       Cmd+Shift+E
  阅读模式       Cmd+Shift+R
  沉浸模式       Cmd+Shift+I
分栏
  水平分栏       Cmd+Option+→
  垂直分栏       Cmd+Option+↓
  关闭分栏       Cmd+Shift+W
```

### 沉浸模式
Cmd+Shift+I。全窗口，chrome 隐藏。光标距顶 60px → chrome 滑入，离开 >1s 滑出。Esc 退出。

---

## 分栏面板

```text
+--------------------+---------------------+
| [页签-a] [页签-b]  | [活跃页签]          |
| 主面板             | 分栏面板            |
|------ 4px 拖拽 ------|
+--------------------------------------+
```

### 分栏操作方式
1. 快捷键：Cmd+Option+→/↓
2. 拖拽页签到画布右/下边缘：24px 蓝色拖入暗示带 → 松手生成
3. 拖拽页签到分隔线另一侧：移动到对面面板

ponytail: 不加常驻分栏图标（右側 controls 区已拥挤）。首次分栏成功后，在 More 菜单"分栏"分组顶部显示一行一次性提示 "下次试试 Cmd+Option+→ 一键分栏"（12px `--text-tertiary`），用户点过后永久隐藏。

### 分栏内 Trackpad 导航
```javascript
onWheel={(e) => {
  if (Math.abs(e.deltaX) > 30) {
    if (e.deltaX > 0) navigate('back', paneId);
    else navigate('forward', paneId);
  }
}}
```

每个分栏面板维护独立历史栈（文件光标 + 文件切换）。

**效果：** 双指在触摸板上左/右轻扫 → 当前分栏面板内的文档切换为上一个/下一个历史文件。切换动画：文档内容从边缘滑入（150ms spring），与 Tab 切换同构。

ponytail: 与浏览器双指后退/前进同构。用户已经在浏览器里养成这个肌肉记忆，无需教学。

### 分隔线
默认透明，hover 显示 `--accent` 40%。吸附 33/50/67%。double-click 关闭分栏面板。

---

## 状态栏（分级显示）

```
[行 12 · 1,284 字 · 68% · 720px]  [预览]
```

**常驻 opacity 0.6：**
- 行/列：跳转参考
- 字数：中文用户直觉
- 阅读进度：长文档归属感（短文显示 "—"）
- 页面宽度：点击弹浮窗调整

### 页面宽度浮窗

点击宽度值 → 弹出浮窗（180px 宽，在状态栏该字段**上方** 8px 处弹出）：

```text
            当前: 720px
                  v
   +-------------------------------------+
   |  页面宽度                            |
   |                                      |
   |  [==●=============]                  |
   |   400             720            1200|
   |                                      |
   |  窄(480)  标准(720)  宽(960)        |
   +-------------------------------------+
```

- 滑块：400-1200px 可调，实时预览
- **三档快捷：窄(480)、标准(720,默认)、宽(960)。pill 按钮，选中态品牌蓝**
- 关闭：点击外部 / Esc

ponytail: 3 档 > 5 档。三个认知档位 + 滑块负责精细调节 = 分工清晰：点快捷档回归常用宽度，拖滑块找完美位置。max-width 720 是默认阅读宽度，1200 是宽荧幕上限，400 是手机预览下限。

ponytail: `ponytil:` 原文档已超出认知负荷（磁磁 rail 4 个 pill 按钮），3 档走天下。

ponytail: `<input type="range">` + 3 个 `<button>`。零依赖。宽度值写到 config 持久化。

**tooltip（hover 时显示完整信息）：**
- 完整路径
- 编码 UTF-8
- 换行符 LF/CRLF

**临时显示（opacity 1.0，3s 淡回）：**
- 保存失败：红色，点击展开细节

ponytail: hover tooltip 用 `title` 属性实现，零 CSS。

---

## 空状态

引用 `spec-B1-B2-B4-B5-empty-state.md`，本 spec 不重复定义。

---

## 动画

| 名称            | 曲线                         | 时长  |
| --------------- | ---------------------------- | ----- |
| `--ease-spring` | cubic-bezier(.2,.8,.2,1)     | 250ms |
| `--ease-snappy` | cubic-bezier(.4,0,.2,1)      | 150ms |
| `--ease-gentle` | cubic-bezier(.4,.8,.4,1)     | 350ms |

页签 hover: 0/200ms。关闭按钮: 0/200。模态: 200/150ms + 8px 上滑。

---

## 实现优先级

1. Chrome Bar v7（分隔线 + 截断级联 + 导航滑动）
2. 模式切换（固定宽度 60px）
3. 双击页签重命名
4. Cmd+N 默认路径生成
5. 自动保存写入默认路径
6. Cmd+P 模态面板
7. 分栏拖拽 + 边缘暗示带
8. Trackpad 滑动导航
9. 状态栏分级显示
10. Cmd+Option+方向键分栏
11. 空状态引用外部 doc
12. 微交互走查

## P1 预留：手势操作（P1 再做）

印哥提出的手势操作，暂不实现，仅预留定义供 P1 对齐：

| 手势 | 行为 | 实现方式 |
|------|------|----------|
| 右键鼠标 + 右上滑动 | 进全屏 | 监听 `mousedown` 右键标志 + `mousemove` 方向向量 |
| 双指按住触摸板 + 右上滑动 | 进全屏 | 监听 `wheel` 事件的 `deltaX + deltaY` 双轴同向 |

P1 暂不实现，R 阶段：
- Cmd+Shift+I 已满足全屏需求
- 双指触摸板导航已在分栏面板做（Cmd+[ / Cmd+]）

ponytail: 只是预留，写一句话确认设计意图即可。
