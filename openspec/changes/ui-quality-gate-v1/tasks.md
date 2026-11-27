# 任务 — ui-quality-gate-v1

> 切片原则：每张票贯穿「定义 → 接线 → 守护」，做完有可核验的门禁产物；票标题前缀 `[change=ui-quality-gate-v1/<任务号>]`；1 任务 = 1 票。
> 依赖：1.3 依赖 1.1（模板要引用 token 名与计算样式口径）。票数 3 < 6，QG-6 集成 checkpoint 不适用。

## 1. 品质地基

- [ ] 1.1 Q0 token 门禁与暗色实底文字对比度
  - 新增 `src/styles/tokens.ts`（键集 = tokens.css 55 唯一名 + `--app-accent-fill` + `--app-on-accent` = 57）与 `scripts/check-tokens.mjs`（A 裸色值 / B 双向对账 / C 对比度）
  - 存量裸色值进 `scripts/token-baseline.json`（去注释后实测 sum(count) = 127 / 唯一键 102；旧口径逐行扫描 426 行命中，其中 317 条是注释里的 issue 号），只减不增；3 处 accent 实底改 `--app-accent-fill` + `--app-on-accent`
  - 接线 `verify.sh` 3c、`.husky/pre-commit`（只跑 A）、CI verify job（新增 `Token gate` 步骤，全量 A/B/C）；`spec.md` 新增 §7.8 并 supersede §8
  - e2e：暗色主题开关/日期选中格的计算色 `严格等于 var(--app-on-accent)`、实底 `严格等于 var(--app-accent-fill)`，对比度 ≥4.5
- [ ] 1.2 Q1 四条交互条款与守护
  - 新增 `docs/design/system/interaction.md` 四条（零横线 / 反馈三档 / 禁用而非隐藏 / Esc 只退场），每条含定义、正反例、守护指针
  - 守护：1px 横线基线（19 条只减不增）、`window.alert|confirm|prompt` 零新增（3 处 prompt 进基线）、三条「禁用而非隐藏」e2e、Esc 逐层退出 e2e
  - `spec.md` §8 supersede 为「交互条款见 interaction.md」
- [ ] 1.3 Q4 交付验收模板与 PR 模板接线
  - 新增 `docs/delivery/ui-verification-template.md`（明暗 × 1280/400 截图对、可复现步骤、计算样式断言）
  - `.github/pull_request_template.md` 新增两项勾选；G3 交付对账引用模板，缺证据退回
