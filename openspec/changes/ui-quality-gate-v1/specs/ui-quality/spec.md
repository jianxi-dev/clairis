# ui-quality 变更（delta）

## ADDED Requirements

### Requirement: UQ-1 设计 token 门禁

`src/styles/tokens.ts` 与 `src/styles/tokens.css` SHALL 双向对账：`tokens.ts` 键集等于 `tokens.css` 的 55 个唯一变量名加 `--app-on-accent`（共 56 键）；`.dark` / `.warm` 主题块的声明键 SHALL 存在于该键集（部分覆盖不要求补全）；`src` 内每个 `var(--x)` SHALL 有定义。组件层与编辑器层 SHALL NOT 新增裸色值（hex/rgb/rgba），存量基线只减不增。语义色对 SHALL 满足对比度：ink-1（`--app-text-strong`）≥ 7、正文级（`--app-text-2`）≥ 4.5、次要/大字（`--app-text-3`）≥ 3、accent 实底文字 ≥ 4.5、危险色 ≥ 4.5。status 四组首期不启用。

#### Scenario: 组件裸色值被拒

- **WHEN** 在 `src/components/**` 或 `src/editors/**` 新增一处 `#ff0000`
- **THEN** `check-tokens` 的 A 检查 SHALL 退 1，并打印该 `file:line`

#### Scenario: 删除 token 定义被拒

- **WHEN** 从 `tokens.css` 删除一个已有变量定义
- **THEN** B 检查 SHALL 退 1，并打印差集

#### Scenario: 对比度跌破被拒

- **WHEN** 任一语义对的 WCAG 比值低于阈值
- **THEN** C 检查 SHALL 退 1，并列出对名与实测比值

#### Scenario: 未定义变量被拒

- **WHEN** `src` 内出现 `var(--not-exist)`
- **THEN** B 检查 SHALL 退 1

### Requirement: UQ-2 四条交互条款

UI 交互 SHALL 遵守四条条款：零横线（分隔用间距/背景；例外仅菜单分组线与表格边框，且用 `--app-border`）；反馈三档（静默 / 轻提示 toast / 需确认 dialog；SHALL NOT 使用 `window.alert|confirm|prompt`）；禁用而非隐藏（条件不满足时控件 SHALL 保留并 `disabled` + 原因提示）；Esc 只退场（只关闭最上层，SHALL NOT 触发保存/删除）。每条条款 SHALL 带守护指针，守护红则修。

#### Scenario: 新增 1px 横线被拒

- **WHEN** 新增 `border-top: 1px` 或 `border-bottom: 1px`
- **THEN** 该命中 SHALL 不在 19 条基线内，守护退 1

#### Scenario: 原生对话框零新增

- **WHEN** 新增 `window.alert` / `window.confirm` / `window.prompt`
- **THEN** 守护 grep 命中数 SHALL 为 0（3 处存量 prompt 进基线）

#### Scenario: 无选区导出保留且禁用

- **WHEN** 无选区时触发导出动作
- **THEN** 控件 SHALL 保留可见且为 `disabled`，并显示原因提示

#### Scenario: Esc 逐层关闭且文档不变

- **WHEN** 依次按 Esc 关闭快捷键帮助 → AI 待确认 → AI 窗口 → 临时显现 → 全屏 → 阅读态
- **THEN** 每层只关闭最上层，全部关闭后编辑器内容不变（无保存/删除副作用）

### Requirement: UQ-3 UI 交付三件证据

UI 交付 PR SHALL 附三件证据：① 明/暗 × 1280/400 截图对，标关键态；② 关键路径 e2e 或逐步手工清单；③ 计算样式断言（字号/色值/尺寸来自 token）。缺任一件 SHALL 退回。

#### Scenario: 三件齐全通过

- **WHEN** PR 附齐三件证据
- **THEN** 交付对账 SHALL 判为通过

#### Scenario: 缺截图退回

- **WHEN** PR 缺明/暗 × 1280/400 截图对
- **THEN** 交付对账 SHALL 退回

#### Scenario: 缺计算样式断言退回

- **WHEN** PR 缺计算样式断言
- **THEN** 交付对账 SHALL 退回

### Requirement: UQ-4 门禁接线

`scripts/verify.sh` SHALL 含「3c. Token Gate」段并跑 A/B/C 全量；`.husky/pre-commit` SHALL 只跑 A 且耗时 < 1s；`.github/workflows/ci.yml` 的 `verify` job SHALL 含 `Token gate` 步骤跑全量 A/B/C；`docs/design/system/spec.md` SHALL 含 §7.8 并 supersede §8 的「不机检 §7 判据」；`docs/design/system/interaction.md` SHALL 存在且四条各带守护指针。

#### Scenario: verify 输出含 3c

- **WHEN** 运行 `bash scripts/verify.sh`
- **THEN** 输出 SHALL 含「3c. Token Gate」段

#### Scenario: pre-commit 只跑 A

- **WHEN** 运行 pre-commit
- **THEN** 色值检查 SHALL 只跑 A 且耗时 < 1000ms

#### Scenario: CI verify job 跑全量

- **WHEN** 查看 `.github/workflows/ci.yml` 的 `verify` job
- **THEN** 该 job SHALL 含 `Token gate` 步骤并执行 `node scripts/check-tokens.mjs`（A/B/C 全量）

#### Scenario: §8 已 supersede

- **WHEN** 查看 `spec.md` §8
- **THEN** 该节 SHALL 不再写「不机检 §7 判据」，改为指向 §7.8 与 `interaction.md`
