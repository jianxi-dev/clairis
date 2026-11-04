# layout-portal 需求四要素（What / Why / Scope / Non-goals）

> 输入源：spec issue [#170](https://github.com/jianxi-dev/clairis/issues/170)（to-spec 归一化产物）；
> 批准设计 `docs/design/approved/layout-portal/spec.md`（布局规格 v1.0，构建依据）；
> 原型 biaoyue-prototype-v11（决策票 #31 十二轮迭代定稿）；路线图阶段 3「空间与入口」。

## What

把标月桌面端从「顶栏 + 单双栏内容区」升级为布局规格 v1.0 的全量空间形态：门户启动首屏、工作区 pane 递归树、阅读空间竖排栏（三态/双布局/三密度/卡片规格）、网格概览（bento + 键盘导航）、悬浮预览窗、AI 两形态（小窗⇄停靠，共享历史）、设置左导航 10 区、扩展拖入即用、universe-icon 图标体系、完整快捷键家族。全部视图状态按视图规格 json 持久化、可快照回滚、AI 可改。

## Why

- 用户无法按「空间」组织阅读与写作：启动即进工作区、无门户回到现场、无网格批量浏览、无悬浮预览、AI 不可常驻停靠（路线图阶段 3 的验收缺口）。
- 已批准设计与原型定稿（#31），Wayfinder #22 裁定实现走实现期 OpenSpec change——本 change 即该裁定的落地。
- AI 可塑（P4）与可逆（P5）哲学要求视图层全部文本化、可回滚，这是 AI 改布局能力的前提面。

## Scope

12 条构建验收（规格 §14）中除第 12 条外的全部：门户四块；工作区 pane 树全量（分裂/页签/全屏/拖拽换位/四向落区/持久化）；阅读空间全量（三态/双布局/三密度/卡片规格/滑杆/搜索）；网格全量（下拉控件/bento 三型/缩略图/键盘导航/动态编号）；悬浮窗全量（真内容/缩放/锚定/拖动/双开关）；AI 两形态 + 确认卡撤销 + 视图改写；设置 10 区 + 跟随系统外观；扩展管理面（拖入即用/导出/AI 生成）；图标体系；快捷键家族 + `?` 总览；哲学 12 红线核查。

## Non-goals

- 语音输入与 ASR 引擎选型（规格 §15 延后）
- 本地 LLM / 多 agent（规格标「规划中」）
- 生成物离线单文件（验收第 12 条，contentweave/阶段 2，另行 change）
- omarchy 主题联动具体事件映射（规格 §15）
- web 表面 / 商业化 / 仓库级改名（独立 change）
- 斜杠菜单分类重构（G-01，另立 change）
- ⌘P 统一文件面板行为变更（沿用 navigation 域现行规格）

## L-1 需求输入门自检（五条契约）

| 契约 | 状态 | 证据 |
|---|---|---|
| 来源可追溯 | ✅ | 批准设计 spec.md（2026-11-01 定稿）+ 原型 #31 + Wayfinder #22 Destination 明示「实现走实现期 OpenSpec change」 |
| 空白显式化 | ✅ | 规格 §15「未定/延后」三条（ASR 引擎 / 本地 LLM / omarchy 映射）全部进入 Non-goals，不阻断任何规格条目 |
| 一手证据 | ✅ | 原型 biaoyue-prototype-v11 线框定稿 + #31 十二轮迭代决议；规格含全部具体值（240px/285×260/72×54/250ms 等） |
| 冲突显式 | ✅ | 与 application-shell「无侧栏」的冲突已由 ADR 0009（collapsible-reading-rail-supersedes-no-sidebar）裁定；⌘P 行为沿用 navigation 现行规格不改 |
| 验收锚点 | ✅ | 12 条构建验收 + 规格 §2–§13 全部具体值，已落 `openspec/changes/layout-portal/anchors.md`（机读层 conformance.json 由 cw-conformance.sh 生成） |

本 change 为 UI 全量改造（ui-surface），不适用 no-ui-impact 豁免。
