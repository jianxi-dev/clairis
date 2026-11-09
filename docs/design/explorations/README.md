# 设计探索（design/explorations）

## 职责

存放**未定案的设计探索**：草图、比稿、多个备选方案、批判与迭代记录。这里的材料用于历史调查与设计回溯，**不是实现依据**。

## 不放在这里

- 已批准、当前生效的设计 → `docs/design/approved/`
- 可验收的功能行为 → `openspec/specs/`

## 进入条件

- 内容属于探索/实验性质，尚未批准或已被取代。
- 探索结论一旦定案，应将定案版本迁入 `../approved/`，本目录保留探索过程作为历史。

## 已建档的探索组（20 个 feature）

截至 2026-08-01，`docs/designs/` 的全部文件已迁入本目录（53 个文件），按 feature 分组建档；另收纳根级 HTML 原型两批（`ui-html/`、`landing/`，共 5 个文件）。

| Feature | 探索 README | 文件数 | 当前权威位置 |
| --- | --- | --- | --- |
| Capture Overlay 探索 | [capture-overlay/](./capture-overlay/README.md) | 10 | `openspec/specs/capture/spec.md` |
| 无侧栏布局探索 | [no-sidebar/](./no-sidebar/README.md) | 8 | `approved/navigation/` |
| 沉浸阅读 r1 | [immersive-reading/](./immersive-reading/README.md) | 1 | `approved/immersive-reading/` |
| 字号缩放 r1 | [font-size-scaling/](./font-size-scaling/README.md) | 1 | `approved/font-size-scaling/` |
| 阅读进度 r1 | [reading-progress/](./reading-progress/README.md) | 1 | `approved/reading-progress/` |
| 空状态 creative | [empty-state/](./empty-state/README.md) | 1 | `approved/empty-state/` |
| 大纲 + QC 探索 | [outline/](./outline/README.md) | 3 | `approved/outline-quick-capture/` |
| 预览排版探索 | [reader-typography/](./reader-typography/README.md) | 1 | `approved/reader-typography/` |
| 主题系统 | [theme/](./theme/README.md) | 4 | 纯探索 |
| 视觉原型 | [prototypes/](./prototypes/README.md) | 11 | 纯探索 |
| 设计概念 | [design-codex/](./design-codex/README.md) | 3 | 纯探索 |
| Folio 突破 | [folio-breakthrough/](./folio-breakthrough/README.md) | 4 | 纯探索 |
| 墨桌 | [ink-desk/](./ink-desk/README.md) | 1 | 纯探索 |
| 墨河 | [ink-river/](./ink-river/README.md) | 1 | 纯探索 |
| 渐明 NextGen | [jianming-nextgen/](./jianming-nextgen/README.md) | 2 | 纯探索 |
| 书桌概念 | [the-desk/](./the-desk/README.md) | 1 | 纯探索 |
| 三栏布局 | [three-column/](./three-column/README.md) | 1 | `approved/shell-ui/` |
| UI 设计哲学 | [ui-philosophy/](./ui-philosophy/README.md) | 1 | 纯探索 |
| UI HTML 探索 | [ui-html/](./ui-html/) | 4 | 纯探索 |
| 落地页原型 | [landing/](./landing/) | 1 | 纯探索 |
| 选区轮盘（已定案） | [selection-roulette/](./selection-roulette/README.md) | 1 | `approved/selection-roulette/` |

## 权威级别（重要）

explorations **默认不参与实现裁定**。在权威优先级矩阵中它属于第 6 层（research / history）的一部分：实现冲突时只能引用高层真相源，不得用本目录的草案覆盖 canonical spec、ADR 或已批准设计。仅用于"当时为什么这么探索"的历史调查。
