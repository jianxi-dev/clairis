# Code Review — #215（reading-surface-refine 3.1）

- 审查者：Atlas（写者 = Sisyphus-Junior/deepseek-v4.1-flash，跨模型验证分离）
- 基于 HEAD：`8416e01` + 工作区改动（未提交）
- 验证原始输出：tsc exit 0；eslint 0 errors（39 既有 warnings）；vitest 95 files/1227 tests 全过；Playwright floating-preview+reading-rail 16 passed；QG-5 探针 7 态截图+DOM 断言全过（.artifacts/215/state-coverage.json）

## Standards 轴

| 检查项 | 结论 |
| --- | --- |
| 逻辑逐行复核 | ✓ previewAnchor 纯函数（pointInBox/isRightHalfOfBox/shouldScheduleLeaveClose）与 FloatingPreview 全局 pointermove 防抖、timer 清理、ReadingRail hoverZone 去重均逐行读过，无逻辑错误 |
| 边界情形 | ✓ 奇数宽度中线列归右（悬停居中必触发）；249/250ms、179/180ms 边界有测试；关闭前二次校验 pinned/source |
| 反模式扫描 | ✓ 无 as any/@ts-ignore/console.log/TODO/空 catch（媒体 invoke 失败 .catch 静默是白名单注册的合理降级） |
| 资源清理 | ✓ pointermove 监听与 timer 在 effect cleanup 成对释放；hoverZoneRef 在 onRowLeave 复位 |
| 注释 | ✓ 中文注释仅解释非显然决策（zone 去重防计时器重置、sandbox 无 allow-scripts、grid 源保持即关） |
| 文件规模 | FloatingPreview.tsx 506 行（原 ~376，+130）——延续既有单文件组件结构，未拆分；不阻塞，后续如有第二改动点再抽 MediaBody |
| 范围纪律 | ✓ railCards.ts/test 未动（PR #224 保护）；无 #213/#214 已交付域回改；无新增依赖 |

## Spec 轴（逐条对照票面 AC）

| AC | 实现 | 证据 |
| --- | --- | --- |
| 左半区不打开 | handleRowMove zone=left → onRowLeftHalf（关预览、清 timer） | 单测「左半区不打开」+ 探针态 01 |
| 右半区 250ms 打开 | zone=right → onRowEnter（HOVER_DELAY_MS=250） | 单测 249/250ms 边界 + 探针态 02 |
| 离窗 180ms 关闭（钉住/拖拽/缩放豁免，指针在 rail 保持） | FloatingPreview 全局 pointermove + shouldScheduleLeaveClose + PREVIEW_LEAVE_CLOSE_MS=180 | 单测 3 例（179/180、rail 保持、钉住豁免）+ 探针态 03 |
| 媒体 img/video/audio；HTML 沙箱 iframe；PDF 占位 | MediaBody 分类型渲染；iframe sandbox=""；PDF 走占位 | 单测 4 例 + e2e 媒体用例 + 探针态 04/05/06 |
| 三点菜单切换后列表回顶 | rail-scroll ref + effect on [railLayout, railDensity, railChip] | 单测 2 例（密度/布局）+ e2e 菜单链路 + 探针态 07 |

## 结构审查（risk-medium pre-landing）

- SQL：本票无数据库操作 — 不适用
- LLM 信任边界：无新增 dangerouslySetInnerHTML 输入面（preview-doc 渲染路径为既有代码）；HTML 预览 iframe sandbox=""（脚本禁用）— 通过
- 条件副作用：监听器/定时器生命周期成对；关闭动作前重读 store 快照，无过期状态写入 — 通过
- scope drift：diff 限于票面三个接线文件 + 测试 + e2e，无越界 — 通过

## 测试真实链路复核（QG-4）

单测驱动真实 pointermove/mousemove 事件与 store 公共 API，断言计算状态（preview 状态、scrollTop、元素 controls 属性），未直接调用内部函数；e2e 走真实浏览器 hover/click。✓

## 未决项

无（0 未决）。

留痕一处判断：左半区移动对「钉住」预览豁免（钉住语义优先于触发区规则）；spec 未明确该组合，若需左半区连钉住一并关闭，一行可改。
