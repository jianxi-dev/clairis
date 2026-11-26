---
title: "窗格预设与主题空间模板（探索稿）"
type: design
status: draft
last_updated: 2026-11-26
---

# 窗格预设与主题空间模板（修订版 v2，评审结论已并入）

- 状态：探索稿 v2 / Codex 评审后修订。P0 已按评审缩表，空间程序单独立项。
- 评审记录：`/codex` consult（session `01a218ab-6557-7cb2-999b-f4df0a42fa74`），结论「不通过原 P0 的四个新面 + L3 绑定」。
- 相关实现：数据面注册表（`src-tauri/src/surfaces.rs`，五面）、配置校验（`src-tauri/src/config.rs`）、设置页（`src/components/SettingsView.tsx`）、chrome 与热区（`src/App.tsx`、`src/styles/editor.css`）、设计系统（`docs/design/system/spec.md`）。

## 修订摘要（相对 v1）

| 评审发现 | 修订 |
|---|---|
| 把两个全局单选做成集合型数据面，越过「数据声明 / 代码动作」边界 | P0 改为两个普通配置枚举 `paneMode` / `paneScale` + 设置行；不新增数据面，仍写六栏落点表 |
| L1/L2/L3 三层对 P0 过度设计 | L3 整体移出本程序；P1 只做「无布局空间」最小验证 |
| 目录扫描不能复用 `surfaces-changed` | 空间 watcher 用独立 `spaces-changed` + 目录指纹去抖；当前空间文件变更只标 stale，不自动重放 |
| 多文件写入非原子、flush 不保存 | 空间应用改为事务化命令 + 预演计划；dirty tab 必须保存/拒绝/确认，不允许静默关闭 |
| `Cmd+Shift+T` 已被占用 | 硬核档临时唤出改 `Cmd+Shift+U`（已核：无既有绑定） |
| 根节点 `--ui-scale` 会波及正文 | 改为容器级 `zoom` + `data-pane-scale`，作用域显式限定 chrome |
| 派生像素值复制进规范 | spec 只定义乘数、作用域与热区公式，派生值不写死 |
| P1 风险集中 | 拆为 1a 无布局空间 / 1b 布局 / 1c 文件与入口 |

## 1. P0：两个窗格预设（本 change）

### 1.1 熟练模式 `paneMode`

需求：三档，简易全显、常规默认隐+鼠标滑入、硬核全隐+快捷键。

- 取值 `simple | standard | hardcore`，默认 `standard`（与现状一致：顶栏常显、状态栏隐藏+底部热区；升级无感）。
- **只做派生呈现，不写穿基础状态**：`paneMode` 不修改 `statusBarHidden`、侧栏可见性等既有状态，只作为 `data-pane-mode` 影响 CSS 与事件闸门。切档不产生快照、不需要恢复原值。
- P0 覆盖范围限定为两类 chrome：顶部 `.app-chrome`（页签条 + 栏目头）与底部状态栏。侧栏/浮层是交互触发元素，移出本 change（评审：按需浮层不应被熟练档禁用）。
- 揭示：常规档只保留状态栏底部热区（沿用 `.status-hotzone`）；顶栏常显，不需要顶部热区；硬核档无热区，`Cmd+Shift+U` 临时唤出，3 秒或 Esc 收回。
- 硬核档保留 1px 顶部提示线（spec §7.7 定义），避免「界面不见了」误判；设置页始终可切回。
- 与阅读态叠加：`readingMode` 优先（既有沉浸语义不变），退出阅读态后 `paneMode` 生效。
- 显隐只加类名/属性，不重建 EditorView，不违反「模式切换不 remount」。

### 1.2 关爱界面 `paneScale`

需求：三档，放大窗格文字与图标，照顾不同年龄层。

- 取值 `small | medium | large`，乘数 0.9 / 1.0 / 1.2，默认 `medium`。
- 机制：`data-pane-scale` 挂在应用根，chromium/WebKit 均支持的容器级 `zoom` 作用于显式列举的 chrome 容器（顶部 chrome、状态栏、设置窗）。`zoom` 同时放大文字、图标与点击热区，避免「字大了更难点的」。
- 作用域明确排除：文档正文、预览、编辑区内容（正文大小由阅读/编辑字号控制）。
- 浮动菜单/浮层第一版不纳入，记后续票（评审：先保证最小闭环，不做全站缩放）。
- 规范：spec.md 新增 §4.1 定义三档乘数、作用域与「派生值不落文本」；机检断言代表性容器的 computed zoom 与正文未受影响。

### 1.3 P0 不做

- 不做新数据面、不做 `pane-modes` / `care-scale` JSON 覆盖、不做热键自定义、不做侧栏显隐、不做 AI 面级通路（无面可读写）。

## 2. P1+：主题空间模板（单独立项，不在本 change）

保留 v1 的分期与风险分析，按评审修订：

- **应用语义**：长期方向是「配置解析边界做 overlay」，不是在每个消费端做解析链；P1 先验证无布局空间（theme + paneMode + paneScale + reader preset），原子应用 + 一次回滚。写穿 + 指针只是在 P1 未做 overlay 前的过渡，不作为长期方案。
- **目录与事件**：`user/spaces/*.json` 独立扫描（目录 + 文件指纹），`spaces-changed` 独立事件；当前空间文件变更只标 stale，不自动重放；id 与文件名一致、路径穿越与大小数量上限校验。
- **数据安全**：含布局/文件的空间必须有预演（将写哪些配置、覆盖哪些面、关闭哪些 dirty tab、缺失哪些文件）；dirty tab 保存/拒绝/确认三选一，flush 不等于保存。
- **原子性**：应用走单条事务命令 + 写前计划；连续应用、删除当前空间、恢复失败、重启后指针失效都要有定义。
- **清单字段**：`schemaVersion`、稳定 `id`、显式 `overlay` 边界、`basedOn` 与合并策略占位（本期不实现继承，但预留，避免以后改结构）。
- **入口**：菜单动态组需扩展菜单 action 白名单，且不能依赖 `menus` 面监听 `spaces-changed`；QuickOpen / 快捷键 / AI 两工具共用一个 `applySpace` 内核。
- **硬核恢复**：不再用「无热区 + 细线」当唯一出路，保留快捷键 + 设置入口 + 首次进入提示。

## 3. 已确认的既有缺陷（动工前置）

- `Cmd+Shift+T` 在非沉浸态绑定 AI 翻译（`App.tsx:622-639`），不能复用作硬核唤出；改用 `Cmd+Shift+U`。
- `readerSkin` 的 `validate_config` 只允许 `paper/plain`，而阅读预设面允许 `paper/indigo/moss/clay`；引用阅读预设的空间会踩到，需单开缺陷票修正。

## 4. 请评审确认的残点（P0 范围）

1. 默认 `standard` 已按「与现状一致」定义（顶栏常显、状态栏隐藏+热区），是否接受？
2. 容器级 `zoom` 是否接受（WebKit/Chromium 支持，Firefox 无桌面目标）？
3. 硬核档 `Cmd+Shift+U` 与 1px 提示线是否足够？
