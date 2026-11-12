# #656 无损裁剪 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #649 / tasks 6.1）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-6.1.1 | 确认后引用地址严格不变、可见尺寸小于裁剪前、源码出现裁剪矩形属性 | PASS（e2e：`{crop=3,3,26,26}`，可见 26×26 < 32×32，地址前缀不变） |
| A-6.1.2 | 再次打开矩形与上次严格一致；扩大后可见区域随之变大 | PASS（e2e：矩形 style 精确 {3px,3px,26px,26px}；扩大后 `{crop=3,3,29,26}`，29 > 26） |
| A-6.1.3 | 清空裁剪后恢复完整显示，源码无残留裁剪属性 | PASS（e2e：恢复整图后 content 与原文档逐字节相等，可见 32×32） |
| A-6.1.4 | Esc 取消后显示与源码均无变化 | PASS（e2e：拖动后 Esc，content 不变、显示不变） |

## 回归

- `npx playwright test e2e/image-block-edit.spec.ts`：26/26（含 4 条裁剪新用例 + 裁剪按钮启用改写）。
- `npx playwright test`（全量默认）：639 过 / 1 flaky（tab-selection，重跑即过）/ 17 skipped。
- `npx playwright test --config=playwright.tauri.config.ts`：45 过，3 失败为存量（此前已用 origin/main 基线 worktree 复跑确认）。
- `npx vitest run`：123 文件 / 1526 用例全过。decorations-blocks 旧断言「裁剪固定显示后续票提示」按新规格更新为「缺省回调仍禁用，标题回归『裁剪』」。
- `npx tsc --noEmit`、css-manifest、eslint（改动文件零新增告警）：通过。

## 实现要点

- 语义定案：裁剪 = 显示裁剪窗口（原图 1:1），拖缩放把手 = 调整裁剪矩形本身（原图像素坐标），不与 width/height 缩放属性叠加；写裁剪时清空 width/height，恢复整图时清空裁剪。
- 渲染技法（编辑态与预览态同一套）：盒 = 裁剪矩形，`object-fit:none` + `object-position:-left -top` 平移内容，无需知道 natural 尺寸。
- 裁剪浮层（imageCrop.ts）：暗背景 + 原图舞台（≤70% 视口自适应缩放）+ 裁剪矩形（box-shadow 压暗外部）+ 8 把手 + 恢复整图/取消/确认；覆盖层像素拖拽换算回原图取整；Esc/点背景/取消 = 放弃不回调。
- 默认矩形 = 居中 80%（确认即产生比原图小的可见区域，满足 A-6.1.1）。
- 修复：拖拽中途落点在背景上的合成 click 会被当成「点背景取消」——改为按下与抬起都在背景上才取消。
- 预览侧：`applyImageAttributes` 消费 `data-img-crop`（carrier 既有），有裁剪时忽略 width/height。
- 工具条裁剪按钮启用（去掉「后续票实现」占位）；地址解析失败时经 showNoticeSink 提示。
