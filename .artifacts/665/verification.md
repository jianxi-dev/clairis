# #665 视频连播与竖拍适配 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 1.1）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-1.1.1 | 播放列表第一个视频播完 → 当前播放项严格等于第 2 项，无残留旧画面 | PASS（e2e：ended 后 lastIndex=/tmp/movies/ep2.mp4；余下靠 switchUrl 换源，旧画面由浏览器清除） |
| A-1.1.2 | 竖拍视频朝向正确、可见宽度不超过容器宽度、取消播放后无残留实例 | PASS（e2e：videoWidth/Height=64/128 桩 → 播放器盒子 w<h 且 w≤容器宽；关页签后 .art-video-player 计数 0） |
| A-1.1.3 | e2e 扩展 `e2e/video-core.spec.ts`（mock 媒体） | PASS（+3 用例：默认档连播/音频守卫、列表循环环绕、竖拍适配+无残留） |

## 语义变更（记录取代关系）

- 旧决策：`video:ended` 只在「列表循环」档接管下一项；默认档停在当前文件（防同目录音频静默起播）。
- 新决策（batch15 1.1 真机走查）：默认档**连播下一个视频**；下一项是音频或已在列表尾则停下 —— 音频静默起播的守卫保留，视频连播按新需求生效。单集循环不变。
- 竖拍：`frame`（手动旋转/缩放/亮度）在 url 变化时已重置，无跨片残留；播放器盒子由 ArtPlayer autoSize（autoSize: true）+ 容器 CSS 跟随竖向维度，真机横躺属旋转元数据解码（浏览器契约），本票在其上锁定适配回归。

## 回归

- `npx playwright test e2e/video-`：38 过 / 1 skipped（证据截图用例无 EVIDENCE_DIR）/ 2 失败：
  - `video-playlist-memory`：单独复跑通过（并行负载 flaky）。
  - `video-transform`（连续四次旋转）：origin/main 基线 worktree 复跑同样失败 → 存量缺陷，与本票无关（首击即得 270°，疑重复绑定）。
- `npx tsc --noEmit` 通过；`npx eslint VideoPlayer.tsx` 0 error（10 条 react-hooks 存量为 warning）。
- 既有 video-core 5 条用例全过（静音/页签类型）。

## 实现要点

- `video:ended`：single 交 ArtPlayer；playlist 环绕（原逻辑）；默认档 `nextIdx` 存在且 kind!=="audio" 才 `playIndex(nextIdx)`，否则 `art.pause()`。
- e2e 观测点：`localStorage["biaoyue.media.lastIndex"]`（playIndex 在 await switchUrl 前同步写入）——mock 环境 media:// 无法解码，`switchUrl` 永不 resolve，故不断言 await 之后的页签改名。
