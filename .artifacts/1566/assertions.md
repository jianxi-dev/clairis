# #1566 QG-5 收口验证（editor-surface-batch23 F1）

验证基于 `feat/f1-verify`（= origin/main 58b85aa2 + 本票规划制品勾选）

## verify.sh 各段（原始输出摘录）

| 段 | 结果 |
|---|---|
| `npx tsc --noEmit` | 退出 0 |
| `npx eslint src/` | **0 errors**（39 warnings，均既有） |
| `npm test` | 182 files / **2265 tests 全过** |
| `scripts/css-manifest-check.sh` | ✅ 133 declared in TS / 240 defined in CSS |
| `npm run docs:check` | ✅（86/245 无有效 frontmatter 为既有统计口径） |
| `cargo check` | ✅ Finished (46 warnings，均既有) |
| `cw-conformance.sh verify` | ✅ 通过 |
| `cw-data-surface.sh diff` | ✅ 四栏文件与符号均已落地 |
| **本 change 相关 e2e（8 spec）** | **26 passed** |

## 全量 e2e 现状（既有失败，已建票）

`npx playwright test` 在**干净 origin/main 上**：57 failed / 1524 passed。
已抽样确认为既有测试过期（如 `block-handle` 期望「复制」实际「复制⌘+C」），与本 change 无关。
跟踪票：**#1598**。

## 一致性制品
`openspec/changes/editor-surface-batch23/conformance.lock` 在位，verify 通过（baseline 未篡改）。
