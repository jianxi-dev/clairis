---
title: "标月 — 视频播放器增强 v1 设计（播放列表 / 循环 / 快捷键 / 多字幕 / 音频 / 笔记联动）"
type: design
status: accepted
last_updated: 2026-08-30
source_of_truth: supporting
---

# 标月 — 视频播放器增强 v1 设计

> 状态: v1 — 播放列表 + 三态循环 + 快捷键体系 + 多字幕（上下位置）+ MP3 音频 + 时间戳笔记（一期）
> 来源: 用户需求确认（2026-08-30）+ ArtPlayer 5.4.0 源码调研 + Biaoyue 现有能力盘点
> 前置: `docs/design/explorations/` 无同主题草图；本文为首次批准设计

---

## 〇、背景与选型结论

现状：`src/components/Content/PreviewView.tsx` 的视频预览已从原生 `<video>` 迁移到 **ArtPlayer 5.4.0**（见 `VideoPlayer.tsx`），全屏走网页全屏（macOS WKWebView 下 HTML5 原生全屏不可靠）。

本设计在此基础之上做功能增强。关键选型结论（ArtPlayer 源码核实，`master@0b9c31a`）：

| 能力 | 结论 |
|---|---|
| 播放列表 | **无原生、无官方插件**（作者 Issue #447 明确建议自建）；用 `art.switchUrl(url)` + `video:ended` 实现 |
| 动态切集 | `art.switchUrl(url)` 返回 Promise，保留倍速/宽高比，切换前在播则自动续播，**全屏状态保持**（不重建实例） |
| 单视频循环 | ✅ `option.loop = true`（JS 层 `video:ended` → seek 0 + play） |
| 列表循环 | 自建：`option.loop` 保持 `false`，监听 `video:ended` 切下一集；与 `loop` 互斥（状态机） |
| MP3/音频 | ✅ 后端 media 协议 MIME 已支持 mp3/m4a/wav/flac/ogg；ArtPlayer 传 url 即可播（`<video>` 元素播放音频）；无封面时黑屏，需 poster/占位 |
| 多字幕 | ✅ `art.subtitle.switch(url, {name})` 多轨道切换；`art.subtitle.style()` / CSS 变量控制**上下位置**；内置 srt/ass/vtt 转换 |
| 笔记联动 | 一期时间戳笔记（复用 `captureOverlay` inbox + `editorRef` 插入编辑器）；二期截屏需新工程 |

---

## 一、播放列表

### 1.1 数据源

新增 Rust 命令 `list_media_in_dir(path: String) -> Vec<MediaEntry>`：

```rust
pub struct MediaEntry {
    pub path: String,     // 绝对路径
    pub name: String,     // 文件名
    pub kind: String,     // "video" | "audio"
}
```

- 输入当前打开文件的路径，返回**同目录**下所有视频 + 音频文件（按文件名自然排序）
- 视频扩展名：mp4 / mov / webm / m4v / mkv / avi
- 音频扩展名：mp3 / m4a / wav / flac / ogg
- **副作用：把列表中每个文件都注册进 media:// 白名单**（`register_media_path`），否则 media 协议 404
- 复用 `src-tauri/src/commands/directory.rs` 的目录遍历模式；`lib.rs` 注册命令

### 1.2 前端状态

`VideoPlayer.tsx` 内部维护（不进全局 store，播放器生命周期自持）：

```ts
interface PlaylistState {
  items: MediaEntry[];     // 同目录媒体文件
  currentIndex: number;    // 当前播放索引
  loopMode: "none" | "single" | "playlist";  // 三态循环
  showPlaylist: boolean;   // 播放列表抽屉展开
  showHints: boolean;      // 快捷键说明浮层
  showSubtitlePicker: boolean; // 字幕轨道选择浮层
}
```

### 1.3 UI：右侧抽屉浮层

控制条「播放列表」按钮（🗀 图标，index 42）→ 点击展开右侧抽屉：

```
┌──────────────────────────────┐
│ 播放列表 (12)          [×]   │
│ ─────────────────────────── │
│ 01 课程导入.mp4         🎬   │
│ 02 第一章-概念.mp4  ●播放中  │
│ 03 第二章-实践.mp4     🎬   │
│ 04 补充资料.mp3        🎵   │
│ ...                          │
└──────────────────────────────┘
```

- 当前播放项高亮 + 播放中标记；点击任意项切集
- 视频 🎬 / 音频 🎵 图标区分
- 默认收起；点按钮或按 N/P 切换时不自动展开

### 1.4 切集逻辑

