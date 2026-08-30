# Design: reading 域规格落地

## Context

`openspec/specs/reading/spec.md` 已批准一月有余（A-1~A-9），但实现仅覆盖 A-1/A-3/A-7/A-8 与 A-6 的快捷键骨架。现状：

- 沉浸（A-5）：`readingMode` store 字段 + 工具栏按钮 + Esc 退出 + `!readingMode` 条件渲染隐藏 Toolbar；Layout 侧栏、TabBar、分割线不受影响。
- 墨线/进度（A-9）：无任何实现；`Tab.scrollPos` 字段存在但零读写。
- 字号（A-6）：`Cmd+=/-`、12-32 钳制、config.json 持久化已有；默认 16px（规格 17px）；预览无倍率层级；HtmlPreview 无 rem 注入。
- GFM（A-2）：marked + DOMPurify 管线正常；任务列表 checkbox（`<input>`）被 DOMPurify 白名单剥除。
- 主题（A-7）、HTML 沙箱（A-3）、大文件 guard（A-8）已达标。

约束：模式切换不 remount EditorView；`cm-*` 新 class 须同步 CSS manifest；vitest 只收 `src/__tests__/`；交付前 `scripts/verify.sh` 全绿；规格为行为真相源，本变更不修改 A-1~A-9 的 requirement。

## Goals / Non-Goals

**Goals**
1. A-5 沉浸阅读按规格落地的全部 scenario（快捷键、0.3s 过渡、chrome 隐藏、悬停浮出、`Shift+Cmd+T`、分屏分割线隐藏）。
2. A-9 墨线 + 滚动位置恢复完整链路（保存时机、恢复策略、显隐规则）。
3. A-6 对齐（默认 17px、预览倍率层级、HTML rem 注入）。
4. A-2 任务列表 checkbox 修复。
5. 补 vitest + E2E 覆盖，`verify.sh` 全绿。

**Non-Goals**
- 不改 reading 规格任何 requirement/scenario（默认值偏差修实现不修规格）。
- 不做代码语法高亮（marked 无 highlight，规格 A-2 只要求"代码块"渲染，不要求高亮）。
- 不做 tab 会话级持久化（重启恢复 tab 列表）——超出 A-9 范围。
- 不优化 A-1 冷启动代码（现有实现已达标，本次仅验收）。

## Decisions

### D1 沉浸态用根 class 驱动，而非条件渲染

**决策**：最外层容器加 `immersive` class（沿 Tailwind 模式：`${readingMode ? "immersive" : ""}`），chrome 元素保持挂载，用 CSS `opacity + visibility + transition` 控制显隐；`.preview-view` 主文档区不参与过渡（不动）。

**理由**：现有 `{!readingMode && <Toolbar/>}` 条件渲染无法做 0.3s 淡出动画（元素卸载即消失），也无法实现"悬停浮出 → 淡入"，因为元素已卸载。class 驱动下 chrome 常驻，进出过渡、peek 都只是 class 切换。

**备选**：React 动画库（framer-motion）→ 引入新依赖，0.3s 简单过渡不值得。

**具体机制**：
- chrome 元素加共享 class：Toolbar → `app-chrome`；Layout 左右侧栏 + resize handle → `app-chrome`；ContentSplitView 的 TabBar 行（含 ModeButtons）→ `app-chrome`；SplitResizeHandle → `app-chrome`。
- CSS：`.immersive .app-chrome { opacity: 0; visibility: hidden; pointer-events: none; }`，`.app-chrome { opacity: 1; visibility: visible; transition: opacity 0.3s ease, visibility 0.3s; }`。
- 沉浸浮出：顶部 2px 热区（`position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 50;`）常驻渲染；`mouseenter` 后 400ms 设置 `peek` 态（根 class `immersive-peek`），`.immersive.immersive-peek .app-chrome { opacity: 1; visibility: visible; }`；`mouseleave` 后 2s 清除 peek。
- `Shift+Cmd+T`：在沉浸态内 toggle `chromeVisible`（独立于 peek，为持久 store 字段退出沉浸后复位），实现"toggle 所有 chrome 显示/隐藏"。

### D2 `Cmd+\` 键位归沉浸，侧栏切换保留按钮

