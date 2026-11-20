# 设计：文档属性块嵌入正文流

## 结论

编辑态用 **CodeMirror 块级 widget（pos 0）+ React portal** 承载属性块；预览态在 `PreviewView` 之前渲染同一组件。**不采用**「让外层容器滚动、禁用 CM6 内部滚动」方案：那会让 CM6 视口等于全文高度，长文档失去虚拟化（仓库已有大文件场景）。

## 现状

- `ContentArea` 在 `content-scroll` **之外**渲染 `doc-property-host`（`flex: 0 0 auto`），所以不随正文滚动。
- 编辑态：CM6 宿主 `height: 100%`，CM6 自己滚动（`.cm-scroller`）。
- 预览态：`PreviewView` 在 `content-scroll` 内，随外层滚动。

## 方案

### 编辑态

1. `src/editors/decorations/docPropertyEmbed.ts`
   - `DocPropertyEmbedWidget extends WidgetType`：`toDOM()` 返回 `<div class="cm-doc-property-embed">`；`ignoreEvent(event)` 返回 `true`（面板内点击/输入归 React，不进 CM6 事务）；`eq()` 恒 `false`（内部状态由 React 管理，widget 不缓存内容）。
   - `docPropertyEmbedDecoration()` 生成 `Decoration.widget({ widget, block: true, side: -1 }).range(0)`，仅在「markdown + 编辑态 + 面板可见」时启用。
   - widget 生命周期通过模块级回调池把 DOM 宿主交给 React：`setEmbedHost(el | null)`；`destroy()` 时若宿主相同则清空。
2. `ContentArea`
   - `const [embedHost, setEmbedHost] = useState<HTMLElement | null>(null)`；注册回调；`embedHost && createPortal(<DocPropertyBar embedded … />, embedHost)`。
   - `decorationsForMode` 增加属性块开关；折叠态仍渲染同一组件（内部折叠渲染摘要），保证「折叠摘要」场景不丢。
   - 移除 `doc-property-host` 外层固定宿主。
3. 高度变化：CM6 对 content DOM 有 ResizeObserver；属性块展开/收起、A/B 切换后调用 `view.requestMeasure()`（复用既有 `cmVisible` 测量路径），并保留滚动锚定（widget 在首部，高度变化发生在视口上方时 CM6 默认锚定行为成立；e2e 覆盖滚动不跳）。

### 预览态

- 在 `content-scroll` 内、`PreviewView` 之前渲染 `<div class="doc-property-embed-preview">`，宽度取 `var(--type-measure)` 居中；`mode="preview"` 走既有只读分支。

### 源码态

- 不渲染（`editorMode === "source"` 直接跳过），与 P-1 一致。

## 与既有条款的关系

- P-1：本 change 修订落位口径（正文流首块），frontmatter 隐藏装饰不变（编辑态隐藏 `--- … ---`，块的 widget 位于其前）。
- P-10 / §7：沿用既有 A/B 视觉锚点与卡片/分割线 tokens，不新增像素值。
- P-9：写回链路不动（组件仍以 `content` + `updateTabContent` 工作）。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§7 | — | 块宽度取 `--type-measure`，圆角/分割线沿用既有条款，不新增像素值 |
| 存储 | src/lib/frontmatter.ts | FRONTMATTER_RE | 属性仍以 frontmatter 原文为唯一真相源，嵌入只改呈现位置 |
| 校验 | src/lib/frontmatter.ts | validateFieldValue | 嵌入态与既有面板走同一校验路径，非法值仍被拒 |
| 桥接 | src/editors/decorations/docPropertyEmbed.ts | docPropertyEmbedDecoration | 仅编辑态+面板可见时启用块 widget；源码态不启用 |
| 消费 | src/components/Content/DocPropertyBar.tsx | DocPropertyBar | 编辑/预览同一组件实例渲染，位置由宿主决定，不复制逻辑 |
| 回滚 | src/components/Content/ContentArea.tsx | DocPropertyBar | `⌘⇧Y` 隐藏面板即回到无块渲染；代码级回退 = revert 该 PR |

## 风险与回退

- **风险 1**：portal 宿主在 widget 重建时丢失 → 用「回调注册 + state」双保险，widget `destroy` 清空宿主，React 重渲染重新 portal。
- **风险 2**：块内输入被 CM6 拦截 → `ignoreEvent` 返回 true，且块内 `stopPropagation` 由 React 处理。
- **回退**：保留 `embedded` 开关，出问题可切回「固定宿主」渲染（组件接口不变）。

## 测试

- e2e：`doc-property-embed.spec.ts`——编辑态块在正文首块（`.cm-content` 首个块级子节点）、滚动后块移出视口、预览态块在标题之前、源码态无块、A/B 切换后块宽不变、`⌘⇧Y` 隐藏恢复。
- 回归：既有 `doc-property-panel.spec.ts`（90 例）与 `frontmatter-*` 全绿。

## 方案修订（2026-11-20，G0 重开）

**A 案（插入型块 widget）已实证不可行并被回退**（#1221）：块 widget 插在 pos 0 后，
CM6 的 `posAtCoords` 不把其高度计入该行块，指针/点击整体下移一个块高，块手柄与
光标落点错行。`requestMeasure` / 空 dispatch / ResizeObserver / estimatedHeight /
ignoreMutation 均无效。

**采纳方案 1：replace 型块 widget 承载属性块（仅限含 frontmatter 的文档）**

- 既有 `frontmatterHide` 装饰已在编辑态把 `--- … ---` 整块 `replace` 掉（展开态）
  或替换为一行摘要（折叠态）。把该 replace 的 widget 换成属性块 UI 宿主：
  replace 型块 widget 的高度由 CM6 正常测量并计入高度图（math / mermaid 已长期验证）。
- 无 frontmatter 的文档：属性块维持「内容区上方固定宿主」的现有渲染（不引入新回归）；
  用户在该面板添加首个字段后 frontmatter 生成，随即变为嵌入形态。
- 折叠态：replace 为一行摘要（现状），不渲染完整面板——与 P-1「折叠态一行摘要」一致。
- 预览态：维持本 change 已实现的「预览内容流顶部」块（不涉及 CM6 坐标）。
- 源码态：不渲染。

**验收门槛（必须由测试证明）**：
1. 含 frontmatter 文档：悬停正文第一段，`block-handle[data-block-from]` 指向正文首块
   （不是下一段），且手柄可见——即 `posAtCoords` 不再偏移；
2. `e2e/block-handle.spec.ts`、`e2e/block-decorations.spec.ts`、`e2e/doc-property-panel.spec.ts`
   全绿；
3. 折叠/展开、A/B 切换后高度重测正确（滚动不跳）。
