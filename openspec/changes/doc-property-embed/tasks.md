# Tasks

## 1. 嵌入实现

- [ ] 1.1 **编辑态：属性块迁入正文流首块**
  - 新增 CM6 块级 widget（`src/editors/decorations/docPropertyEmbed.ts`）：位于文档 pos 0、`block: true`、`ignoreEvent` 放行 React 交互；widget 提供 DOM 宿主，`ContentArea` 通过 portal 渲染 `DocPropertyBar`
  - 删除滚动容器外的固定宿主（`doc-property-host`），源码态仍不渲染
  - 折叠/展开、A/B 切换、字段编辑后高度变化触发 CM6 重测，滚动位置不跳
  - 验收：编辑态滚动正文时属性块随内容移出视口；点块内控件不被 CM6 抢焦点

- [ ] 1.2 **预览态：属性块渲染在预览流顶部**
  - `PreviewView` 之前渲染同一 `DocPropertyBar`（只读），宽度 `--type-measure` 居中
  - 验收：预览态块位于正文标题之前、随预览滚动；只读

- [ ] 1.3 **宽度与视觉收口**
  - 嵌入容器宽度对齐 `--type-measure`、圆角卡片、分割线与既有 A/B 两态一致
  - 验收：编辑/预览两态块宽与正文段落等宽；B 模式双列在窄窗不溢出

## 2. 验证与交付

- [ ] 2.1 **回归与全量验证**
  - 新增/更新 e2e：编辑态首块与滚动、预览态顺序、源码态不渲染、A/B 两态、`⌘⇧Y` 隐藏恢复
  - `npx tsc --noEmit` + 相关 e2e + `bash scripts/verify.sh` 全绿
  - `.artifacts/<票号>/state-coverage.json`（≥4 态）
