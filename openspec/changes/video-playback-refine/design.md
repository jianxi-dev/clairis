# 设计：视频打开行为与画中画语义（六.1 / 六.2 / 六.3）

## Context

- 需求输入：GitHub #1156（spec issue）+ 其两条评论（对账确认 2026-11-19、六.1 暂缓裁定），为最终依据。
- 探针证据：`.artifacts/triage-video-2026-11-19/evidence.md`（PiP 单例实锤；wry 0.55.1 自动播放策略 ground truth）。
- 现状代码（探查实证，`src/components/Content/VideoPlayer.tsx`）：
  - `:795-811` Artplayer 配置：`autoplay: false`、`autoPlayback: false`、`pip: false`、`mutex: false`。
  - `:1196-1218` `ready` 回调：恢复记忆位置（仅 seek，不播放）；音频补发 `play()`，视频不补发。
  - `:1231-1262` 手势：仅监听 `touchstart` / `touchmove` / `touchend` / `touchcancel`，左半 brightness、右半 volume。
  - `:1513-1537` `wheel`：仅 `ctrlKey || metaKey` 时缩放；另有 `gesturestart` / `gesturechange`（macOS 触控板手势事件）。
  - `:864-881` 与 `:1146-1153` 画中画：`document.pictureInPictureElement` 存在即 `exitPictureInPicture()`，否则 `requestPictureInPicture()`。
  - 加载指示：ArtPlayer 原生 `.art-loading`（库内，随元数据就绪隐藏）。
- 硬约束：C-6 暂停态不变；重启恢复不自动播放（batch20 task 2.4 约束共存）；delta 逐字保留既有场景标题（archive 防线）；本 change 只写 `openspec/`，不碰 `src/` 与 git。

## Goals / Non-Goals

**Goals:**

- 打开视频后呈现首帧画面，不出现加载页 / 加载指示；保持暂停态（`autoplay` / `autoPlayback` 关闭）。
- 触控板双指上下滑动调亮度（左半）/ 音量（右半）；`Ctrl` / `Cmd + wheel` 缩放保留；触屏手势保留。
- 规格明示画中画单文档单例（切换即替换），移除「多个视频各自拥有独立画中画容器」的虚假声称。

**Non-Goals:**

- 自动播放（用户裁定不做）。
- 多画中画实现（暂缓，未来按 Tauri 置顶迷你窗立项）。
- 六.4 宽度档 / 全屏迁移（归 #907 / batch20 task 2.9）。
- MD / HTML 内嵌视频（`<video controls>`）行为；既有热键（hotkey）集合。

## Decisions

