# Design — editor-surface-batch17

> 目标：把 12 条反馈落成可验收的真实链路行为。每条决策都给出「为什么」与「怎么算对」，不复制像素值。

## D1 页签右键菜单关闭协议

- 菜单保留 TabBar 内联实现（不迁移到共享 `ContextMenu`，避免改动焦点/键盘导航语义），但接入与 `ContextMenu` 相同的四条关闭来源：`document pointerdown`（capture）、`keydown Escape`、`window blur`、`window scroll/resize`。
- 内部判定从 `.fixed.z-50` 类名改为菜单自身的 `data-tab-menu` 标记——类名是样式细节，任何 z-50 浮层都会误判为「菜单内部」。
- iframe/跨文档点击：父窗口收不到事件；用 `window blur` + 下一次 `pointerdown` 兜底。菜单打开期间 `overlayGate` 已置位，失焦即关闭不破坏现有语义。
- 右键菜单打开的那次 `contextmenu` 不产生 `click`，不需要延迟注册；保留 0ms 延迟无害，但改为同步注册并跳过首个事件。

## D2 PDF 按钮栏快捷键

- `⌘⇧D` 已注册（`shortcuts.ts`），问题在监听阶段与焦点：`App.tsx` 的 keydown 是 window 冒泡；PDF 视图是自定义元素/shadow DOM，内部控件可能消费按键。改为 **document capture 阶段**处理该组合键（与 Cmd+I 的既有做法一致），命中时 `preventDefault`。
- 只在活动页签 `fileKind === "pdf"` 且 `tab.path` 有值时生效；调用 `togglePdfToolbarPin(path)`（路径注册表已在 `pdfToolbarPin.ts`）。
- 可发现性：保留 `shortcuts.ts` 条目；在 PDF 固定按钮 `title` 中带 `（⌘⇧D）`；快捷键总览按现有 `shortcutsByFamily` 自动渲染，无需新 UI。
- 不引入快捷键自定义存储：当前仓库无通用快捷键编辑通道，新增一套属于独立 change。

## D3 悬停提示时机

- 删除 `TIP_DELAY_MS = 60_000`。延迟取 `config.noticeDuration`（秒）×1000，范围钳制 100–10000ms；未配置回退 400ms。
- 复用既有「提示信息显示时长」配置，不新增字段：用户已经能设置该值，且反馈明确指向「设置了显示的时间，悬停后未显示」。设置描述改为「提示信息显示时长（秒）：悬停提示与底部提示」。
- 提示仍受 `overlayGate` 抑制；指针离开、按下、滚动、失焦立即清除（沿用现有清理路径）。

## D4 左边栏快捷键

