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

## 权威级别

属于第 6 层 research / history，**默认不参与实现裁定**，仅用于背景调查。