1. **首帧呈现：`ready` 回调 seek 首帧 + 隐藏 `.art-loading`**。元数据就绪后把播放头定位到首帧（`art.currentTime` 置一个极小正值，如 `0.01`）并确保暂停，使首帧解码绘制；同时隐藏 ArtPlayer 原生 `.art-loading`（CSS `display: none` 或等价），消除「加载页 / 加载菊花」。理由：赋值 `currentTime` 不调用 `play()`，满足 C-6「打开路径不触发播放」；seek 到非零值强制首帧解码。替代方案：`poster`（需预生成封面，成本高，且与「显示视频首帧」语义有差）；`play()` 后立即 `pause()`（会产生一次 play 调用，违反「打开路径不触发播放」口径），均弃。
2. **手势通道：迁到 `wheel` 无修饰键分支，触屏 `touch` 保留**。在 `onWheel` 中：`ctrlKey || metaKey` → 既有缩放；否则按 `clientX` 相对播放器内容区中线判左右半，`deltaY` 映射到 brightness（左）/ volume（右），并 `preventDefault()` 阻止页面滚动。触屏 `touchstart` / `touchmove` 通道原样保留。左右半判定沿用既有 touch 口径（`rect.left + rect.width / 2`）。理由：触控板在 macOS WKWebView 派发 `wheel`（双指滚动）而非 `touch`，现有 touch 通道永不触发；`gesturestart` / `gesturechange` 已被缩放占用，不宜复用。
3. **画中画单例：不改代码，只改规格**。现有 `document.pictureInPictureElement` 判断与浏览器「先退出旧元素、再进入新元素」语义自洽（探针实锤第二次 `requestPictureInPicture` resolve 并替换）。本 change 在 C-6 明示单文档单例、切换即替换；在「视频窄宽降级与手势」移除多画中画声称。多画中画需 Tauri 置顶迷你窗架构，暂缓。
4. **规格触点**：`file-management` C-6 MODIFIED（首帧显示 + 单 PiP 语义 + 新增场景，既有 14 个场景标题逐字保留）；「视频窄宽降级与手势」MODIFIED（`wheel` 通道 + `Ctrl`/`Cmd + wheel` 缩放 + `touch` 保留；移除多 PiP 声称，既有场景标题保留并加 `>` 可追溯注记）。
5. **测试口径**：e2e 用 `HTMLMediaElement` 探针断言首帧（`currentTime > 0`、`paused === true`）与 `.art-loading` 不可见（计算 `display` / `opacity`）；`page.mouse.wheel` 派发无修饰键与 `Ctrl` 两种 `wheel`，断言 `video.style.filter` 的 brightness 与 `video.volume` 变化；PiP 断言单例替换（复用 `triage-video` 探针方法，落成常驻 e2e 或探针）。若手势映射抽成纯函数，附单测。
6. **规格债与跨 change 边界**：`reading` 域旧条款「视频打开即自动播放且多路独立」与 C-6 冲突，移除已由进行中 change `editor-surface-batch20` 的 reading delta 认领；本 change 不重复移除（OpenSpec `REMOVED` 对已不存在条款会抛错，重复移除会阻断 batch20 归档）。batch20 的 C-6 delta 亦需在本 change 归档后刷新（补首帧场景），已在任务 3.1 注明。

## 数据面

未命中数据面信号。G0 阶段二原始输出：

```
$ ./scripts/cw-data-surface.sh new video-playback-refine
SKIP 数据面（未命中信号）: video-playback-refine
EXIT=0
```

本 change 只改 `VideoPlayer.tsx` 内部播放与手势逻辑，不触及任何数据面落点。若 G0-POST `tickets` 因票面措辞命中信号，按「误报优先」契约补六栏表（逐栏写明「本 change 不触及」判据）。

## Risks / Trade-offs

- [首帧 seek 到 0.01 在部分编码下不绘制] → e2e 断言 `currentTime > 0` 且画面非黑（截图 / 探针）；若不绘制，回退到 `play()` 后立即 `pause()` 并接受一次 play 调用（须同步修订 C-6 口径）。
- [隐藏 `.art-loading` 掩盖真实加载失败] → 加载失败已有 `video:error` 错误态；`.art-loading` 仅在成功路径隐藏。
- [`wheel` 手势与页面滚动冲突] → 仅在播放器容器内监听并无修饰键分支 `preventDefault()`，不冒泡到文档滚动。
- [左右半判定在缩放 / 平移后偏移] → 以播放器内容区 rect 中线为准（沿用既有 touch 口径）。
- [PiP 单例口径变更影响用户预期] → 规格明示，且现有代码已如此，行为不变。
- [跨 change 规格重叠] → 见 Decision 6。

## Migration Plan

1. 首帧：`ready` 回调 seek + 隐藏 `.art-loading`。
2. 手势：`onWheel` 增无修饰键分支，复用既有 brightness / volume 应用逻辑。
3. 规格：C-6 与「视频窄宽降级与手势」delta 随 change 归档同步；batch20 归档前刷新其 C-6 delta。
4. 测试与 `verify.sh` 收口。
- 回滚：按提交粒度回退；无数据写入，无需迁移脚本。

## Open Questions

- **OQ-1**：首帧 seek 的目标值（`0.01` vs `0.001`）是否需按编码调整？G0 倾向 `0.01`，实现时以真机验证为准。
- **OQ-2**：是否把亮度 / 音量手势映射抽成纯函数以便单测？G0 倾向抽（如 `gestureDeltaToBrightness` / `gestureDeltaToVolume`），实现时定。