- `⌘\` 语义统一为「切换左边栏可见性」：`collapsed → pinned`，`pinned/hover → collapsed`。不再在折叠态切沉浸阅读（沉浸阅读已有 `⌘⇧F`）。
- 新增 `⌘⌥\` 为「切换固定」：`pinned ↔ hover`；`collapsed` 时先展开为 pinned 再下一次取消固定。
- pin 按钮、边缘热区、hover 计时保持不变；快捷键只调用 store 的既有 action，避免第二套状态机。
- 快捷键注册表新增 `global-rail-pin` 条目（family global），总览自动显示。

## D5 预览分栏渲染

- `renderMarkdown` 在 `preprocessAlignmentDivs` 同层增加 `preprocessColumnDivs`：识别 `^ {0,3}:::+\s*\{([^}]*)\}\s*$` 且属性含 `.col-N` 或 `cols=N`（N=1..6）的开围栏，直到匹配的 `:::` 闭围栏；输出 `<div class="layout-col-N">…</div>`，内部 markdown 递归交给 marked。
- 不支持的属性和无 `col` 的围栏保持原样（不吞内容）。
- `reader.css` 增加 `.preview-content .layout-col-N` 的网格规则：N 等分、列间距沿用既有块间距 token；窄视口折叠为单列（与既有响应式断点一致）。
- 编辑态 `columns.ts` 的 `.cm-columns[data-cols]` 已存在；本票只补预览侧，保证两态同貌（列数、顺序、文本一致）。

## D6 插入 CSS 图标

- 先写真实 DOM 探针（Playwright）：打开 MD 文档 → 空行「+」→ 菜单出现 → 断言 `[data-cmd="insert-css"] svg[data-icon="CssOutlined"]` 存在且 `getBoundingClientRect().width > 0`。
- 若探针失败：检查 `renderMenu` 的 `cmd.icon` 分支与 `renderIcon` 的 fallback；补齐缺失的 `icon` 或注册表路径。
- 无论探针初始结果如何，e2e 断言永久保留，防止再次回退。

## D7 HTML 区块尺寸拖拽

- `startResize` 在 handle 上 `setPointerCapture(e.pointerId)`；`pointermove/pointerup/pointercancel/lostpointercapture` 全部挂在 handle 上，不依赖 window 事件穿过 iframe。
- guide 几何：维护 `left/top/width/height` 四值；西侧(`w`)拖拽同时更新 left 与 width，北侧同理；边界钳制最小 24px。
- 写入：`applyStylePatch` 同时写 `width/height` 与 `box-sizing: border-box`，避免 padding/border 叠加导致「越拖越大」。
- 新增「恢复尺寸」按钮：清除 inline `width/height/box-sizing`（`applyStylePatch` 传 null），并同步 guide。
- `pointercancel`/`blur`/Esc 一律结束拖拽并清空 guide 的拖拽态；文档重建后由 `selectionRect` 重新定位。

## D8 HTML 工具条

- 文字节点与文字选区工具条统一补：背景色（`background-color`）、字体族（`font-family`）、字号（显示当前值）；字号/字体控件用 `select`，`value` 取 `info.style[...]`，未知值作为额外 option 保留。
- 所有文字标签改图标按钮：AI/链接/截图/删除/对齐用 `icons.ts` 现有图形；按钮保留 `aria-label` 与 `title`。
- 移除截图按钮（`onCapture` 入口从工具条删除；E-21 截图能力保留代码但不再从工具条进入——本批不改 E-21 其余语义）。
- 区块工具条「边框」改为 `<input type="color">`：读取 `border-color`，写入 `border-color` 且若无边框则同时写 `border: 1px solid <color>`；再次选择同色不清除边框。**该按钮只改当前选中区块元素自身的边框色，不改文字颜色。**
- 对齐改为 `select`：左/中/右/两端（`text-align: justify`）；文字节点与文字选区一致。

## D9 选区白色浮层

- `runtime.ts` 的拖拽启动条件加「选区必须折叠」：mousedown 后若 `getSelection()` 非空或用户开始划选（selectionchange 先于阈值），取消拖拽意图。
- 白色幽灵（`rgba(255,255,255,.7)`）仅在确认拖拽（超过阈值且无文字选区）后创建；划选路径不再创建。
- 现有 e2e 增加「划选文字 → ghost 节点数 0、文档不变」。

## D10 图片注释 / 对齐 / 双击预览

- 注释检测放宽为跨一个换行与任意前导空白：`/^[ \t\r\n]*<!--\s*w=(\d+)\s*(?:-->|—>)/`，并同步 `parseImageWidth`/`imageWidthCommentEnd`/`writeImageAttributes`；裁剪写入时无条件移除匹配到的注释（attr 块存在与否都移除）。
- 对齐可见：`imageToolbar` 继续设 `aria-pressed`，`editor.css` 增加 `.cm-image-toolbar button[aria-pressed="true"]` 的实色高亮（用既有 accent token），保证与未选中态有可测色差。
- 双击预览：把裁剪矩形带入 `openImageMaximize`，对 `<img>` 应用与行内一致的 `object-fit: none` + `object-position` + 容器尺寸，使预览呈现裁剪后的画面。

## D11 转换菜单完整显示与适配

- `positionPanel` 先取可用高度 `bounds.height - 16`；若菜单自然高度 ≤ 可用高度，完整显示（不设 maxHeight）。
- 若超出：按比例压缩行高至下限 28px；仍超出才启用纵向滚动。压缩时图标与文字保持 20px/12px 最小可读尺寸。
- 菜单宽度保持 176px；不改两菜单同宽约束。

## D12 分栏插入

- 复用表格网格的 `GridState`/`renderGrid` 机制，新增 `gridKind: "columns"`：1 行 × 5 列竖向柱子，单元无文字；指针 `mouseenter/mousemove` 按列索引选中「第 1..i 根」，`data-on` 高亮。
- 单击第 i 根插入 `::: {.col-i}`；键盘左右移动选中，Enter 插入。
- 移除旧 `layout: "columns"` 的带文字单元渲染分支，避免两套入口并存。

## D13 视频块

- `MediaWidget` 增加 `align`/`width` 读取：从图片属性语法（`{width=… align=…}`）解析，复用 `parseImageAttributes`。
- DOM：容器 `data-align`、`data-media-kind`；默认宽度 `min(66.67%, 可用行宽)`，通过 `width: 66.67%` + `max-width: 100%` 实现；video `width:100%` 填充容器。
- 尺寸调整：复用 ImageWidget 的 8 个 handle 与 `applyImageSize`（同一属性语法），范围 40–2000px；拖拽只改宽度（高度按比例）。
- 块手柄图标：`blockHandleIcon` 解析首行图片引用的扩展名，video/audio 分别返回 `VideoOutlined`/`AudioOutlined`（音频沿用现有图标），其余仍 `ImageOutlined`。

## D14 斜杠菜单

- `smart-input` 在 `input.type` 事务里把半角 `,` 与全角 `，` 归一为 `/` 仅在**词首**（前面是行首或空白）时发生；代码/链接/公式内不转换（protected ranges）。
- 归一后的 `/` 走既有 `insertSlashChar` 路径打开菜单；若菜单已开，`,` 作为查询字符不转换。
- 删字母回空查询：现有 `applyQuery("")` 返回全量列表，保留并加回归断言。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | D3 / CF-提示信息显示时长可配置 | — | 复用既有配置语义，不新增字段 |
| 存储 | src-tauri/src/config.rs | notice_duration | 字段与默认值不变 |
| 校验 | src-tauri/src/config.rs | validate_config | 沿用 0.1–10 秒范围校验 |
| 桥接 | src/hooks/useConfig.ts | config.noticeDuration | 原值透传到渲染层，不做二次换算 |
| 消费 | src/components/TooltipLayer.tsx | TIP_DELAY_MS | 移除常量，读配置并钳制 100–10000ms |
| 回滚 | snapshots/ | restore_config_snapshot | 无新字段；回滚沿用既有配置快照 |

## 测试策略

- 每条票至少一条 e2e 驱动真实链路；断言落在「计算样式 / 文本严格相等 / 状态往返」。
- ui-surface 票产出 `.artifacts/<票号>/state-coverage.json`（≥4 态）。
- 可取消交互统一做「打开 → 取消 → 无残留」。
