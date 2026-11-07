# Tasks: 拖拽移动与区域截图（H4）

## 1. 纯函数

- [x] 1.1 `src/editors/html/edit.ts` 增 `applyNodeMove(content, nodeId, targetId, position)`：`before`/`after` 兄弟插入；目标是自己或自己的后代时返回原 content
- [x] 1.2 新增 `src/editors/html/capture.ts`：`buildCaptureParts(content)` 提取内联样式与 body 内容；`buildCaptureSvg(parts, region, bodyStyle)` 组装裁剪用的 SVG
- [x] 1.3 单测：移动换位、拒绝自嵌套、移动后无编辑期痕迹；SVG 裁剪窗口与偏移正确

## 2. 桥与运行时

- [x] 2.1 `bridge.ts`：新增 `moveNode`、`captureRegion` 消息与 `captureMode` 命令，全部在 `parseBridgeMessage` 收口
- [x] 2.2 `runtime.ts`：拖拽（4px 阈值、指示线、落点 before/after、非法目标不显示）
- [x] 2.3 `runtime.ts`：截图模式（进入后禁用点选/编辑，拖出选框，上报区域 + body 计算样式）

## 3. 组件接线

- [x] 3.1 `HtmlEditToolbar` 增「截图」按钮 → `onCapture()`
- [x] 3.2 `HtmlVisualEditor`：接 `moveNode` → `applyNodeMove`（清选中）；接 `captureRegion` → 生成 PNG 并 `save_binary_as_file`

## 4. 验收

- [x] 4.1 单测全绿
- [x] 4.2 e2e：拖拽把第二段拖到第一段前，渲染与 content 同步；截图产出 PNG 签名
- [x] 4.3 `npx tsc --noEmit` + `npx eslint src/` + CSS manifest

## 5. 收尾

- [x] 5.1 delta 规格（E-20 / E-21）
- [x] 5.2 `docs/architecture/overview.md` 补两项能力
- [ ] 5.3 归档时执行（合并后）：`openspec archive` 合并 E-20/E-21 进主规格 + `docs/delivery/requirements-status.md` 登记
