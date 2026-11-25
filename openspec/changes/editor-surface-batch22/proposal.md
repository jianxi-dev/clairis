## Why

用户 2026-11-26 反馈 22 条，对账表 `.artifacts/triage-input-alignment-2026-11-26.md` 逐条与代码核实后，**本批只有 15 条有效**（#1–#15）；#16 与 #17–#22 已由用户明确取消（#16 判定已修复，#20 大文件崩溃本轮不做、风险另开票，#22 不处置 batch20）。

15 条的共性是：**功能骨架大多已在，做错的是四处**——色板、图标、转换落点、触发方式；其余是既有 requirement 已登记但未真正生效（编辑/预览同貌、字体选择器、模式切换回顶、源码模式对勾、导出菜单方向、悬浮窗图标），或明确的缺陷（空高亮块塌陷、视频黑屏）。因此本批验收口径两条：**把已登记 contract 真正落到可见行为**，以及**把做错的四处按 quiet / 豆包源码级参照修正**。

> 状态：**草稿**。本 change 只产出规划制品，不拆票、不实施、不建 issue、不改 `src/`。

## What Changes

### 高亮块（对账 #4 #5 #6）

- **色板换源（#5 核心）**：高亮面板改为豆包像素核准的三组——字体 8 格 / 边框 8 格 / 填充 2×8 格（深档 + 中档），**严格 8 列不换行**；高亮/标注**专用 24 格色板，独立于 `mdb-bg-*` 文字背景板**；旧色名（darkred/brown/olive/darkgreen/navy/indigo/slate…）在 `parseCalloutAttrs` 保留兼容映射。
- **触发方式**：块上方居中调色板图标改为**鼠标滑入即展开**（不需点击）；面板只由点外部 / Esc 关闭；「随机」只同时切边框+填充且同色相（文字色不变），**点击随机不关闭面板**；「恢复默认」同不关闭。
- **空态高度（#4）**：空 `> [!highlight]` 不得塌陷成细条；单行内容高度约 3.2em、空块 `min-height ≥ 44px` 且可点入输入；左侧 emoji、无类型名标题栏、1px 全边框 + 圆角 + 填充。
- **转换落点（#6）**：`CALLOUT_MARK_ITEM` 补 `calloutKind: "highlight"`，转换菜单「高亮」直落 `> [!highlight]`（当前回落 `[!NOTE]`）。

### 图片裁剪（对账 #1 #2 #3）

- **裁剪交互改 quiet 式（#1）**：裁剪态显示**整图 + 框外压暗蒙层**；拖框 / 蒙层改选区；点「确定」才写回；二次进入显示整图 + 上次矩形（框内亮）。
- **工具条「重置图片」（#2）**：清除 crop 并按原分数还原显示尺寸回整图；仅已有 crop 时出现。
- **放大层工具条对齐（#3）**：在现有 4 按钮（旋转 / 下载 / 恢复原始尺寸 / 关闭）基础上补「重置图片」，与工具条按钮语义一致。

### 嵌入文件与链接（对账 #8 #15）

- **嵌入文件三视图（#15）**：`embed`（文本）/ `card`（卡片）/ `preview`（预览）；工具条三图标（列表 / 卡片 / 图片）切换；文本视图滑入显示工具条、点击打开；卡片 / 预览单击显示工具条、再点文件名打开；预览先选中再点打开。修掉头部 click 被 `openInNewTab` 劫持导致「单击就打开、无法切换」。
- **链接文件（#8）**：文档内本地文档链接点击 = 打开；⌘/Ctrl + 悬停 = 显示文件卡片式悬浮窗（复用 `openPreview` / `FloatingPreview`）。

### 其他缺陷与既有条款生效（对账 #7 #9 #10 #11 #12 #13 #14）

- **视频首帧（#7）**：未播放的视频块显示首帧 poster，不黑屏（补 spec 条款）。
- **导出子菜单方向（#9）**：默认右开，触右边界翻左。
- **格式对齐整体校准（#10）**：编辑态 `.cm-table-wrap` 补 `max-width`（不得超正文纸宽）；有序 `.cm-list-marker` 补与无序一致的负边距；引用块编辑态与预览态左右缘一致；代码块纵向内边距与预览统一。
- **字体选择器（#11）**：显示值与搜索词分离（聚焦时用已选字体名当过滤词，只剩一项）；点击展开全量、输入才过滤、删除字符恢复候选、键盘导航、点外部关闭。
- **模式切换保持位置（#12）**：edit / preview / source 切换保留滚动位置（行锚点映射），不滚回顶部。
- **源码模式选中态（#13）**：按钮显示对勾 ✓ 表示选中，再点取消回编辑。
- **文件卡片悬浮窗图标（#14）**：`FloatingPreview` 的编辑 / 预览图标与页签文件卡一致（当前 `editing ? "eye" : "pencil"` 相反）。

