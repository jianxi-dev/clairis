## Context

layout-portal 已把场景外壳、pane 树、阅读空间、悬浮预览和设置骨架落地；本轮问题集中在「表面质量」与两个缺失能力（本机最近文件、本机检索）。现有约束不变：Tauri 2 + React 18 + CodeMirror 6；模式切换不 remount；pane 树持久化格式不动；API key 只进 keyring。

## Goals / Non-Goals

**Goals**
- 让主题、顶栏、页签、图标、阅读空间、预览、块手柄、设置与搜索在真实桌面窗口里一致可用。
- 两个缺失能力落成可验证的最小闭环：本机最近文件自动发现；本机标题+正文检索。
- 每个切片都能单独在页面上演示并有 e2e/截图证据。

**Non-Goals**
- 不重写 pane 树、场景路由、布局持久化。
- 不引入外部索引服务或云端全文搜索。
- 不改 AI 能力与模型调用协议。

## Decisions

### D1 主题：Tailwind `darkMode: "class"` + 语义 token 双轨

根因是 Tailwind 默认 `media` 暗色，应用只切 `<html class="dark">`，`dark:` 组件不跟随。改为 class 模式；同时把顶栏/设置/卡片里硬编码的 `gray-*`/`white` 换成 `--app-*` token，避免第二套主题源。

### D2 顶栏与页签：身份只留一处

顶栏收缩为产品入口（品牌、网格、AI、主题、沉浸）；文件名、预览/编辑/源码切换和分栏头状态全部由每个 pane 的 TabBar/PaneHeader 表达，消除同一状态两处渲染导致的错位。

### D3 阅读空间卡片：右列承载缩略图与动作

卡片改为左侧文本、右侧固定列（缩略图居中 + 动作按钮在缩略图下方）；无缩略图的卡片不保留右列宽度，动作绝对定位，摘要恢复通栏。HTML 缩略图改为中性占位，摘要统一走 `plainTextOf` 去标签。

### D4 悬浮预览：触发区 + 离窗关闭 + 真媒体

阅读空间只在条目右半区触发；预览打开后由全局 pointermove 检查“指针离开预览且不在触发栏”，180ms 防抖关闭；钉住/拖拽/缩放豁免。媒体按 fileKind 渲染 `img/video/audio`，PDF 暂保留占位。

### D5 块手柄与选区：左缘召唤、统一胶囊

块手柄的召唤判定以 `.cm-content` 左侧 25% 为界；手柄自身命中豁免。滑入手柄 60ms 开菜单。选区胶囊扩展为编辑器与 `.preview-content` 两种来源，阅读态只做复制/解释/翻译，编辑态保留改写/润色。

### D6 本机文件：Rust 扫描命令，前端只消费

新增 `list_recent_documents` 与 `search_documents` 两个 Tauri command：扫描 `$HOME/Documents`、`Desktop`、`Downloads` 与当前工作目录，限制扩展名与深度/数量；返回 path/title/mtime/excerpt。搜索在 Rust 侧做大小写不敏感子串匹配，结果限量返回。前端合并到现有 `recentFiles`/rail 搜索，不改变持久化字段。

### D7 设置：单一入口与可滚动容器

移除 `ReaderSettingsPopover`；设置“阅读空间”区补行宽/配色；设置根容器 `min-h-0 overflow-hidden`，内容区 `overflow-y-auto`，导航独立滚动。

## Risks / Trade-offs

- 本机扫描涉及用户目录：限制目录、扩展名、深度与结果数；不写回配置，不上传。
- 全文检索在大目录上可能慢：Rust 侧限 5,000 文件/20 结果，超时返回部分结果并标注。
- e2e 对顶栏/页签耦合较深：T1 先更新 nav/e2e helper，再改组件。
- 块手柄左缘 25% 是可用性取舍：窄窗口下可能只剩很少可召唤区域，用“手柄自身”豁免兜底。

## Migration Plan

1. T1 外壳与主题；T2/T3 阅读空间与预览；T4/T5 编辑与选区；T6 设置；T7/T8 搜索。
2. 每票从 `origin/main` 建分支，独立 PR；后端命令与前端接线在同票完成。
3. G4 合并后 `openspec archive`，更新 requirements-status。

## Open Questions

- 本机检索是否需要在首版支持 PDF/HTML 正文？首版仅 Markdown/文本/HTML 去标签；PDF/媒体不索引。
- 块颜色能力迁移的具体交互（色板位置/持久化格式）以 md-bundle 现有实现为准，若仓库内无对应源码则先落色板 UI 与 `mdb-color-*` 包裹，留 follow-up。
