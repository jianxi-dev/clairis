# #667 提示信息显示时长可配置 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 4.1，delta: configuration 提示时长 A-4.1–A-4.2）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-4.1a | 设 1.5 并触发提示：配置持久值严格 = 1.5 | PASS（e2e：editorStore + localStorage 双断言） |
| A-4.1b | 提示在 1.4–1.7 秒间消失 | PASS（e2e measureNotice：页面内 MutationObserver 计时，避开 Playwright 轮询 ~500ms 噪声；触发器 = >20MB 粘贴 → paste-notice） |
| A-4.2a | 输入 1.55 / 0 被拒并回落 | PASS（e2e：配置不变 + 输入框回退显示原值；Rust 校验矩阵含 1.55/0/0.05/10.1/NaN/±Inf） |
| A-4.2b | 清空恢复默认、无残留配置 | PASS（e2e：配置 null + 提示 ≥2800ms） |
| 重启保持 | reload 后配置仍 1.5 | PASS（mock 配置持久化 localStorage） |

## 数据面六栏（design D6）

- 存储：`notice_duration: Option<f64>`（serde default + skip_serializing_if，camelCase）。
- 校验：`check_notice_duration`——有限数、0.1–10、一位小数（`(v*10 - round(v*10)) > 1e-9` 拒）。
- 桥接：useConfig 三处 + `normalizeNoticeDuration`（导出可测），非法回落 null。
- 消费：ContentArea showNotice 读 `config.noticeDuration`，null → 3000ms。
- 回滚：快照整份 AppConfig 序列化自动覆盖新字段；新增测试验证 restore 后 notice_duration=1.5、非法值保存被拒且 user 文件字节不变。
- 设置：`settings-notice-duration` 输入（number step 0.1 min/max），三态 parse（default/valid/invalid），非法不落盘并回退显示。

## 回归（亲测）

- `npx playwright test e2e/settings-tooltip.spec.ts`：4 passed
- `npx playwright test e2e/capsule- e2e/roulette-`：40 passed / 1 flaky / 4 skipped（不回退）
- `cargo test`：128 passed（+2 条新配置测试：好/坏值矩阵、round-trip + 快照回滚 + 非法值不落盘）
- `npx vitest run`：123 文件 / 1526 用例（与 e2e 并行跑时出现过 7 条并行负载 flake，连续两次单独跑全过，判定为资源争抢非实现缺陷）
- `npx tsc --noEmit` / css-manifest / eslint（0 error）通过
