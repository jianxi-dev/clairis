# Tasks: 视频预览播放器

## 1. 播放器组件

- [x] 1.1 新增 `src/components/Content/VideoPlayer.tsx`（ArtPlayer 封装）：打开预览时经 `invoke("register_media_path", { path })` 注册 media 白名单（`.catch` 吞错）；ArtPlayer 初始化（autoplay / autoSize / fullscreenWeb / autoPlayback / hotkey / zh-cn / playsInline）；双击与 `KeyF` 切换网页全屏、`KeyM` 静音；`video:error` 显示错误提示；卸载 `art.destroy(false)`；顶部快捷键提示条。验收：`npm run tauri dev` 打开视频可播放、可全屏、可记忆位置。
- [x] 1.2 在 `src/components/Content/PreviewView.tsx` 将 video 分支改为渲染 `VideoPlayer`（替换裸 `<video>`）。验收：`fileKind.test.tsx` 视频用例断言 `.art-video-player` 与 `media://` src 通过。

## 2. media:// 协议对接

- [x] 2.1 统一 media:// URL 编码：`mediaUrlForPath` 按路径段编码保留斜杠，`media_protocol.rs` `decode_uri_path` 仅解码一次并规范化后与注册白名单精确比较。验收：视频经 media:// Range 流式可 seek；Rust 单测（`parse_range` / `decode_uri_path` / handler 白名单）全绿。
- [x] 2.2 打开预览时注册媒体路径到白名单（复用 `register_media_path` 命令，无新后端命令）。验收：未注册路径 404、注册后 200/206（Rust 单测覆盖）。

## 3. Web 模式守卫（崩溃修复）

- [x] 3.1 新增 `src/utils/tauri.ts isTauriEnv()`（检查 `window.__TAURI_INTERNALS__`）。验收：jsdom 环境可正确判定。
- [x] 3.2 `HtmlPreview` / `PreviewView`（PDF、图片）/ `useConfig` 的 `convertFileSrc` / `invoke` 调用点加守卫：非 Tauri 环境优雅降级（HTML 回退 srcdoc 禁脚本 CSP、媒体显示占位提示、配置落默认值）。验收：浏览器 dev 模式打开 html/pdf/图片不再白屏；控制台无 `convertFileSrc` / `invoke` 抛错。

## 4. 测试

- [x] 4.1 更新 `fileKind.test.tsx` 视频用例：断言渲染 ArtPlayer 容器与 `media://` src。验收：`npx vitest run src/__tests__/fileKind.test.tsx` 通过。
- [x] 4.2 新增 `webModeFallback.test.tsx`：非 Tauri 下 html（srcdoc + 禁脚本 CSP）、PDF、图片占位、Tauri 下 asset 直载。验收：4 用例全绿。
- [x] 4.3 新增 `useConfig.webFallback.test.tsx`：非 Tauri 下载入分支落默认配置、`saveAppConfig` 早退不抛错。验收：2 用例全绿。
- [x] 4.4 `npm test` 全量通过（含既有 298 用例）。验收：无回归。

## 5. 交付验证

- [x] 5.1 `npx tsc --noEmit` 通过；pre-commit（prettier / eslint / css-manifest）通过。验收：无类型错误、无 lint 告警。
- [x] 5.2 浏览器层 QA（:1420 Web 模式）：html/pdf/图片/视频打开不白屏、控制台零崩溃错误。验收：QA 报告记录 2 个问题修复（ISSUE-001/002）后全绿。