# 需求四要素映射：文档属性面板与字面搜索/替换浮窗

> spec issue：#（创建后回填）｜change：`doc-property-and-search-panel`｜规格真相：`openspec/changes/doc-property-and-search-panel/specs/`（P-1～P-10、S-1～S-5）

## What

1. **frontmatter 属性面板**（`doc-property-panel`）：编辑器/预览页签内容区顶部的文档属性面板——三模式显示（预览只读/编辑默认展开可折叠/源码不渲染）、A 一行条与 B 精排双列两态、八类字段类型与智能编辑、字段行操作与选择模式、标签彩色胶囊与建议输入、自动托管创建/修改日期、属性模板、外部未识别字段收编、⌘⇧Y 显隐。
2. **字面搜索/替换浮窗**（`search-replace-float`）：⌘F 在当前编辑器窗格内弹出自研浮窗替换 CM6 内置面板——双行结果（定位 + 两行上下文）、命中分布条、行尾 ⌘1~⌘9 直达与选中行 ⏎、替换模式 diff 预览与逐个/全部替换（单事务可撤销）、悬停全文预览卡（仅替换模式）、局部快捷键优先（Esc 归还）。

## Why

- frontmatter 目前是「看不见的元数据」：预览渲染直接剥离，查看与编辑属性必须切源码态手写 YAML，门槛高且易写错格式。
- 字面搜索/替换依赖 CM6 内置面板：结果无上下文预览、无快捷键直达，替换确认成本高。
- 维护者经 13 轮原型迭代（`docs/design/explorations/frontmatter-search/prototype.html`）与定稿方案（`PLAN.md`）已收敛全部交互形态，本期落地。

## Scope（本期范围）

- 规格 `specs/doc-property-panel/spec.md` P-1～P-10 全部 Requirement。
- 规格 `specs/search-replace-float/spec.md` S-1～S-5 全部 Requirement。
- 配置新增字段走既有 `AppConfig` 三层合并 + 原子写 + 快照回滚链路（数据面六栏表见 design.md）。

## Non-goals

- AI 语义搜索与一键生成 MD（功能三，裁定 10：另起独立 change）。
- 跨文件搜索、向量索引（裁定 6/8：仅当前文件、暂不做）。
- 模板级/文件级显隐覆盖（裁定 4：仅全局设置）。
- 标签手工改色（裁定 1：稳定哈希自动渲染）。
- CM6 内置面板的保留（直接接管移除，非并存）。

## 需求输入包（L-1 契约门）

- **来源可追溯**：定稿方案 `PLAN.md`（规划 worktree 分支 `feat/plan-frontmatter-search`）+ 可交互原型 `docs/design/explorations/frontmatter-search/prototype.html`（13 轮迭代）+ 维护者 10 问裁定（记录于 PLAN.md/design.md，如裁定 1/4/6/8/10）。
- **空白显式化**：design.md Open Questions 为空；⌘1~9 键段冲突已固化「局部优先、Esc 归还」（design 决策 5），无 open-question 阻断规格条目。
- **一手证据**：原型 13 轮交互反馈为第一手维护者观察；非对标外部产品。
- **冲突显式**：⌘1~9 与「卡片直开 ⌘1–9」全局键段冲突已在 design.md Risks 显式登记并给出裁决。
- **验收锚点**：机读层 `conformance.json`（R-\d+ 锚点，来源引原型节/截图/决策），人读层为 spec SHALL 条款与 WHEN/THEN 场景。
