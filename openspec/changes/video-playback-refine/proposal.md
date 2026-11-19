# 变更提案：视频打开行为与画中画语义（六.1 / 六.2 / 六.3）

## Why

用户 2026-11-19 第三轮验收反馈：打开视频文件时先出现「加载页面」，需要点一下才出画面；触控板双指上下滑动不能调亮度/音量。维护者对账确认（GitHub #1156 评论，最终依据）：六.2 维持「不自动播放」（C-6 不变），但打开后必须显示视频首帧画面、不显示加载页 / 加载菊花；六.3 把亮度/音量手势迁到触控板实际派发的 `wheel` 通道；六.1 多画中画经探针实锤为浏览器单文档单例（切换即替换），用户裁定暂不实现多画中画，仅需在规格中明示单例语义，了结 batch14 曾虚假声称多画中画（PiP）的欠账。六.4 宽度档 / 全屏迁移归 #907（batch20 task 2.9），不在本 change。

## What Changes

- **打开后显示首帧画面（六.2）**：元数据就绪后定位首帧并暂停呈现；不显示加载页 / 加载指示（loading spinner）。C-6 暂停态不变（`autoplay` / `autoPlayback` 关闭），重启恢复路径同样不自动播放（与 batch20 task 2.4 约束共存）。
- **手势通道迁移（六.3）**：触控板双指上下滑动调亮度（画面左半）/ 音量（画面右半），实现改监听无修饰键 `wheel` 事件（触控板派发 `wheel` 而非 `touch`）；`Ctrl` / `Cmd + wheel` 缩放语义保留；触屏 `touch` 通道保留。
- **画中画单例语义（六.1，仅文档）**：规格明示「单文档单画中画、切换即替换」，移除「多个视频各自拥有独立画中画容器」的虚假声称；多画中画暂不实现。
- **规格修订**：`file-management` C-6 MODIFIED（首帧显示 + 单 PiP 语义）；`视频窄宽降级与手势` MODIFIED（手势改 `wheel` 通道；移除多画中画声称）。既有场景标题逐字保留。

## Capabilities

### New Capabilities

（无——三项均为既有能力 `file-management` 的需求修订。）

### Modified Capabilities

- `file-management`：C-6（打开后显示首帧、不显示加载指示；画中画单文档单例语义 + 场景）；「视频窄宽降级与手势」（亮度/音量手势改 `wheel` 通道，`Ctrl`/`Cmd + wheel` 缩放与触屏 `touch` 保留；移除多画中画声称）。

## Impact

- **前端**：`src/components/Content/VideoPlayer.tsx`（`ready` 回调首帧 seek、隐藏 ArtPlayer 原生 `.art-loading`；`onWheel` 增无修饰键亮度/音量分支；`touch` 通道保留）。
- **数据面**：`./scripts/cw-data-surface.sh new video-playback-refine` 未命中信号（无数据面落点）。
- **测试**：e2e（首帧 `currentTime > 0` 且 `paused === true`、`.art-loading` 不可见；无修饰键 `wheel` 调亮度/音量、`Ctrl + wheel` 缩放；PiP 单例替换）；`bash scripts/verify.sh` 全绿。
- **不在范围**：自动播放（用户裁定不做）；多画中画实现（暂缓，未来按 Tauri 置顶迷你窗立项）；六.4 宽度档 / 全屏迁移（归 #907 / batch20 task 2.9）；MD / HTML 内嵌视频（`<video controls>`）行为。
- **规格债**：`reading` 域旧条款「视频打开即自动播放且多路独立」与 C-6 冲突，其移除已由进行中 change `editor-surface-batch20` 的 reading delta 认领；本 change 不重复移除（OpenSpec `REMOVED` 对已不存在条款会抛错，重复移除会阻断 batch20 归档）。
