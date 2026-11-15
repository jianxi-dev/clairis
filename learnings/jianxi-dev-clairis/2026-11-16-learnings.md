# 2026-11-16 learnings（batch20 续跑 / 并发会话）

## 并发会话共享 worktree 会互相污染

现象：`feat/video-play-icon` 工作区的 #905 未提交改动，在会话中途被另一会话切走分支（`feat/md-image-radius`）并整批提交成 PR #939 合并；随后本会话的 stash/rebase/pop 把补丁落到对方分支上。

处置：每张票用独立 `git worktree`（`git worktree add ../clairis-wt-<票号> -b <branch> origin/main`），`node_modules` 用 symlink 复用（免重复安装）。提交前只 `git add` 本票文件。

## Playwright `reuseExistingServer` 会测到别的 worktree

`playwright.config.ts` 固定 `localhost:1420` 且 `reuseExistingServer:true`；主 worktree 的 dev server 占用 1420 时，在另一 worktree 跑 e2e 实际打的是**别的工作树代码**。

处置：隔离 worktree 里用 `npx vite --port 1421 --strictPort` + 临时 Playwright 配置（baseURL/webServer 改 1421），并把被测 spec 的 `APP_URL` 临时 sed 到 1421（跑完还原）。提交内容仍写 1420。

## 遮挡类缺陷只查节点存在 = masked test

#905 换播放角标后，阅读栏 `.rail-thumb-play`（absolute，先出现）被后出现的 `video`（relative）按绘制顺序盖住；e2e 只断言 `toHaveCount(1)` + `data-icon`，全绿但用户看不见。

处置：用 `document.elementFromPoint(角标中心)` 断言命中元素属于角标；并做红证（`page.addStyleTag` 把 `z-index` 改回 auto，断言必须失败）。mock 下 video 无像素帧时，遮挡仍可通过命中测试稳定复现——像素截图不是必要条件。

## pr-automation.sh resume 模式必须给 `--title`

`--resume-branch` 模式下不传 `--title` 会以 `pull request title must not be blank` 退出 1（分支已 push、PR 未创建），补传标题重跑即可，幂等。

## 并发会话会重复实现同一票

现象：本会话实现 #908 后，另一会话也实现 #908 并先合并（#946）；本会话 PR #947 冲突，最终关闭转拆残留缺陷票 #948（宽提示夹取 + iframe a11y 豁免）。

处置：每票开工前 `git fetch origin main && git log --oneline origin/main -3` 确认未被抢先；发现重复即比差异，把增量转成 `[bug]` 票 + 小 PR，不硬推重复实现。

## 菜单 grammar 统一时暴露的坐标兜底缺陷

三菜单行高统一（32→36）后，`slash.ts` 表格选择器的 mousemove 兜底按容器整宽整除，容器有 `padding + gap` 时右/下边缘会多算一列/一行（3×4 选成 3×5）。修法：优先 `document.elementFromPoint` 命中真实格子取 `data-r/data-c`，坐标算法仅兜底。教训：容器内命中判定不要用「可用宽 ÷ 列数」，padding/gap 会让它偏。

## 证据 manifest 是 ui-surface 票的硬门槛

`pr-automation.sh --resume-branch` 在创建 PR 前校验 `.artifacts/<票号>/state-coverage.json`（≥4 态），缺失直接退 1。每票收尾前先用 `cw-evidence.sh record-state` 录满 4 态（可含一个 `failed` 的红态），再跑 G2。

## `cargo check` 会改写 `src-tauri/gen/schemas/capabilities.json`

改 `capabilities/default.json` 后跑 `cargo check` 会重生成该 schema 文件（tracked）。必须一并提交，否则 G2 白名单校验不过；且提交后再跑 G2 需用新 HEAD 作为 `--verified-sha`（QG-5 过期拦截会退 1）。
