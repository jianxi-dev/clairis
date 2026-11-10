# 已批准设计（design/approved）

## 职责

存放**已批准、当前生效**的设计成果：界面设计、交互流程、设计体系落地说明。这是"设计体验"类任务的首选入口。

## 不放在这里

- 探索中的草图、比稿、未定案版本 → `docs/design/explorations/`
- 可验收的功能行为定义 → `openspec/specs/`（设计稿是 supporting，不是 requirement）
- 已废弃或被取代的旧设计 → `docs/archive/YYYY/`

## 进入条件

- 设计已获批准（status 为 `accepted` 或 `implemented`）。
- 探索稿在定案前不得直接进入本目录。
- 新增文档须带 frontmatter（`title` / `type: design` / `status` / `last_updated`），规范见 `../../GOVERNANCE.md`。

## 当前状态：10 个已批准 feature

**截至 2026-11-01，本目录包含 10 个已批准设计。**

| Feature | 批准设计 | 行为规格（canonical） | 需求编号 |
| --- | --- | --- | --- |
| 沉浸阅读 | [immersive-reading/spec.md](./immersive-reading/spec.md) | `openspec/specs/reading/spec.md` | A-5 |
| 字号缩放 | [font-size-scaling/spec.md](./font-size-scaling/spec.md) | `openspec/specs/reading/spec.md` | A-6 |
| 阅读进度 | [reading-progress/spec.md](./reading-progress/spec.md) | `openspec/specs/reading/spec.md` | A-9 |
| 空状态 | [empty-state/spec.md](./empty-state/spec.md) | `openspec/specs/application-shell/spec.md` | B-1/B-2/B-4/B-5 |
| 无侧栏导航 | [navigation/spec.md](./navigation/spec.md) | `openspec/specs/navigation/spec.md` | B-3/B-6/B-7/B-8 |
| 大纲 + Quick Capture | [outline-quick-capture/spec.md](./outline-quick-capture/spec.md) | `openspec/specs/capture/spec.md` | D-1..D-14 |
| 界面布局 | [shell-ui/spec.md](./shell-ui/spec.md) | `openspec/specs/application-shell/spec.md` | G-1..G-5 |
| 阅读排版 | [reader-typography/spec.md](./reader-typography/spec.md) | 阅读排版设计系统（实现见 `src/styles/tokens.css`、`src/styles/reader.css`、`src/renderers/`） | — |
| 视频播放器增强 | [video-player/spec.md](./video-player/spec.md) | 待同步 `openspec/specs/`（实施中） | — |
| 门户与布局 | [layout-portal/spec.md](./layout-portal/spec.md) | `openspec/specs/navigation/spec.md` | 布局规格 v1.0（12 条验收） |

批准依据：`docs/MVP-需求跟踪表.md`「已落地为」列明确引用。行为规格的真相源始终是 `openspec/specs/`。

## 实现落点偏离（勘误索引）

已批准设计稿受治理 §2.3 保护（`accepted` 不可原地改写），实现期与设计稿不一致的落点在此登记，裁定以更高层为准：

| 设计稿条目 | 设计稿写法 | 实际落点 | 裁定依据 |
| --- | --- | --- | --- |
| [layout-portal/spec.md](./layout-portal/spec.md) §13 / D11 | `$APPCONFIG/user/views/rail.json` / `grid.json` / `preview.json` + 布局树文件 | `user/settings.json` 的 `railViewSpec` / `previewSettings` / `aiViewSpec` / `paneLayout` 四字段；**三个 views 文件从未实现** | [ADR 0011](../../architecture/decisions/0011-scenario-shell-and-pane-tree.md)（第 3 层）与 [overview §7](../../architecture/overview.md) 覆盖第 4 层设计稿；勘误记录见 `docs/research/technical/data-fileization-omarchy-inventory.md`（2026-11-10） |

## 权威级别

已批准设计在权威优先级矩阵中位于第 4 层。**creative / 设计表现内容不得自动升级为 canonical requirement**；功能行为的真相源始终是 `openspec/specs/`。
