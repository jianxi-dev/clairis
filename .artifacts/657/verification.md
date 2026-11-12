# #657 图片描述行 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #649 / tasks 7.1）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-7.1.1 | 选中无描述图片，占位文本严格等于「输入图片描述」 | PASS（e2e 描述行占位） |
| A-7.1.2 | 输入「雾山」+Enter，源码标题为 `"雾山"`，预览态出现图注 | PASS（e2e 描述行提交：源码含 ` "雾山"`，`.preview-content figcaption` 文本=雾山） |
| A-7.1.3 | 再次点击描述行，计算样式 display=none，标题数据保留 | PASS（e2e 描述行收起） |
| A-7.1.4 | Esc 取消，回到占位态，文档无残留改动 | PASS（e2e 描述行取消，content 与打开时逐字节相等） |

## 回归

- `npx playwright test e2e/image-block-edit.spec.ts`：22/22 通过（含 4 条新用例）。
- `npx playwright test`（默认配置全量）：636 通过 / 1 flaky（视频旋转，重跑即过）/ 17 skipped。
- `npx playwright test --config=playwright.tauri.config.ts`：45 通过，3 失败——已用 origin/main 基线 worktree 复跑同 3 条同样失败，确认为存量失败（export-html / video media:// / reading-view），与本票无关。
- `npx vitest run --coverage`：123 文件 / 1526 用例全过；lines 55.38%、branches 47.84%（阈值 30/20）。
- `npx tsc --noEmit`、`bash scripts/css-manifest-check.sh`、`npx eslint`（decorations 三文件零告警）：通过。ContentArea 的 7 条 react-hooks warning 为存量。

## 实现要点

- 标题写回：`scanImageReference` 新增 titleStart/titleEnd（引号段含引号），`writeImageTitle` 空串移除、非空替换/插入，属性块不动，双引号壳内转义反斜杠与双引号。
- 描述行 DOM：选中态由 `markImageWidgetSelected` 挂 `.cm-image-caption`（testid img-caption），内容按 `data-image-title` 渲染；占位/标题共用一行。
- 交互：无标题点击进输入（img-caption-input），Enter 提交（空值=取消）、Esc 与 blur 回退；有标题点击收起（display:none，模块级 captionCollapsed，重新选中复位）。mousedown stopPropagation 防 CM6 抢焦点，keydown stopPropagation 防 CM6 键位拦截。
- 预览态图注：复用渲染器既有 title→figcaption（markdown.ts:153-168），无需改动。
