# 设计：surface-refine-1120

## 1. 折叠态嵌入与多窗格宿主（P-1）

**现状割裂**：折叠时固定宿主渲染折叠条（滚动容器外）+ 正文渲染「文档属性 · N 个字段」虚线标签（fmh-summary widget），双轨显示。

**修订**：
- `embedActive` 放宽为 `markdown && edit && frontmatter && !hidden`（**不再要求 !collapsed**）；折叠态 portal 渲染 `DocPropertyBar`（collapsed 变体）进同一 widget 宿主 → 折叠条随正文滚动、位于正文首块。
- 编辑态固定宿主仅无 frontmatter 文档使用；`frontmatterHide` 的折叠分支（fmh-summary widget）**移除**——折叠呈现统一由嵌入宿主承载，正文 SHALL NOT 出现摘要标签。
- ⌘⇧Y 隐藏时装饰整体卸下，YAML 恢复（既有）。

**多窗格修复（缺陷 #D1 根因）**：`docPropertyEmbed.ts` 的 `hostListener`/`currentHost` 是模块级单槽——多窗格各自 effect 注册互相覆盖，widget 交接错窗格 → 一格 embedHost 为 null 不渲染。**改法**：删除模块级交接 API，`ContentArea` 在装饰重配 effect 后（rAF）查询**本窗格** `viewRef.current.dom` 内的 `.cm-dpb-embed` 设为宿主 state；ResizeObserver 逐窗格保留。widget 仅导出 `DPB_EMBED_CLASS` 与 widget 类。e2e：双窗格各开含 frontmatter 文档，两格 `[data-testid="dpb-a"]` 各渲染 1。

## 2. 间距与预览对齐（P-1）

- `.cm-dpb-embed { margin-bottom: <1 个正文行高> }`（布局间距，非文档空行——用户明确空行可被删除）；预览块 `.doc-property-embed-preview` 同步。
- 预览列对齐：预览块容器 padding-inline 与 `.preview-content` 列一致（读其 computed 样式取同源 padding/measure），卡片与段落同轴。

## 3. 拖拽插入位置（P-4 缺陷 #D4）

`computeDropIndex` 按行 rect 中点返回目标 index；onUp 先从 fields 剔除被拖行再插入——**下移时未按「已剔除的下方行数」回调 index**（典型 off-by-N），或 A 胶囊网格换行下落点计算失真。修法：插入索引统一「剔除后数组上的目标位」换算：`insertAt = over > fromIndex ? over - removedBelow : over`；e2e 断言拖到中位后 `data-row-id` 顺序。

## 4. 标题字段同步（缺陷 #D2）

`renameTab`（stores/index.ts:695）已有 title 字段同步，但用户路径未触发。排查方向：① 文件树/标签页重命名是否走 `renameTab` 还是旁路（`renameFile`/Tauri 侧）；② `parsed.fields.find(key==='title')` 在别称/类型注册表下是否漏识；③ 新建文档路径是否未建 title 字段导致永不同步。根因定位后修 + e2e（重命名页签 → 面板 title 字段值同步）。

## 5. 视频控制条按上下文显隐（batch20 C-6 协同）

`VideoPlayer` 增加 `embedded?: boolean`（`MediaPlayerHost` 按渲染上下文传入：MD 嵌入=true，独立页签=false）；`fullscreen` 与 `width` 两个控制条按钮仅 `embedded` 时注册；`applyWidthMode`/快捷键 F 行为不变（独立页签 F=窗口全屏保留？——**保留快捷键**，仅移除图标）。同步更新 video-controls.spec 中宽度菜单/全屏按钮用例为嵌入上下文断言；batch20 delta C-6 增补一句（不归档 batch20）。

## 6. 页签最大宽度（navigation + G-6 + §7.5）

- `tokens.css` 新增 `--tab-max-width: var(--tab-info-width)`；`TabBar` 页签 `flex: 0 1 auto` + `max-width: var(--tab-max-width)`；保底语义改 `min-width: min(var(--tab-min-width), max-content)`（短名不被撑到 96px；Chromium 支持 intrinsic 关键字入 min()）。尾部空白拖窗区（`--tab-strip-tail`）不变。
- e2e 更新：#1180 的「单页签铺满」类断言改为「内容宽 + 尾部空白」；新增短名/单页签两场景。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§7.5 | — | `--tab-max-width` 先落 §7.5 条款再使用；L/T 图形修订落 decisions 台账 |
| 存储 | src/stores/index.ts | renameTab | 页签重命名唯一写路径；标题字段同步在其内完成，SHALL NOT 旁路 |
| 校验 | src/lib/frontmatter.ts | setFrontmatterField | 标题同步经既有字段写回（类型注册表识别 title 键），非法键拒写 |
| 桥接 | src/components/Content/MediaPlayerHost.tsx | MediaPlayerHost | 上下文（独立/嵌入）由宿主注入，播放器不自行判断 |
| 消费 | src/components/Content/VideoPlayer.tsx | embedded | 控制条图标按 embedded 显隐；宽度档逻辑仅嵌入上下文可达 |
| 回滚 | src/components/Content/ContentArea.tsx | embedActive | 嵌入/宿主呈现由单一布尔门控；回退 = 恢复门控旧口径（revert PR） |
