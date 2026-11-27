# 需求四要素 — ui-quality-gate-v1

来源：`docs/delivery/plans/malleability-delivery-plan.md` §0 表（B1 品质地基）与 §1 Q0/Q1/Q4；维护者 2026-11-27 裁定「品质线第一优先」。spec issue：待建（建成后回填编号）。

## What（要做什么）

把三条「品质地基」落成可机检的门禁与条款：

1. **Q0 token 门禁**：`src/styles/tokens.ts` 与 `src/styles/tokens.css` 双向对账；组件层裸色值只减不增；语义色对比度机检；接入 `verify.sh` 3c、pre-commit、CI。
2. **Q1 交互条款**：新建 `docs/design/system/interaction.md` 四条（零横线 / 反馈三档 / 禁用而非隐藏 / Esc 只退场），每条带守护；`spec.md` §8 从「不做交互规范」supersede 为「交互条款见 interaction.md」。
3. **Q4 交付验收模板**：`docs/delivery/ui-verification-template.md` 三件证据（明暗 × 宽窄截图、可复现步骤、计算样式断言），接入 PR 模板与 G3 交付对账。

## Why（为什么现在做）

- 实测缺口：组件层裸色值 **426 处**无门禁；`tokens.css` **99 处声明 / 55 个唯一变量名**无类型镜像、无对账；暗色主题 `--app-accent` 实底上的白字 **2.98:1**（日期选中格、布尔开关、开关上都是文字），低于非文本下限 3:1，更低于正文下限 4.5:1。
- 交互规则只存在于评审口头经验：`window.prompt` 仍有 **3 处**（`slash.ts`、`HtmlRangeToolbar.tsx`、`HtmlEditToolbar.tsx`）；新增 `border-top/bottom: 1px` 无基线；「禁用而非隐藏」「Esc 只退场」无守护。
- UI 交付以「编译通过 / 单测绿」结案：PR 模板无视觉证据要求，G3 交付对账只列功能点，用户实测才发现偏差。
- 后续 B2–B7 的 UI 改动需要一个统一闸门；先立规再动工，避免边做边返工。

## Scope（范围）

**在内**

- `src/styles/tokens.ts`（类型化常量表）+ `scripts/check-tokens.mjs`（A 裸色值 / B 双向对账 / C 对比度）+ `scripts/token-baseline.json`。
- 新增 `--app-on-accent` token，修暗色实底文字对比度（3 处消费）。
- `docs/design/system/spec.md` 新增 §7.8（对比度阈值）、§8 supersede。
- `docs/design/system/interaction.md` 四条 + 各带守护（e2e / 扫描）。
- `docs/delivery/ui-verification-template.md` + `.github/pull_request_template.md` 接线。
- `scripts/verify.sh` 3c 段、`.husky/pre-commit` 只跑 A。

**不在内（Non-goals）**

- 不迁移存量 426 处裸色值、18 处 1px 横线、3 处 `window.prompt`（进基线只减不增；迁移随 Q2 基件与后续专项）。
- 不做 Q2 四基件 / `/showcase`、Q3 图标纪检、Q5 px 专项。
- 不引入运行时校验、不动 Rust、不新增依赖。
- 不改 `docs/design/system/spec.md` §7.3 的人工审美七问（它仍是人工判据）。

## 验收锚点来源

`openspec/changes/ui-quality-gate-v1/anchors.md`（R-1…R-4）与 `conformance.json`；一手证据为本次实测数字（426 / 99 / 55 / 3 / 2.98 / 18）与交付方案条款。