```ts
const playIndex = async (i: number) => {
  try {
    await artRef.current?.switchUrl(mediaUrlForPath(items[i].path));
    setCurrentIndex(i);
  } catch {
    playIndex(nextPlayable(i)); // 损坏文件 → 跳过
  }
};
```

- **不重建 ArtPlayer 实例**（实例放 ref，切集只调 `switchUrl`）→ 全屏/倍速/宽高比保持
- `switchUrl` Promise reject = 文件加载失败 → 自动跳到下一个可播文件
- 切集后 `register_media_path` 已由 Rust 命令统一注册，无需前端逐个 invoke

---

## 二、循环模式（三态状态机）

控制条「循环」按钮（🔁 图标，index 52），三态循环：

| 状态 | 图标 | 实现 |
|---|---|---|
| 不循环 | 🔁（灰） | `art.option.loop = false`，不接管 ended |
| 单集循环 | 🔁（亮） | `art.option.loop = true`（ArtPlayer 原生） |
| 列表循环 | 🔁+🔄（亮） | `art.option.loop = false` + `art.on("video:ended")` 切下一集（最后一集回第一集） |

**互斥实现**：`art.option.loop` 是普通对象字段，运行时直接改。切到列表循环时置 `loop=false` 并注册自己的 ended handler；切到单集循环时置 `loop=true` 并注销自己的 handler（防止 ArtPlayer 内部 handler 与自定义 handler 竞争——源码确认两者都挂在 `video:ended` 上，`loop=true` 时内部 handler 会先 seek 0 + play，与切集逻辑冲突）。

快捷键 **L** 循环切换三态。

---

## 三、控制条布局与快捷键体系

### 3.1 控制条布局（右侧，从左到右）

```
[🔊音量] [⏺画中画] [🗀播放列表] [🔁循环] [CC字幕] [⛶网页全屏] [⌨快捷键说明]
  index 40    50       42        52     54       60         80
```

> 播放列表(42)、循环(52)、字幕(54)、快捷键说明(80)；画中画(50) 原生。

### 3.2 快捷键总表

（仅播放器聚焦时生效，不干扰 CodeMirror 编辑器）

| 键 | 功能 | 来源 |
|---|---|---|
| 空格 | 播放 / 暂停 | ArtPlayer 内置 |
| ← / → | 快退 / 快进 5s | ArtPlayer 内置 |
| ↑ / ↓ | 音量 ± | ArtPlayer 内置 |
| Esc | 退出全屏 | ArtPlayer 内置 |
| **N / P** | **下一集 / 上一集** | 本组件注册 |
| **L** | **循环模式三态切换** | 本组件注册 |
| **T** | **记录时间戳笔记** | 本组件注册 |
| **C** | **切换字幕轨道** | 本组件注册 |
| F | 全屏（网页全屏） | 本组件已注册 |
| M | 静音 | 本组件已注册 |
| 双击画面 | 全屏 | 本组件已注册 |

### 3.3 快捷键说明浮层

控制条「⌨」按钮（index 80）→ 右上角深色卡片（仿播放器风格，点 [×] 或浮层外关闭）：

```
┌─────────────────────────────────┐
│ 快捷键                     [×]  │
│ ─────────────────────────────── │
│ 空格    播放/暂停   ↑/↓  音量   │
│ ←/→     快退/快进   F    全屏   │
│ N/P     上一集/下一集 M    静音  │
│ L       循环模式     Esc  退出  │
│ T       时间戳笔记   C    字幕   │
│ 双击    全屏                    │
└─────────────────────────────────┘
```

不在画面常驻——解决"常驻提示条很丑"的反馈。

---

## 四、多字幕支持（新增需求）

### 4.1 字幕来源

- 主字幕：与视频同目录的**同名 .srt / .ass / .vtt 文件**（`视频名.srt`），由 Rust `list_media_in_dir` 一并发现（扩展名过滤补充字幕三类），或
- 内嵌字幕：`media://` 直连（若文件内嵌轨，ArtPlayer 走 `<track>` 机制）

### 4.2 多轨道切换

- 控制条「CC」按钮（index 54）→ 弹出字幕轨道选择浮层：

```
┌────────────────────────┐
│ 字幕                [×] │
│ ────────────────────── │
│ ● 中文（默认）          │
│ ○ English              │
│ ○ 关闭字幕              │
└────────────────────────┘
```

- 实现：`art.subtitle.switch(url, { name, type })`（`subtitle.switch` 返回 Promise，切换时 notice 提示「切换字幕: xxx」）
- `subtitle.url` setter 亦可切轨；`art.option.subtitle.url = ""` + 移除 track = 关闭字幕
- 快捷键 **C** 轮询轨道

### 4.3 字幕位置：上下可切换

