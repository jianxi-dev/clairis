# 任务清单：视频打开行为与画中画语义（六.1 / 六.2 / 六.3）

> 规格：`specs/file-management/spec.md`（C-6 MODIFIED、「视频窄宽降级与手势」MODIFIED）。设计：`design.md`（决策 D1～D6）。需求输入：GitHub #1156 及其评论「对账确认（2026-11-19）」「六.1 暂缓（用户裁定）」，为最终依据。
>
> **切片说明（QG-7）**：按垂直切片拆票，每票贯穿播放逻辑 → UI 行为 → e2e 全层；按语义风险倒序（首帧呈现 > 手势通道 > 单 PiP 验证）。六.1 为文档口径，无代码改动，仅真机 / 探针验证。
>
> **测试归属（QG-2/QG-4）**：Playwright e2e 随各票交付（票面 AC 列明）；2.1 只做全量收口。
>
> **数据面机检三连**：G0 阶段二 `./scripts/cw-data-surface.sh new`（未命中信号）→ G0-POST `tickets` → G1 出口 `diff`。本 change 无数据面落点，各票显式写「无」。
>
> **不新建子票**：子票由编排器 G0-POST 统一建（Parent=#1156），本清单只出任务。

## 依赖与阻塞总览

- 1.1 无阻塞（首批开工票）。
- 1.2 无阻塞（与 1.1 改同一文件的不同 effect，可并行；若并行需各自基于 origin/main 并 rebase 消化）。
- 1.3 无阻塞（无代码改动）。
- 2.1 Blocked by 1.1、1.2、1.3。

## 1. 垂直切片

- [x] 1.1 **打开后显示视频首帧画面、不显示加载指示（六.2）**
  - 用户做完后能：打开视频文件后立即看到视频首帧画面，不再出现「加载页面 / 加载菊花」；视频仍为暂停态，不自动发声。
  - 改动点：`src/components/Content/VideoPlayer.tsx` 的 `ready` 回调（:1196-1218）——元数据就绪后把播放头定位到首帧（`art.currentTime` 置极小正值，如 `0.01`）并确保暂停；隐藏 ArtPlayer 原生 `.art-loading`（CSS `display: none` 或等价），加载失败仍走既有 `video:error` 错误态。**不动 `autoplay` / `autoPlayback`（保持 false）**，重启恢复路径同样不自动播放。
  - e2e：打开视频后断言 `video.currentTime > 0`（首帧已 seek）、`video.paused === true`、`.art-loading` 计算 `display` 为 `none` 或 `opacity` 为 0；重启恢复后同样断言暂停态 + 首帧。
  - AC：`npm run tauri dev` 打开视频 → 元首帧画面可见、无加载页 / 加载菊花；500ms 内 `video.paused === true` 且无自动发声；重启恢复含视频布局 → 暂停态 + 首帧画面。
  - 锚点：C-6 场景「打开后显示首帧画面」「打开视频为暂停态」「重启不自动播放」。
  - Blocked by：无。
  - 接线归属：无新增导出（改既有 `ready` 回调内部逻辑）。
  - 标签：ready-for-agent、ui-surface。
  - 粒度：用户可见交付物。
  - 视觉锚点：无（行为 / 状态变更，不新增可见 UI）。
  - 数据面：无

