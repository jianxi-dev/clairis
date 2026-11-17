# 设计：搜索浮窗打磨（search-float-refine）

## Context

- 输入：用户 2026-11-17 反馈 5 项（2 缺陷 + 3 优化，spec issue #1004），需求四要素在 `docs/requirements/search-float-refine/requirements.md`。
- 既有能力：`search-replace-float`（S-1 浮窗形态 / S-2 扫描规则 / S-3 结果列表与行尾快捷键 / S-4 替换与 diff 预览 / S-5 局部快捷键优先级），规格真相源 `openspec/specs/search-replace-float/spec.md`。
- 可复用源：文件卡片悬浮窗 `src/components/Preview/FloatingPreview.tsx` 与其缩放锚定层 `src/lib/previewAnchor.ts`（`RESIZE_EDGES` 8 向、`resizePreview()`、`clampPreviewSize()`、`flipAnchor()`、`PREVIEW_MIN_W=260`/`PREVIEW_MIN_H=200`）。该悬浮窗已验证 8 向缩放 + 最小尺寸钳制 + 贴边翻转，是搜索浮窗壳样式与操作语言的现成范式。
- 快捷键：`src/lib/shortcuts.ts` 局部 scope 机制已接线（`activateLocalContext`），搜索浮窗 ⌘1~9/Enter/↑↓/Esc 的局部优先级（S-5）已落地，本 change 不新增键段。
- 硬约束：CSS manifest（`src/editors/decorations/` 声明的 `cm-*` class 必须有对应 CSS）；模式切换 CSS display 不 remount；交付前 `bash scripts/verify.sh` 全绿。

## Goals / Non-Goals

**Goals：**
- 浮窗壳样式与操作语言对齐悬浮预览窗：8 向缩放、标题栏拖动、视觉范式（surface 底、border、圆角、投影）。
- 缺陷修复：选中行即显示 ⏎；点击定位在浮窗所属窗格内生效（编辑态与预览态）。
- 行内容上下文片段预览态轻量渲染，命中高亮保留。
- 状态栏快捷键说明 + 自动显隐。

**Non-Goals：**
- 语义搜索（原型「分期 · 示意」，不属本期）。
- S-2 扫描规则、S-4 替换与 diff 预览、S-5 局部快捷键优先级的规格陈述与行为变更（仅随缺陷复现顺手核对）。
- 悬浮预览窗（FloatingPreview）自身任何改动——只复用不修改。
- 浮窗位置三档配置、尺寸/位置会话内优先语义的变更（本 change 保留既有语义）。

## Decisions

### D1 缩放逻辑复用 previewAnchor，不另写一套

搜索浮窗的 8 向缩放直接复用 `src/lib/previewAnchor.ts` 的 `RESIZE_EDGES`/`resizePreview`/`clampPreviewSize`，壳层只负责把指针事件转换为 `resizePreview` 的入参并落会话内尺寸状态，禁止在 `SearchReplacePanel` 内另写一套缩放实现。

**理由**：FloatingPreview 的 8 向缩放 + 最小尺寸钳制已验证且稳定，复用保证两窗操作语言一致、避免两套实现随时间漂移。这符合 `docs/agents/code-structure.md` 的两层分离思想：锚定/几何计算层（previewAnchor）与壳渲染层（各浮窗组件）分离，几何逻辑只维护一份。

**兼容处理**：previewAnchor 的默认最小尺寸是 `PREVIEW_MIN_W=260`/`PREVIEW_MIN_H=200`，而搜索浮窗默认尺寸为宽 `min(600px, calc(100% - 48px))`、高 460px。调用 `resizePreview`/`clampPreviewSize` 时显式传入搜索浮窗的最小尺寸（建议宽 320、高 240，保证列表可读），不直接套用默认值，避免默认浮窗被误钳。

### D2 状态栏自动显隐触发语义

状态栏默认可见；浮窗打开即显示。指针离开浮窗且浮窗失焦约 2 秒后自动隐藏；指针重新悬停浮窗或浮窗重新获得焦点时恢复显示。

**理由**：用户明确要求「自动显隐」，原型中状态栏为常显，两者差异是显式设计决策。自动显隐让状态栏在用户浏览结果时降低视觉干扰，需要看快捷键说明时悬停即可唤回。2 秒延迟避免指针短暂掠过浮窗边缘时的闪烁。

**触发条件细化**：隐藏需同时满足「指针离开浮窗」+「浮窗失焦」；任一恢复（悬停或聚焦）即重新显示。替换态下状态栏可选追加替换操作提示（逐个/全部替换），追加内容不改变显隐语义。

### D3 定位窗格归属修复

`locate()` 改用浮窗所属 panelId 的编辑器视图：编辑态用 `getEditorView(panelId)` 取所属窗格的 `EditorView` 做选区与滚动，预览态在所属窗格的预览容器（`.preview-content`）内做文本树滚动定位。

**同一根因的完整覆盖（G1 复现后追认）**：复现确认缺陷机制为「浮窗编辑器解析走全局 `getActiveEditorView()`（lastActivePanel 漂移时回退 "main"）」。该机制同样影响 `replaceOne`/`replaceAll`（本窗格偏移 dispatch 到他窗格 = 内容破坏）与关闭还焦。故 D3 的落地范围为组件内**全部四处**编辑器解析统一 `getEditorView(panelId)`——替换的 dispatch 目标属浮窗窗格归属问题，不是 S-4 替换算法/事务语义的变更（`buildReplaceChanges`/`applyReplaceChanges` 与单事务/可撤销语义未动），Non-Goals 所指的「S-4 行为变更」不包含本修正。

