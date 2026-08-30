# Design: 视频预览播放器落地

## Context

file-management C-1 规定媒体类文件以预览模式打开、视频可播放。现状：
- `PreviewView` video 分支用裸 `<video>` + `media://localhost/` URL（`media_protocol.rs` 已支持 Range 206 分片），无控制条/快捷键/记忆播放。
- `mediaUrlForPath` 用 `encodeURIComponent(整路径)` 构造 media:// URL；`media_protocol::decode_uri_path` 解码后重新前置 `/`。经实测核对：连斜杠一起编码时解码还原单斜杠再补前缀会产生双斜杠路径，与注册白名单（单斜杠）精确匹配失败 → 生产 404（回归测试用未编码路径故未暴露）。本变更一并统一编码约定：后端只解码一次、规范化后与注册路径比较。
- 非 Tauri 环境（浏览器 dev server :1420、无 mock e2e）：`convertFileSrc` 访问 `__TAURI_INTERNALS__` 同步抛 TypeError → 击穿渲染树整页白屏（实测）。图片/PDF 分支已有守卫占位，视频分支缺失。

约束：规格权威；vitest 只收 `src/__tests__/`；媒体二进制不读入前端内存；`npm run tauri dev` 为 UI 验收唯一入口。

## Goals / Non-Goals

**Goals**
- 视频预览具备完整播放交互：控制条、快捷键、记忆播放、全屏。
- 大视频可 seek（media:// Range 流式，不整文件读入内存）。
- 非 Tauri 环境不崩溃（优雅降级，与图片/PDF 一致）。

**Non-Goals**
- 不实现字幕/倍速/画中画等高级播放器能力（ArtPlayer 后续可扩展）。
- 不新增后端命令（复用 `register_media_path` 与 `media_protocol.rs`）。

## 方案

### 1. 播放器组件（ArtPlayer 封装）

`VideoPlayer.tsx`：
- `useEffect` 打开预览时 `invoke("register_media_path", { path })` 注册 media 白名单（`.catch` 吞错，防非 Tauri 报错）。
- ArtPlayer 初始化：`url=media://…`、`autoplay`、`autoSize`、`fullscreen:false`（WKWebView 原生全屏不可靠）+ `fullscreenWeb:true`、`autoPlayback:true`（localStorage 记忆播放位置）、`hotkey:true`、`lang:"zh-cn"`、`moreVideoAttr:{playsInline:true}`。
- 双击 → `art.fullscreenWeb` 切换；`KeyF` 全屏 / `KeyM` 静音（ArtPlayer 内置键位无此项）。
- `video:error` → 错误提示「视频加载失败（可能编码不受支持或文件不可访问）」。
- 卸载 → `art.destroy(false)`。
- 顶部快捷键提示条（半透明、pointer-events:none）。

### 2. media:// 编码统一

`mediaUrlForPath(path)` 改为按路径段编码保留斜杠（`encodeURIComponent` 每段），后端 `decode_uri_path` 仅解码一次、`normalize` 后与注册路径精确比较。消除双斜杠 404，且**禁止**以「前缀/模糊匹配」修复（会引入路径穿越）。

### 3. Web 模式守卫

新增 `src/utils/tauri.ts isTauriEnv()`（检查 `window.__TAURI_INTERNALS__`），统一守卫：
- `HtmlPreview` asset 直载 → 非 Tauri 回退 srcdoc（禁脚本 CSP 分支）。
- `PreviewView` PDF/图片 → 非 Tauri 显示「无法预览」占位。
- `useConfig` load/save → 非 Tauri 落默认配置、跳过 invoke。

## 备选方案（已否决）

- **裸 `<video>` + asset://**：asset 协议 Range 上限 1MB，大视频 seek 断裂（file.rs 注释已记录）。
- **srcdoc 内嵌 video**：无真实 URL，Range/seek 依赖内存，大文件不可行。
- **Web 模式直接隐藏视频**：与图片/PDF 占位一致性差，且掩盖守卫问题。

## 测试

- `fileKind.test.tsx`：video 分支渲染 `.art-video-player` + `<video src=media://>`。
- `webModeFallback.test.tsx`：非 Tauri 下 html/pdf/image 不崩溃（守卫回归）。
- `useConfig.webFallback.test.tsx`：非 Tauri 落默认配置。
- 交互回调（dblclick/F/M/video:error）jsdom 不可触发 ArtPlayer 内部事件 → 需真机 E2E（已记 TODO）。