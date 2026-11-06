# Code Review — #216（reading-surface-refine 4.1）

- 审查者：Atlas（写者 = Sisyphus-Junior/deepseek-v4.1-flash，跨模型验证分离）
- 基于 HEAD：`d8ee642`（含其父提交 9463dd2 = #226 时钟修复，本票未触及该文件）
- 验证原始输出：tsc exit 0；eslint 0 errors（39 既有 warnings）；vitest 96 files/1255 tests 全过；block-handle+block-menu e2e 25 passed；QG-5 探针 5 态 DOM 断言+截图全过（.artifacts/216/state-coverage.json）；css-manifest 88 declared/159 defined，无缺失，新类未 orphaned

## Standards 轴

| 检查项 | 结论 |
| --- | --- |
| 逻辑逐行复核 | ✓ block-color.ts（包裹/换色/清除/幂等/结构块保护）逐行读过；block-handle.ts 召唤区门控；block-menu.ts 颜色行 + flyout；无逻辑错误 |
| 边界情形 | ✓ 纯标记行（`#`/`-`/`>` 无内容）不包裹；空行跳过；嵌套异族 span 剥除不误伤（`[^<]*` 不跨标签）；同族同色幂等返回 null 不产生事务 |
| marked 兼容陷阱 | ✓ 关键设计：包裹只含「标记之后的内容」，整块含 `#` 塞 span 会被 marked 当 HTML 块使标题失效——已在模块注释留痕并有单测钉死 |
| 反模式扫描 | ✓ 无 as any/@ts-ignore/console.log/TODO/空 catch |
| DRY | ✓ 复用既有 color-palette（createColorRow/FONT_COLORS/BACKGROUND_COLORS）与 block-convert 的 MARKER_RE 口径；未造重复色板 |
| 资源清理 | ✓ flyout 面板 pointerenter 挂 cancelPendingClose；颜色应用后 closeBlockMenu；无遗留监听 |
| 范围纪律 | ✓ diff 限于接线三文件 + editor.css + 测试 + e2e；未触碰 preview 侧（如实报告为 follow-up）；无新增依赖 |

## Spec 轴（逐条对照票面 AC）

| AC | 实现 | 证据 |
| --- | --- | --- |
| 左侧 25% 召唤 | isInSummonZone（SUMMON_ZONE_RATIO=0.25，纯几何）+ onDomPointerMove 门控 | e2e「左缘 25% 召唤，右缘 75% 不召唤」+ 探针态 02 |
| 右侧不召唤 | 同上门控的负向断言 | e2e 同用例 + 探针态 01 |
| 滑入 60ms 出菜单 | MENU_INTENT_DELAY_MS 120→60 | e2e「滑入手柄 60ms 内开出块菜单」（59ms 无/60ms 有）+ 探针态 03 |
| 菜单颜色项 | 颜色行 + flyout 二级面板（字体 9 色/背景 16 色），活动色高亮 | 探针态 04 + e2e 面板结构用例 |
| 颜色写入源码 | applyBlockColor → view.dispatch 真实事务；`<span class="mdb-color-red">` 落文档 | e2e「点红色字体色把块内容包进 mdb-color-red」+ 探针态 05（store 源码含包裹） |
| md-bundle 迁移 | md-bundle 源可得（/Users/mason/ToHighs/md-bundle），交互与格式对齐其 flyout 双行色板 + mdb-color-* 约定 | block-color.ts 头注引用 boldItalic.ts 既有识别 |

## 结构审查（risk-medium pre-landing）

- SQL：无 — 不适用
- LLM 信任边界：无新增 HTML 注入面（包裹 span 仅类名插值，类名来自固定色板常量，非用户输入）— 通过
- 条件副作用：dispatch 仅在有变化时（null 短路）；清除/换色/包裹三路径均有幂等护栏 — 通过
- scope drift：预览侧 mdb-color-* 着色规则未迁移——票面 AC 为「颜色写入源码」+「块菜单可选颜色」，编辑态满足；预览着色属渲染增强，留作 follow-up（建议随 4.2 或收尾票处理）— 不阻塞

## 测试真实链路复核（QG-4）

单测钉死包裹字节（真实字符串断言）；e2e 走真实 mouse 事件 + clock 边界（59/60ms）+ store 源码断言；探针同口径。未发现断言「元素存在」代替行为的用例。✓

## 未决项

无（0 未决）。

留痕：预览态 `.preview-content` 的 mdb-color-* 着色 CSS（md-bundle readerCss 26 条）未迁移——票面验收不含预览着色，如需请另开 follow-up 票。
