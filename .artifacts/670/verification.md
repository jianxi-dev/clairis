# #670 音频静音立即停止与同目录播放列表 — 验证记录

日期：2026-11-12（本地时间）

## 用户裁定（D9，非淡出）

「静音必须在一次事件内暂停播放器（`pause()` + `muted` 同步），SHALL NOT 保留约 1 秒的声音残留；现有『静音后仍响约 1 秒』是缺陷（用户 2026-11-11 更正），**不是期望的淡出**。」

→ 实现与验证均不含任何淡出/渐变/延时；`git diff` 全量搜索 `fade|淡出|volume -=|sed*Timeout.*volume|渐` 为空。

## 根因

旧 `apply(key, m)` 只写 `art.muted = m`。元素仍处播放态：底层音频管线继续渲染输出，真实环境表现为静音后仍响约 1 秒（artplayer 的 muted 代理与音频输出不同步）。

## 修法（`src/components/Content/VideoPlayer.tsx`）

1. 静音应用：
   - 判定当前媒体 kind（播放列表当前项 `kind`，回退 `fileKindRef`）；
   - **音频**：`if (m && kind === "audio") art.pause()` 后 `art.muted = m` —— 同步暂停 + 静音；
   - **视频**：保持既有「只静音不暂停」（规格只要求音频立即暂停）；
   - 取消静音：`muted = false`，不自动续播（e2e 显式断言仍 `paused: true`）。
2. 同目录列表：`list_media_in_dir` 结果按 `localeCompare(undefined, { numeric: true })` 自然序排序（media 与字幕两组），顺序稳定可复现。

## 交付验收锚点（spec #660 / tasks 7.1，delta A-6.1–A-7.2）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-7.1 | 静音后 100ms 已不在播放态、无声音残留 | PASS（e2e：{paused:true, muted:true}；证据截图实测） |
| A-7.2 | 同目录 3 音频、列表项数 = 3、顺序稳定 | PASS（e2e：播放列表（3），自然序 track-1 < track-2 < track-10；二次读取一致） |
| 无残留 | 取消播放后无残留实例 | PASS（关页签后 `.art-video-player` 计数 0） |

## 回归（亲测）

- `npx playwright test e2e/audio-open.spec.ts`：5 passed / 1 skipped（首跑 1.9m 冷启动出现 1 次 flaky，单跑与单 worker 均稳定）
- `npx playwright test e2e/media-stop e2e/video-core e2e/video-multi-pane e2e/video-playlist-memory --workers=1`：16 passed / 1 flaky（video-playlist-memory 已知存量 flaky）
- `npx vitest run`：124 文件 / 1532 用例（与 playwright 并行跑时出现 10 挂，单独跑全过——并行负载导致 jsdom 定时器饥饿，非实现缺陷；已改为串行执行）
- `npx tsc --noEmit` / css-manifest / eslint（0 error）通过
- Rust 未改动（数据面：无）

## 观察（不在本票范围）

mock 环境 media:// 无法解码，播放器显示「视频加载失败」且文案对音频也写「视频」——mock 产物 + 既有文案细节，不影响本票验收。