- [x] 1.2 **触控板双指滑动调亮度 / 音量（六.3，迁 `wheel` 通道）**
  - 用户做完后能：在播放器画面左半用触控板双指上下滑动调亮度、右半调音量；按住 `Ctrl` / `Cmd` 滚动仍是缩放；触屏双指手势仍可用。
  - 改动点：`src/components/Content/VideoPlayer.tsx` 的 `onWheel`（:1524-1528）——`ctrlKey || metaKey` → 既有缩放；否则按 `clientX` 相对播放器内容区中线判左右半，`deltaY` 映射到 brightness（左，`applyFrame`）/ volume（右，`art.volume`），并 `preventDefault()`。触屏 `touchstart` / `touchmove` 通道（:1231-1262）原样保留。可选抽纯函数 `gestureDeltaToBrightness` / `gestureDeltaToVolume` 便于单测。
  - e2e：`page.mouse.wheel` 在画面左半 / 右半派发无修饰键 `wheel` → 断言 `video.style.filter` 的 brightness 变化、`video.volume` 变化；按住 `Ctrl` 派发 → 断言缩放变化且 brightness / volume 不变；触屏 `touch` 通道按既有断言保留。
  - AC：`npm run tauri dev` 打开视频 → 左半双指滑动亮度变、右半音量变；`Ctrl +` 滚轮缩放生效且不调亮度 / 音量；触屏手势不回归。
  - 锚点：「视频窄宽降级与手势」场景「触控板双指滑动调亮度音量」「Ctrl 加滚轮缩放保留」「收窄、手势与多画中画」。
  - Blocked by：无。
  - 接线归属：无新增导出（改既有 `onWheel` 内部分支）。
  - 标签：ready-for-agent、ui-surface。
  - 粒度：用户可见交付物。
  - 视觉锚点：无（行为变更，不新增可见 UI）。
  - 数据面：无

- [x] 1.3 **画中画单文档单例语义验证（六.1，无代码改动）**
  - 用户做完后能：一个视频已在画中画时，对另一个视频发起画中画会替换当前窗口（切换即替换），同一时刻只有一个画中画；规格已明示该语义。
  - 改动点：无代码改动（现有 `document.pictureInPictureElement` 判断已与浏览器语义自洽）。验证方式：复用 `.artifacts/triage-video-2026-11-19/evidence.md` 的探针方法，落成常驻 e2e（同文档两个 `<video>`，第二次 `requestPictureInPicture` 后断言 `document.pictureInPictureElement` 指向新元素、旧元素收 `leave`）或真机手点证据。
  - e2e：新增 / 扩展 PiP 单例用例，断言替换语义与「同一时刻仅一个 PiP」。
  - AC：`npm run tauri dev` 两个格各开一个视频 → A 进画中画后对 B 发起 → 画中画替换为 B；规格 C-6 场景「单文档单画中画切换即替换」通过。
  - 锚点：C-6 场景「单文档单画中画切换即替换」。
  - Blocked by：无。
  - 接线归属：不适用（无代码改动，仅验证）。
  - 标签：ready-for-agent、ui-surface。
  - 粒度：verify-only。
  - 视觉锚点：无（语义验证，不新增可见 UI）。
  - 数据面：无

## 2. 验收与交付

- [x] 2.1 **集成验收与交付**
  - 用户做完后能：首帧呈现、触控板手势、画中画单例在真机桌面上一起可观测成立，既有播放 / 控制行为不回归。
  - `npm run tauri dev` 手动走查全量关键路径（打开视频首帧、无加载页、触控板左右半调亮度 / 音量、Ctrl + 滚轮缩放、PiP 切换替换），按仓库 UI 约定用功能说明性语言记录；`bash scripts/verify.sh` 全绿（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）；数据面机检 `diff` 收口；更新 `docs/delivery/requirements-status.md`；G4 归档。
  - 跨 change 备注：本 change 归档后，`editor-surface-batch20` 的 C-6 delta 需刷新（补「打开后显示首帧画面」「单文档单画中画切换即替换」场景）；其 reading delta 已认领旧自动播放条款的移除，本 change 不重复移除。
  - 涉及文件：`docs/delivery/requirements-status.md`（无 src 改动）。
  - 验证命令：`bash scripts/verify.sh`。
  - Blocked by：1.1、1.2、1.3。
  - 接线归属：不适用（收口票）。
  - 视觉锚点：无（收口票，不新增可见 UI）。
  - 数据面：无

## 3. 来源映射

| 任务 | 来源 | 规格触点 |
|---|---|---|
| 1.1 | #1156 六.2 对账确认（不自动播放 + 显示首帧） | C-6 首帧显示 / 暂停态 / 重启不自动播放 |
| 1.2 | #1156 六.3 对账确认（★A 手势迁 wheel） | 「视频窄宽降级与手势」wheel 通道 / 缩放保留 |
| 1.3 | #1156 六.1 暂缓裁定（单 PiP 语义明示） | C-6 单文档单画中画场景 |
| 2.1 | 上述三票收口 | file-management 全量 |
