## Why

交付品质是当前首要问题（维护者 2026-11-27 裁定）。实测缺口：组件层裸色值 **426 处**无门禁；`tokens.css` **99 处声明 / 55 个唯一变量名**无类型镜像与对账；暗色主题 `--app-accent` 实底上的白字仅 **2.98:1**（日期选中格、布尔开关、开关上是文字，低于非文本 3:1 与正文 4.5:1 两道线）；`window.prompt` 仍有 **3 处**原生阻塞对话框；交互规则只存在于评审口头经验，无条款、无守护；UI 交付以「编译通过」结案，PR 模板无视觉证据要求。

B1 是后续所有 UI 改动的闸门。先立规再动工，避免 B2–B7 边做边返工。

## What Changes

- **token 门禁（Q0）**：新增 `src/styles/tokens.ts`（与 `tokens.css` 一一对应的类型化常量表）、`scripts/check-tokens.mjs`（A 组件层裸色值只减不增 / B token 双向对账 / C 语义色 WCAG 对比度）、`scripts/token-baseline.json`；接入 `verify.sh` 3c、pre-commit（只跑 A，<1s）、CI。补 `--app-on-accent` token 并修暗色实底文字对比度。
- **交互条款（Q1）**：新建 `docs/design/system/interaction.md` 四条——零横线 / 反馈三档 / 禁用而非隐藏 / Esc 只退场——每条带定义、正反例、守护指针；`spec.md` §8 从「不做交互规范」supersede 为「交互条款见 interaction.md」。
- **交付验收模板（Q4）**：新建 `docs/delivery/ui-verification-template.md` 要求三件证据（明暗 × 宽窄截图、可复现步骤、计算样式断言），并接入 PR 模板与 G3 交付对账。

## Capabilities

### New Capabilities

- `ui-quality`：UI 品质门禁——token 对账与对比度、四条交互条款、UI 交付三件证据。

### Modified Capabilities

- 无。主规格在 G4 合并后由 `/opsx-sync` 同步；本 change 只带 `specs/ui-quality/spec.md` delta。

## Impact

- **新增**：`src/styles/tokens.ts`、`scripts/check-tokens.mjs`、`scripts/token-baseline.json`、`docs/design/system/interaction.md`、`docs/delivery/ui-verification-template.md`、e2e 守护用例。
- **修改**：`src/styles/tokens.css`（+ `--app-on-accent`）、`src/styles/doc-property.css`（3 处 `#fff` 改引用 token）、`docs/design/system/spec.md`（§7.8 新增、§8 supersede）、`scripts/verify.sh`（3c）、`.husky/pre-commit`、`.github/pull_request_template.md`。
- **测试**：新增 e2e（暗色实底文字对比度、四条交互条款守护）。
- **无** Rust 改动、无新增依赖、无数据迁移。
- **风险**：基线一次性录入量大 → 由脚本生成；对比度阈值过严 → 只对已存在的语义对断言，`status` 四组在错误色 token 化后再启用。详见 design.md。
