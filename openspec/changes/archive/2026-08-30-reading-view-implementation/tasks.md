# Tasks: reading 域规格落地

## 1. 基础对齐（A-6 字号 / A-2 任务列表）

- [x] 1.1 默认字号统一 17px：`src/stores/editorStore.ts`（fontSize 初始 17）、`src/hooks/useConfig.ts`（加载回退 `?? 17`）、`src/styles/editor.css`（`:root { --editor-font-size: 17px }`）、`theme-light/dark.css`（删除独立 `--reader-font-size`，`.preview-view` 改引用 `--editor-font-size`）、`src-tauri/src/config.rs`（Rust 侧默认值同步）
- [x] 1.2 预览固定倍率层级：`.preview-view h1`~`h6`、`pre/code` 按 1.85/1.6/1.4/1.25/1.15/1.1/0.9 倍 `calc(var(--editor-font-size) * N)` 写入主题 CSS（亮/暗两套），编辑态 cm-heading 装饰比例不动
- [x] 1.3 任务列表修复：`src/renderers/markdown.ts` DOMPurify `ALLOWED_TAGS` 放行 `input`、`ALLOWED_ATTR` 放行 `type/checked/disabled` + `afterSanitizeAttributes` hook 强制仅保留 `input[type=checkbox][disabled]`；CSS 补 `.preview-view input[type=checkbox]` 与 `li.task-list-item` 无符号对齐样式
- [x] 1.4 HTML 预览 rem 注入：`src/components/Content/HtmlPreview.tsx` 订阅 `useEditorStore.fontSize`，srcdoc 头部注入 `<style>html { font-size: ${fontSize}px; }</style>`，字号变化重建 srcdoc

## 2. A-9 数据层：scrollPos 保存/恢复

- [x] 2.1 `src/types/index.ts` `Tab` 增加 `contentHeight: number`；`src/stores/index.ts` 新增 `updateScrollPos(tabId, scrollPos, contentHeight)` action（更新 tab 字段 + 触发 200ms debounce 保存）
- [x] 2.2 持久化：`src-tauri/src/config.rs` 新增可选字段 `scroll_positions: HashMap<String, {scroll_pos, content_height}>`（serde default 兼容缺省）；`src/hooks/useConfig.ts` load/save 同步 `scrollPositions`（saveConfig 复用现有通道）
- [x] 2.3 保存时机：`ContentArea` 滚动容器 scroll 监听 → 停止 200ms debounce 调 `updateScrollPos`（rAF 节流读取）；`switchTab` / `closeTab` 时立即写入；`src-tauri` 窗口关闭场景用 `getCurrentWindow().onCloseRequested` 先 `saveConfig()` 再放行关闭
- [x] 2.4 恢复逻辑：`openFile`（新建或复用 tab）与 `switchTab` 后，内容挂载完成时按记录恢复——`contentHeight` 与实际 `scrollHeight` 一致（±1px）像素跳转、不一致按百分比、无记录跳顶部；恢复点放在 ContentArea 内容渲染 effect

## 3. A-9 UI 层：墨线组件

- [x] 3.1 新增 `src/components/Content/ReadingProgressInk.tsx`：绝对定位右边缘（right 3px / 宽 2px / 高铺满滚动容器），内部已读段 `rgba(0,0,0,0.14)` + 未读段 `rgba(0,0,0,0.04)`，滚动监听 rAF 约 16ms 节流更新进度
- [x] 3.2 ContentArea 挂接：墨线作为滚动容器子元素，仅 `editorMode === "preview"` 且 `!readingMode` 时渲染；分屏时各 pane 各自挂接（编辑+预览分栏仅预览侧显示）
- [x] 3.3 墨线 CSS 进 `theme-light.css` / `theme-dark.css`（`.preview-view` 滚动容器 relative 定位 + 墨线样式与明暗主题适配）

## 4. A-5 沉浸阅读

- [x] 4.1 快捷键：`src/App.tsx` `Cmd+\` 由"切换左侧栏"改为 toggle `readingMode`（侧栏切换保留工具栏按钮）；新增 `Shift+Cmd+T` 沉浸态内 toggle chrome（store 字段 `immersiveChromeVisible`，退出沉浸复位）；Esc 退出逻辑保留
- [x] 4.2 沉浸 class 驱动：App 根容器加 `immersive` class（`readingMode` 时）；Toolbar / Layout 侧栏+分隔条 / ContentSplitView TabBar 行（含 ModeButtons）/ SplitResizeHandle 加 `app-chrome` class；CSS `.app-chrome { transition: opacity .3s ease, visibility .3s }` 与 `.immersive .app-chrome { opacity: 0; visibility: hidden; pointer-events: none }`，主文档区不参与过渡
- [x] 4.3 沉浸浮出：顶部 2px 热区（fixed，z-index 50）常驻；hover 400ms 加 `immersive-peek` class 显示 chrome，移出 2s 后移除；`Shift+Cmd+T` 与 peek 互不覆盖（任一为 true 即显示）
- [x] 4.4 沉浸态联动：进入沉浸不触发任何文件操作（现状已满足，补充验证）；退出沉浸墨线恢复显示（依赖 3.2 的 `!readingMode` 条件，自动满足）

## 5. 测试

- [x] 5.1 vitest（`src/__tests__/`）：scrollPos debounce 保存与像素/百分比恢复判定（fake timers）、墨线进度计算节流、`Cmd+\`/`Shift+Cmd+T` 映射、DOMPurify 任务列表白名单与非法 input 剥离
- [x] 5.2 E2E（`e2e/tauri/`）：沉浸进入/退出（mock 桥驱动 store）、墨线在预览模式存在/编辑模式不存在、恢复路径（打开同文件回到记录位置）

## 6. 验证与交付

- [x] 6.1 `npx tsc --noEmit` + `npx eslint src/` + `npm test` 全绿
- [x] 6.2 `bash scripts/verify.sh` 全绿（含 CSS manifest、cargo check、两套 Playwright）
- [x] 6.3 `npm run tauri dev` 手动走查 reading 规格 A-5/A-6/A-9 全 scenario（沉浸进出与浮出、墨线显隐与分屏归属、位置恢复、倍率层级、任务列表勾选、HTML rem 跟随），结果用功能说明性语言记录