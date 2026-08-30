# Proposal: 视频预览播放器（media:// Range 流式 + ArtPlayer 交互）

## Why

`file-format-support`（C-1）已规定媒体类文件以预览模式打开、视频可播放，但缺完整播放器交互规格：大文件 seek 依赖 media 协议 Range 流式；控制条/快捷键/记忆播放/全屏无统一实现。另有实测问题：`convertFileSrc` 在无 Tauri 环境（浏览器 dev / 无 mock e2e）下同步抛错击穿渲染树导致整页白屏，视频分支需要与其他媒体一致地优雅降级。

## What Changes

- **视频预览接入 ArtPlayer**：`PreviewView` 的 video 分支改为渲染 `VideoPlayer` 组件（ArtPlayer 封装）——自定义控制条、快捷键（空格 播放/暂停、←/→ 快退快进 5s、↑/↓ 音量、F 全屏、M 静音，仅播放器聚焦时生效）、记忆播放位置（ArtPlayer 内置 autoPlayback，localStorage 记录）、网页全屏（`fullscreenWeb`，规避 macOS WKWebView 原生全屏不可靠）。
- **media:// Range 流式播放**：视频经 `media://localhost/<path>` 协议加载（`media_protocol.rs` 已支持 Range 206），绕过 asset 协议 1MB Range 上限；打开预览时经 `register_media_path` 注册路径到 media 白名单。
- **Web 模式优雅降级**：`isTauriEnv()` 守卫 `convertFileSrc`/`invoke` 调用，非 Tauri 环境视频分支显示降级提示而非抛错白屏（与图片/PDF 占位一致）。

## Capabilities

### New Capabilities

<!-- 无新能力 -->

### Modified Capabilities

- `file-management`：C-6 新增「视频预览播放器」需求——media:// Range 流式、ArtPlayer 交互（快捷键/记忆播放/网页全屏）、Web 模式降级。

## Impact

- 新增依赖 `artplayer`（package.json）。
- 新增组件 `src/components/Content/VideoPlayer.tsx`；`PreviewView` video 分支改渲染播放器（替换原裸 `<video>`）。
- 复用既有 `register_media_path`（lib.rs）与 `media_protocol.rs` Range 实现，无后端新命令。
- 修复同源问题：`isTauriEnv()` 守卫统一 `convertFileSrc`/`invoke` 调用点（HtmlPreview / PreviewView / useConfig），非 Tauri 环境不崩溃。