- ArtPlayer 字幕容器 `.art-subtitle` 用 `bottom: var(--art-subtitle-bottom)` 定位（默认 15px）
- **位置控制**：`art.subtitle.style({ bottom: "calc(100% - 80px)" })` 把字幕推到**画面顶部**；或改 CSS 变量 `--art-subtitle-bottom`
- **UI**：字幕选择浮层内提供位置切换（下 / 上）：

```
│ 字幕位置:  [○ 下方] [● 上方]   │
```

- 快捷键 **X** 切换字幕上/下位置（与 C 分开，避免误触）

### 4.4 字幕格式

ArtPlayer 内置 srt → vtt、ass → vtt 转换（`TextDecoder` + `srtToVtt`/`assToVtt`），url 直接给本地文件即可，无需前端预处理。

---

## 五、MP3 / 音频支持

### 5.1 类型接入

- `src/types/index.ts`：`FileKind` 增加 `"audio"`
- `src/stores/index.ts`：`MEDIA_EXTENSIONS` 增加 mp3 / m4a / wav / flac / ogg → `"audio"`
- `isMediaKind` 增加 `"audio"`（音频也走预览模式）
- `src/components/Content/PreviewView.tsx`：`fileKind === "audio"` → 渲染 `VideoPlayer`（复用同一组件）

### 5.2 渲染

- 复用 ArtPlayer：`url: media://.../song.mp3` 直接播放（`<video>` 元素播音频，音量/进度/倍速/循环全可用）
- **视觉**：音频无画面 → 传 `poster` 封面图（同名 .jpg/.png 封面文件，若有）或居中音符图标占位，避免黑屏
- 播放列表天然包含音频（同目录视频+音频混合列表），`switchUrl` 视频↔音频切换无障碍

---

## 六、时间戳笔记联动（一期）

### 6.1 交互

- 控制条「📝 笔记」按钮（index 56）+ 快捷键 **T**
- 按 T → 播放器暂停 → 弹出小输入框（仿 capture 风格）→ 回车保存 → 恢复播放

```
┌─────────────────────────────────┐
│ 📝 记录 @ 12:34    [取消] [保存] │
│ 在 02:15 处讲到了状态机互斥……    │
└─────────────────────────────────┘
```

### 6.2 保存去向（两处可选，记录时切换）

- **A. 写入 inbox**：复用 `append_inbox`（`src-tauri/src/commands/capture.rs`），内容格式 `[视频名 @12:34] 笔记`，与快速捕获同源
- **B. 插入当前 md 编辑器**：复用 `getActiveEditorView()`（`src/editors/editorRef.ts`）+ CodeMirror `dispatch` 在光标处插入 `[视频名 @12:34] 笔记`（markdown 里时间戳即超链接锚点）

### 6.3 二期（另行评估，不在本期范围）

- 截屏：Tauri `WebviewImage` 对整窗截图在 WKWebView 有限制；视频帧截取需 Rust 引入解码库（ffmpeg），工程量中等偏大
- 建议先做「时间戳 + 文字笔记」（一期），截屏作为独立功能评估（二期）

---

## 七、实现文件清单

| 文件 | 改动 |
|---|---|
| `src-tauri/src/commands/directory.rs` | 新增 `list_media_in_dir`（媒体文件 + 字幕文件发现，注册白名单） |
| `src-tauri/src/lib.rs` | 注册 `list_media_in_dir` 命令 |
| `src/components/Content/VideoPlayer.tsx` | 播放列表状态 + 三态循环 + 字幕切换/位置 + 快捷键 N/P/L/C/X/T + 控制条自定义控件（播放列表/循环/字幕/笔记/快捷键说明）+ 浮层（播放列表抽屉/字幕选择/快捷键说明/笔记输入） |
| `src/components/Content/PreviewView.tsx` | `fileKind === "audio"` 分支复用 VideoPlayer |
| `src/types/index.ts` | `FileKind` 加 `"audio"` |
| `src/stores/index.ts` | `MEDIA_EXTENSIONS` 加音频；`isMediaKind` 加 audio |
| `src/__tests__/fileKind.test.tsx` | 音频类型测试 + 播放器增强测试 |

---

## 八、待办与风险

- [ ] 一期：Rust `list_media_in_dir` + 前端播放列表/循环/字幕/快捷键/音频/时间戳笔记
- [ ] 二期：截屏 + 学习记录（另行评估）
- 风险：`video:ended` 与 `option.loop` 竞争（已用状态机规避）；字幕轨道文件名约定（同名 .srt/.ass/.vtt）需在 UI 说明；媒体文件多时 `flatten_files` 截断阈值（2000）不适用——`list_media_in_dir` 只列同目录，无截断问题