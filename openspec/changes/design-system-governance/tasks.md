# Tasks: 设计系统治理

## 1. 规范与台账

- [x] 1.1 新建 `docs/design/system/spec.md`（accepted · canonical）：图标、间距、字号、圆角阴影、三主题语义色、L3 判据。验收：每个数值可追溯到实测频次或既有裁决，页脚给出复现命令。
- [x] 1.2 新建 `docs/design/system/decisions.md`（accepted · canonical · `ledger: append-only`），首版 15 行真实裁决。验收：每行四列齐全，已落地行带 PR 号。
- [x] 1.3 收编旧稿：icon-system-v2、icon-system-v3 QA、颜色空壳稿标 superseded + redirect。验收：三份文件均指向 spec，且内容已被吸收。

## 2. 治理条款

- [x] 2.1 `GOVERNANCE.md` §2.3 增 append-only 台账例外（含路径/状态绑定、纯追加、取代行号、不适用 archived、合并前边界）。验收：条款可被 diff 直接判定。
- [x] 2.2 `GOVERNANCE.md` §3.2 登记 `ledger` 与 `redirect` 字段。验收：字段语义与检查器行为一致。
- [x] 2.3 `GOVERNANCE.md` §5.1 增「具体性优先」「矛盾即缺陷」解释条款；收敛 §2.3 与 §6.1 关于 accepted 可否原地更新的矛盾；§6.3 补 superseded 归档要求。验收：三处不再互相否定。

## 3. 接线

- [x] 3.1 `AGENTS.md` 增设计系统路由与三条约定（数值只定义一次、票面视觉锚点、单点裁决落台账）。验收：路由指向 `docs/design/system/`。
- [x] 3.2 `docs/agents/defect-workflow.md` 增「非功能视觉缺陷」：三要素票面、复用 `ui-surface`、与 DQ-7 阈值对齐。验收：30 天 2 票与 ≥3 票两条规则不冲突。
- [x] 3.3 新建 `docs/agents/ui-feedback.md` 四要素模板 + 模糊反馈先给候选终态。验收：示例不复制 spec 数值。

## 4. 验证

- [x] 4.1 三轮评审（Codex 对抗轮 + 架构师两轮）与两批修复。验收：15 条必改逐项 PASS 或已记录分歧。
- [x] 4.2 `node scripts/docs-governance-check.mjs --root` 复核。验收：本 change 触及文件 0 新增违例。

## 后续（不在本 change）

- C9 视觉锚点机检（`cw-tickets-check.sh`）。
- `tokens.css` 扩容（`--space-*` / `--fs-*` / `--radius-*`）与存量迁移。
- e2e 断言锚定 spec 条款（如 `ai-forms.spec.ts` 的尺寸断言）。
- spec ↔ `tokens.css` 漂移的 CI 检查。