**理由**：现状 `locate()` 走全局 `getActiveEditorView()`（最近聚焦编辑器），在分栏或焦点漂移场景下会把命中定位到错误窗格，是缺陷 4（点击行不能定位）的嫌疑根因。G1 真机复现确认后按此修复。预览态同理限定在所属窗格的预览容器内，避免跨窗格滚动。

### D4 行内轻量渲染：新建轻量 renderer，不引入整块解析

`src/renderers` 现有能力为整块渲染（`renderMarkdown`）与代码块高亮（`highlightCodeBlock`），无现成行内轻量渲染能力。按本决策新建轻量行内 renderer（建议落 `src/renderers/inline.ts`），接口与边界如下：

```ts
// src/renderers/inline.ts（新建）
export interface InlineHit {
  from: number; // 命中区间起点（字符偏移，相对输入文本）
  to: number;   // 命中区间终点
}

/**
 * 行内轻量渲染：将片段文本按行内 Markdown 语法渲染为 HTML。
 * 只处理行内语法（**加粗**、*斜体*、`行内代码`），不渲染块级/标题语法
 * （# 等标题符号按普通文本处理，不显示源码符号）。
 * 命中区间 [from, to) 包裹 <mark>，命中高亮保留。
 * 输入先 HTML 转义，输出仅含内联语义标签（b/i/code/mark）。
 */
export function renderInlineWithHit(text: string, hit?: InlineHit): string
```

**实现约束**：先转义、用占位符标记命中区间、再做行内语法渲染、最后把占位符替换为 `<mark>`，避免渲染偏移导致命中区间错位。不引入 markdown 全量解析器渲染整块结果行（结果行是片段，整块渲染会引入块级语义与不必要开销）。

**理由**：结果行是两行上下文片段，只需行内语义即可达到「预览态观感」，整块解析既重又可能引入块级样式干扰列表布局。

## 数据面

信号命中「快捷键」关键词（状态栏展示快捷键说明），按契约填六栏。结论：**无可配置面变更**——状态栏为固定文案的纯展示，不新增配置字段；下表逐栏写明真实落点与「不改」判据：

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | D1；D2；D3；D4 | —（规格行为见 delta S-1/S-3/S-6，无新增配置条款） | 快捷键说明为固定展示文案（非可配置项），S-6 场景断言其文案内容 |
| 存储 | src-tauri/src/config.rs | AppConfig | 本 change 不触及 config.rs（无新增键）；状态栏显隐为组件内瞬态状态，不落盘、不持久化 |
| 校验 | src/lib/shortcuts.ts | activateLocalContext | 仅核对既有注册，不新增；⌘1~9/Enter/↑↓/Esc 均为 S-5 既有注册项，本 change 不新增/不移除快捷键注册 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 本 change 不触及；无配置热应用改动，浮窗默认位置三档沿用既有设置字段，不新增键 |
| 消费 | src/components/Content/SearchReplacePanel.tsx | SearchReplacePanel | 状态栏节点为组件内常量（原型快捷键说明），不读 AppConfig、不建新数据文件 |
| 回滚 | git revert 本 change 各票 commit 即整体回退 | —（无数据写入路径） | 显隐状态为瞬态（无快照需求）；配置面零改动，回退 = revert commit，无缺省回落路径引入 |

## Risks / Trade-offs

- **8 向缩放与默认尺寸兼容性**：previewAnchor 默认最小钳制（260×200）小于搜索浮窗默认尺寸（600×460），调用时需显式传搜索浮窗的最小尺寸（D1 兼容处理）；若忘记传入，默认浮窗可能被误钳到预览窗最小值。应对：壳层封装统一的 `resizeSearchFloat` 包装函数，内部固定传入最小尺寸，单测覆盖默认尺寸不被误钳。
- **点击定位窗格归属的根因未定性**：D3 的修复基于嫌疑根因，需 G1 真机复现先确认「分栏/焦点漂移下定位错格」确实由 `getActiveEditorView()` 引起，再按 D3 落地；若 G1 发现另有根因，D3 按新根因修订。
- **行内渲染与命中高亮的嵌套**：命中词可能本身是行内语法的一部分（如命中 `**加粗**` 中的词），占位符方案需保证 `<mark>` 正确包裹命中子串而非整个语法块。应对：行内渲染单测覆盖命中在加粗/行内代码内的边界。
- **状态栏显隐的抖动**：指针在浮窗边缘反复进出可能触发显隐抖动。应对：2 秒延迟 + 「悬停或聚焦任一恢复即显示」的单向恢复逻辑，避免反复。
- **CSS manifest 违规**：壳样式收敛会新增/调整 `search-float-*` class，交付前 `verify.sh` CSS manifest 机检。

## Migration Plan

1. 1.1 浮窗壳样式与 8 向缩放复用（壳重构 + previewAnchor 接线）→ 2. 1.2 行尾快捷键与点击定位缺陷修复 → 3. 1.3 状态栏自动显隐 + 行内容预览态渲染 → 4. 2.1 集成验收与交付（`npm run tauri dev` 手动走查 + `verify.sh`）。
- 每步可独立合入 main：壳样式与缩放先行（纯视觉/操作层，不改变定位与快捷键语义），定位修复随后（行为修复），状态栏与行渲染最后（新增展示层）。
- 回滚：各步均为对既有组件的修改，回滚对应步骤改动即可；无配置迁移，无数据兼容问题。

## Open Questions

- G1 真机复现对缺陷 4（点击定位）的根因确认：若确认是 `getActiveEditorView()` 全局定位所致，按 D3 落地；若另发现根因（如预览态容器选择问题），D3 修订后再落。
- 状态栏替换态追加提示（逐个/全部替换快捷说明）是否纳入本期：proposal 标记为「可选」，拆票时由维护者裁定是否进 1.3；若不纳入，1.3 仅交付搜索态快捷键说明与显隐。
