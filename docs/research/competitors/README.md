# 竞品分析（research/competitors）

## 职责

存放竞品功能、定位、体验的对比分析（如与 Obsidian、Typora、Bear、Ulysses 等的对比）。用于理解市场与借鉴方向。

## 进入条件

- 内容为竞品/市场调研结论，非本产品的设计决定。
- 调研得出的、已被采纳的设计结论应迁入 `../../design/approved/`，本目录保留分析过程。
- 新增文档须带 frontmatter（`title` / `type: research` / `status` / `last_updated`），规范见 `../../GOVERNANCE.md`。

## 已迁入文档（任务 9.5 完成迁入）

以下 3 个竞品研究文档已由治理任务 9.5 从 docs/ 根迁入本子域（MIGRATION-MAP 对应行 action 已由「待定（未裁定）」变更为 `move`，target 即本目录；正文哈希与 frontmatter 已在任务 9.5 校验）。

| 文件 | 位置 | 状态 | frontmatter |
| --- | --- | --- | --- |
| [fanbox-analysis.md](./fanbox-analysis.md) | `docs/research/competitors/fanbox-analysis.md` | 已迁入（任务9.5） | type=research, source_of_truth=historical, status=draft |
| [渐晰-vs-Obsidian-竞品深度分析.md](./渐晰-vs-Obsidian-竞品深度分析.md) | `docs/research/competitors/渐晰-vs-Obsidian-竞品深度分析.md` | 已迁入（任务9.5） | type=research, source_of_truth=historical, status=draft |
| [渐晰-vs-Typora-Bear-Ulysses-四象限对比.md](./渐晰-vs-Typora-Bear-Ulysses-四象限对比.md) | `docs/research/competitors/渐晰-vs-Typora-Bear-Ulysses-四象限对比.md` | 已迁入（任务9.5） | type=research, source_of_truth=historical, status=draft |

原 docs/ 根位置（`docs/fanbox-analysis.md`、`docs/渐晰-vs-Obsidian-竞品深度分析.md`、`docs/渐晰-vs-Typora-Bear-Ulysses-四象限对比.md`）已不存在；任何指向旧位置的链接应更新为本目录新位置。

## Quiet.md 逆向学习（2026-11-22）

Quiet.md（s1dashu/quiet-md，MIT，Rust + GPUI）源码级逆向侦察，对应 15 项需求诊断。入口为总报告，6 份域报告 + 总览在其 `quiet-md/` 子目录：

| 文件 | 内容 |
| [quiet-md-逆向学习总报告.md](./quiet-md-逆向学习总报告.md) | 15 项逐项裁定 + 全局病灶 TOP5 + P0/P1/P2 行动路线 + 交互参数速查 |
| [quiet-md/00-overview.md](./quiet-md/00-overview.md) | 架构 / 存储（DocxXML）/ undo / 可靠性总览 |
| [quiet-md/editor-core.md](./quiet-md/editor-core.md) | 手柄 / 输入管线 / undo 快照 / 版本历史（需求 ①②③） |
| [quiet-md/layout-lists.md](./quiet-md/layout-lists.md) | 分栏 / 列表嵌套（需求 ④⑩） |
| [quiet-md/tables.md](./quiet-md/tables.md) | 表格全系统（需求 ⑥） |
| [quiet-md/media-board.md](./quiet-md/media-board.md) | 高亮 / 嵌入文件 / 图片裁剪 / 画板（需求 ⑤⑦⑨⑪） |
| [quiet-md/widgets-refs-math.md](./quiet-md/widgets-refs-math.md) | 引用/反链 / 倒计时提醒 / 公式（需求 ⑧⑫⑬） |
| [quiet-md/home-theme-menu.md](./quiet-md/home-theme-menu.md) | 首页宫格 / 主题 / 菜单（需求 ⑭⑮） |

## 权威级别

属于第 6 层 research / history，**默认不参与实现裁定**，仅用于背景调查。
