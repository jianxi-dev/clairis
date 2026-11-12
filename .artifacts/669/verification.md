# #669 页签喇叭按文件独立静音 — 验证记录

日期：2026-11-12（本地时间）

## 根因

`src/components/Content/mediaMute.ts` 旧实现是**模块级单布尔 + 全局广播**：`subscribeMediaMute` 把同一个值发给所有播放器实例，任一页签静音 → 全部实例静音（串音）。

## 修法

- mediaMute 改为 `Map<文件路径, boolean>`：`isMediaMuted(key)` / `setMediaMuted(key, v)` / `toggleMediaMuted(key)`，订阅者收到 `(key, muted)` 并自行过滤；新增 `clearMediaMuted(key)`。
- `VideoPlayer` 订阅回调 `if (key !== filePath) return`，依赖 `[filePath]` 重订阅；初始化与 `M` 热键均带 path。
- `TabBar` 抽出 `TabMuteButton`（按 tab.path 独立订阅/切换），替换原全局 `mediaMuted` 状态。
- `stores/index.ts` 的 `closeTab` 调 `clearMediaMuted(closedTab.path)`，避免重开同文件残留静音。

## 交付验收锚点（spec #660 / tasks 6.1，design D8）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-6.1a | 静音第一个后第二个 `muted` 严格 = false | PASS（e2e：真实 DOM muted 数组 [true, false]） |
| A-6.1b | 取消静音后第一个恢复、互不影响、无残留 | PASS（[false, false]；关闭页签后 [false]；重开同文件 [false]） |

## 回归（亲测）

- `npx playwright test e2e/media-stop.spec.ts`：3 passed（含新用例）
- `npx playwright test e2e/video-core e2e/video-multi-pane e2e/audio-open e2e/roulette-`：46 passed / 5 skipped
- `npx vitest run`：124 文件 / 1532 用例（media-mute.test.ts 按新语义更新为按文件隔离 + 清理，未删用例）
- `npx tsc --noEmit` / css-manifest / eslint（0 error）通过
- Rust 未改动（数据面：无）

## 备注

既有 `media-stop` 首条用例「视频播完停在当前文件」仍成立：其播放列表下一项是**音频**，#665 的默认档音频守卫（音频不静默起播）恰好保住该语义，与 1.1 的视频连播不冲突。
