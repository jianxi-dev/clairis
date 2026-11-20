# Tasks

## 1. 嵌入实现

- [x] 1.1 **编辑态：属性块迁入正文流首块**
  - 新增 CM6 块级 widget（`src/editors/decorations/docPropertyEmbed.ts`）：位于文档 pos 0、`block: true`、`ignoreEvent` 放行 React 交互；widget 提供 DOM 宿主，`ContentArea` 通过 portal 渲染 `DocPropertyBar`
  - 删除滚动容器外的固定宿主（`doc-property-host`），源码态仍不渲染
  - 折叠/展开、A/B 切换、字段编辑后高度变化触发 CM6 重测，滚动位置不跳
  - 验收：编辑态滚动正文时属性块随内容移出视口；点块内控件不被 CM6 抢焦点

- [x] 1.2 **预览态：属性块渲染在预览流顶部**
  - `PreviewView` 之前渲染同一 `DocPropertyBar`（只读），宽度 `--type-measure` 居中
  - 验收：预览态块位于正文标题之前、随预览滚动；只读

- [x] 1.3 **宽度与视觉收口**
  - 嵌入容器宽度对齐 `--type-measure`、圆角卡片、分割线与既有 A/B 两态一致
  - 验收：编辑/预览两态块宽与正文段落等宽；B 模式双列在窄窗不溢出

## 2. 验证与交付

- [ ] 2.1 **回归与全量验证**
  - 新增/更新 e2e：编辑态首块与滚动、预览态顺序、源码态不渲染、A/B 两态、`⌘⇧Y` 隐藏恢复
  - `npx tsc --noEmit` + 相关 e2e + `bash scripts/verify.sh` 全绿
  - `.artifacts/<票号>/state-coverage.json`（≥4 态）

## 阻塞记录（2026-11-20）

`1.1` 曾以「CM6 块级 widget + React portal」实现并合并（#1215/#1220），随后在
`verify.sh` 的 e2e 全量回归中发现**根因级阻塞**并回退：

- **现象**：属性块作为块 widget 插入文档位置 0 后，`view.posAtCoords` 整体下移
  一个「属性块高度」（实测文档无 frontmatter 时 103px）。指针悬停第一段会映射到
  下一段（`pos=8` 而非 `pos≈1`），块手柄召唤错误、点击落点也随之下移。
- **已排除**：`requestMeasure`、空 `dispatch({})`、`ResizeObserver` 重测、
  `estimatedHeight` 估计、`ignoreMutation` 开关——均不改变偏移量，说明 CM6 的
  坐标映射未把「插入型块 widget」的高度计入该行块。
- **影响面**：`block-handle` / `block-decorations` 共 11 例失败；点击落错行属用户可感缺陷。
- **回退**：#1221 复原 `ContentArea`/`DocPropertyBar`/`docPropertyEmbed`/e2e 与
  `.artifacts/1215`，主分支恢复全绿。本 change 保留在 `openspec/changes/`，待方案确定。

**待定方案**（G0 需重开决策）：
1. 复用既有「frontmatter 隐藏 replace 装饰」承载属性块（replace 型块 widget 的
   高度进高度图，math/mermaid 已验证），无 frontmatter 文档退回固定宿主；
2. 或改用 CM6 `blockWrappers` / 自定义 `BlockInfo` 显式登记块高；
3. 或评估 VuePress/Vditor 式「编辑器外滚动区 + CM 高度自适应」的代价。