## Capabilities

### New Capabilities

- 无新增能力域。本批全部是对既有 capability 的 requirement 修正或补充。

### Modified Capabilities

- `editing`：E-48 高亮块三色（色板换源 / 空态高度 / 触发方式 / 转换落点）；E-44 图片裁剪坐标系与保存可靠性 + E-39 图片内联裁剪（整图 + 蒙层 / 重置入口）；E-24 图片块编辑（放大层工具条对齐）；E-8 编辑态与预览态同貌（表格 / 有序列表 / 引用块 / 代码块对齐）；E-1 源码模式（对勾选中态）；E-17 块手柄召唤区域与滑入菜单（hover 展开颜色面板）；E-34 视频块布局（首帧 poster）；内嵌文件三视图交互。
- `reading`：嵌入视频显示与播放（首帧 poster 条款）；内嵌文件渲染（三视图交互 + 链接文件点击打开 / 修饰键悬停浮窗）；A-9 阅读进度与位置恢复（模式切换不回顶）。
- `file-management`：导出菜单顺序与 PDF 导出（子菜单默认右开 + 边界翻转）。
- `configuration`：标题字体逐级配置（显示值与搜索词分离）。
- `application-shell`：悬浮小窗编辑态为富文本（预览 / 编辑图标一致）。

## Impact

- **前端编辑域**：`src/editors/orchestration/{color-palette,callout-color-panel,block-menu,block-convert,floating-toolbar}.ts`、`src/editors/{callout-types,callout-attrs,icons}.ts`、`src/editors/decorations/{callout,image,imageCrop,imageToolbar,fileEmbed,list,table,code}.ts`、`src/editors/decorations/index.ts`、`src/editors/block-model.ts`。
- **前端阅读 / 界面**：`src/renderers/markdown.ts`、`src/components/Content/{ContentArea,PreviewView,PaneTreeView}.tsx`、`src/components/Preview/FloatingPreview.tsx`、`src/components/HeadingFontField.tsx`、`src/components/TabBar.tsx`、`src/lib/paneHeaderMenu.ts`、`src/stores/index.ts`。
- **样式**：`src/styles/{editor,reader}.css`（新增 `cm-*` 类须同步 CSS manifest）。
- **测试**：`src/__tests__/**` 既有颜色面板 / 裁剪 / 字体用例需同步；新增 e2e（高亮面板 hover、裁剪蒙层、嵌入三态、链接浮窗、对齐、字体、源码对勾）。
- **无新增外部依赖**；无数据库迁移；无 Rust 后端改动。
- **BREAKING（内部契约）**：`CALLOUT_MARK_ITEM` 增加 `calloutKind` 字段；高亮色板 token 由暗色系改为豆包 8/8/2×8 三组，`mdb-bg-dark*` 系列在高亮面板不再使用（标注面板保留）。

## 开放问题（待用户裁决，tasks 按默认值规划）

- **O-1（#5 字体色数量）**：豆包像素核准为 8 格（无 + 灰红橙黄绿蓝紫），Clairis 现为 9 格（含「青」）。**默认**：高亮面板对齐 8 格，去「青」；标注面板保留 9 格。
- **O-2（#15 三视图样张）**：文本视图 / 预览视图缺一手样张（两张截图字节相同）。**默认**：按 `embed` / `card` / `preview` 三态映射规划；卡片宽度取 quiet 400px。
- **O-3（#10 对齐幅度）**：引用块右缘差为 `1080` vs `1080 + 2em + 2px`。**默认**：按既有条款 `editing:209/222` 收口到与预览一致。
- **O-4（#12 映射口径）**：行锚点映射 vs 纯 `scrollTop` 像素值。**默认**：行锚点映射（`PreviewView` innerHTML 重建会高度塌陷，像素值会被 WebKit 夹到 0）。
- **O-5（#9 翻转判据）**：触右边界翻左的阈值。**默认**：复用既有浮层裁剪逻辑（贴边翻转），不新写一套。