**决策**：按规格 A-5，`Cmd+\` 从"切换左侧栏"改为"切换沉浸"。左侧栏切换仅保留工具栏按钮（可见性持久化逻辑不动）。

**理由**：spec 是行为真相源（A-5 scenario 明确 `Cmd+\` 进入/退出沉浸）；现有 `Cmd+\` 切侧栏无规格依据。侧栏按钮仍在工具栏，功能不丢失。

**风险**：旧用户肌肉记忆 → 按钮 title 仍标注快捷键，ADL（交付说明）里注明。

### D3 墨线为独立组件，挂在 ContentArea 滚动容器

**决策**：新增 `ReadingProgressInk` 组件，渲染于 ContentArea 的滚动容器（`position: relative` 的 flex 容器）内：`position: absolute; right: 3px; top: 0; bottom: 0; width: 2px;`，内部两段（已读段深 `rgba(0,0,0,0.14)` 高度随进度、未读段浅 `rgba(0,0,0,0.04)` 填满剩余）。滚动监听容器 scroll 事件 → rAF 节流（约 16ms）→ `progress = scrollTop / (scrollHeight - clientHeight)` → 已读段 height 更新。

**显隐规则**（规格 + 现状）：
- 仅 `editorMode === "preview"`（编辑/源码隐藏）；
- 仅 `!readingMode`（沉浸隐藏；退出沉浸后恢复显示）；
- 分屏时两个 pane 各自渲染自己的墨线（无分屏时主 pane 自己的滚动容器）。

**挂接点**：ContentArea 已拥有滚动容器 ref（`flex:1; position:relative; overflow:auto` 的 div）。墨线作为该容器的子元素，组件内 `useRef` 监听 scroll/resize。

### D4 滚动位置持久化走 config.json 新增可选字段

**决策**：`Tab` 增加 `contentHeight` 字段（运行时）。持久化：`config.json` 新增可选对象 `scrollPositions: { [filePath]: { scrollPos, contentHeight } }`，Rust `serde(default)` 向后兼容，前端 `useConfig` load/save 同步（复用现有 `saveConfig` 通道，不加新命令）。

**理由**：关闭 tab 时 tab 对象销毁，`tabs[].scrollPos` 只够会话内切换恢复；"关闭再打开恢复"（A-9 scenario）必须跨会话，而 spec 禁止新建 JSON 文件——扩展现有 config.json 是唯一符合约束的路径（同 A-6 "零新文件"精神；A-9 无"零新字段"字样）。

**写入时机**（store action）：
- 滚动停止 200ms debounce：`updateScrollPos(tabId, scrollPos, contentHeight)`（写 tab + 写 config debounce 200ms）；
- 切换 tab / 关闭 tab：立即写（同步更新 store + 触发 scheduleSave 立即落盘）；
- 窗口关闭：`getCurrentWindow().onCloseRequested` 中先 `await saveConfig()` 再放行关闭（避免 beforeunload 异步 invoke 丢失）。

**恢复逻辑**（openFile 已有 tab 复用或新建时）：
- 记录存在且 `contentHeight` 与当前实际 `scrollHeight` 相等（±1px）→ 像素跳转 `scrollTop = scrollPos`；
- 高度不同 → 百分比 `scrollTop = scrollPos / oldContentHeight * newScrollHeight`；
- 无记录 → 顶部。
- 恢复时机：内容挂载后（PreviewView/编辑态切换完成）一次 `scrollTo`；编辑态同样恢复（scrollPos 属于 tab 而非模式）。

### D5 字号真相源统一为 `--editor-font-size`，默认 17px

**决策**：
- `src/stores/editorStore.ts` 默认 `fontSize: 17`；`useConfig` 加载回退 `raw.fontSize ?? 17`；`src-tauri/src/config.rs` 默认值同步 17。
- 删除 `theme-light/dark.css` 中独立的 `--reader-font-size`，`.preview-view` 改引用 `--editor-font-size`（主题文件只留排色）。
- 预览倍率：`.preview-view h1 { font-size: calc(var(--editor-font-size) * 1.85); }`（H2 1.6 / H3 1.4 / H4 1.25 / H5 1.15 / H6 1.1 / pre, code 0.9），编辑态 cm-heading 装饰比例不动（编辑态是编辑视觉，非排版）。

**HTML rem 注入**（A-6 scenario）：`HtmlPreview` 的 srcdoc 头部注入 `<style>html { font-size: ${fontSize}px; }</style>`；组件订阅 `useEditorStore.fontSize`，字号变化重建 srcdoc（content 相同仅注入值变）。srcdoc iframe 与父页面同源，rem/em/% 跟随；px 本来不受影响。跨域 iframe 场景当前不存在（永远 srcdoc），留作规格约束不实现。

### D6 任务列表白名单修复

**决策**：`renderMarkdown` 的 DOMPurify `ALLOWED_TAGS` 增加 `input`，`ALLOWED_ATTR` 增加 `type/checked/disabled`，但仅在白名单层面放行 checkbox——附加 `ALLOWED_ATTR` 精确到 `input[type=checkbox][disabled]` 无法直接表达，用 DOMPurify 的 hook（`afterSanitizeAttributes`：非 checkbox/disabled 的 input 移除）托底。CSS：`.preview-view input[type=checkbox] { margin-right: 0.4em; transform: translateY(1px); }` `.preview-view li.task-list-item { list-style: none; margin-left: -1.4em; }`（marked 输出 `class="task-list-item"`）。

**安全**：checkbox 不可执行脚本（disabled + type 限制），CSP 不涉及；DOMPurify 兜底清理非受控 input。

## Risks / Trade-offs

- **[暗色主题墨线近乎不可见]** 规格固定 `rgba(0,0,0,…)`，暗底黑线低对比 → 按规格实现（规格权威）；验收走查时若不可接受，作为后续规格修订提议，不在本变更内自行改色。
- **[沉浸态宽度扩展导致主文档重排]**:chrome 淡出后阅读区变宽 → 属预期（沉浸 = 全屏阅读）；墨线随滚动容器宽度自动适应；不做侧栏占位保留（与全屏沉浸目的冲突）。
- **[`Cmd+\` 键位变更影响旧用户]** → 工具栏按钮保留 + title 提示 + CHANGELOG/交付说明注明。
- **[窗口关闭时保存丢失]** → `onCloseRequested` 先保存后关闭；极端进程强杀仍可能丢最后 200ms 滚动，规格无此要求，接受。
- **[汉字/长词换行导致 scrollHeight 波动]** 恢复百分比误差 → 规格阈值 <5%，滚动后墨线即时重算，无累积误差。

## Migration Plan

1. 无数据迁移：config.json 新增字段 `scrollPositions` 缺省即空对象；旧配置可直接读。
2. 部署即本分支；回滚 = revert 分支（config 新增字段对旧版无影响，旧版会忽略）。
3. 验证顺序：vitest（单元）→ `npm run tauri dev` 手动走查 A-5/A-9 全 scenario → E2E → `scripts/verify.sh`。

## Open Questions

- 左侧栏切换快捷键移除后是否需要替代键？（规格无约束；默认不加，按钮已覆盖）
- 暗色墨线对比度问题是否需要在规格层修订？（默认不动规格，验收后再议）