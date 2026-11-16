# 设计：文档属性面板与字面搜索/替换浮窗

## Context

- 定稿依据：`PLAN.md`（规划 worktree 分支 `feat/plan-frontmatter-search`，13 轮原型迭代收敛，维护者已确认定稿）；可交互原型 `docs/design/explorations/frontmatter-search/prototype.html`（throwaway，仅作形态参考，不参与实现裁定）。
- 现状：frontmatter 由预览渲染直接剥离；正文搜索走 CM6 `searchKeymap` 内置面板；快捷键唯一真相源为 `src/lib/shortcuts.ts`（含「卡片直开 ⌘1–9」全局键段）。
- 硬约束：三模式 CSS display 切换不 remount；CSS manifest（`src/editors/decorations/` 声明的 `cm-*` class 必须有对应 CSS）；API key 只进 OS keyring；数据面契约（见下文六栏表）。
- 本期 = 功能一 + 功能二；功能三（AI 语义搜索 + 一键成文）分期后续 change，本 change 不实现、不预留死代码。

## Goals / Non-Goals

**Goals:**
- frontmatter 属性面板：三模式、A/B 两态、八类字段类型、行操作与选择模式、标签胶囊、自动托管日期、模板、外部字段收编（P-1～P-10）。
- 字面搜索/替换浮窗：右键段局部抢占、双行结果、行尾快捷键、diff 替换（S-1～S-5）。
- 所有新配置项走既有 `AppConfig` 三层合并 + 原子写 + 快照回滚链路。

**Non-Goals:**
- AI 语义搜索 / 一键生成 MD（功能三，后续 change）。
- 跨文件搜索、向量索引（裁定 6/8：仅当前文件、暂不做）。
- 模板级 / 文件级显隐覆盖（裁定 4：仅全局）。
- 标签手工改色（裁定 1：稳定哈希自动渲染）。

## Decisions

1. **frontmatter 解析/序列化自研模块 `src/lib/frontmatter.ts`**：复用 `yaml` 包做字段级 parse/serialize，面板维护「键序 + 键名 + 类型 + 值」状态，编辑后整体序列化回 `--- ... ---` 块，经 `getActiveEditorView()` 以**单事务** dispatch 到文档前部。*理由：无需 AST 级无损编辑，整体替换 frontmatter 块实现简单且天然可撤销；自由键以原样字符串保留（解析时记录未识别键原文）*。替代方案（逐行 diff 补丁）复杂度高、收益低。
2. **配色纯函数 `tagColor(name)`**：标签名稳定哈希 → 8 色预置色板索引；哈希用 FNV-1a，色板值引用 `design-system:§6` 语义色（新增色需先补 spec 条款）。纯函数便于单测「同名同色 / 删标签不漂移」。
3. **搜索扫描 `src/lib/searchScan.ts` 独立于 CM6**：按块扫描生成 `{blockIndex, line, from, to, text}` 数组，定位与替换仍走 CM6 事务。*理由：结果列表需要块标题等 UI 信息，CM6 query API 不提供；替换用 `view.dispatch` 单事务保证可撤销*。
4. **浮窗挂载在 `ContentArea` 内、`position:absolute`**：随窗格定位，拖拽/缩放偏移仅存会话内 state（不入配置）；默认位置（左/中/右）入配置。*理由：窗格级浮层与轮盘/OutlineMenu 同范式；会话内记忆避免污染配置三层*。
5. **快捷键 scope 机制**：`shortcuts.ts` 条目增加 `scope: "global" | "local"` + `context` 描述；keymap 生成时局部键在上下文激活时注册并优先于全局。⌘⇧Y 为 global；搜索浮窗 ⌘1~9 / Enter / ↑↓ / Esc 为 local（context: 搜索浮窗打开且焦点在浮窗内）。*理由：解决与「卡片直开 ⌘1–9」的键段冲突，见 Risks*。
6. **字段行选中模型**：选中集合为数组，元素为字段行号或伪字段 `"tags"`；选择模式（选中集非空）在面板容器挂 `select-mode` class，行内点击统一走选中切换（事件委托在面板根节点前置于各编辑入口）。*理由：与原型 13 轮收敛的行为一致，实现集中、无需给每个入口加守卫*。
7. **数字千分位仅显示层**：`displayValue` 用 `toLocaleString`，编辑器与序列化保持原字符串。*理由：落盘数值格式不可被 UI 改写，避免破坏用户书写习惯*。
8. **模板与别称表存应用配置**（`AppConfig` 新增 `propTemplates`、`propAliasMap`、`propertyBar.*`、`searchPanel.*` 字段），走 CF-1 三层合并；校验在 Rust `config.rs` 白名单（未知值拒绝）。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 图标描边 1.7px、色板引用语义色，新增图标/色先有 spec 条款 |
| 存储 | src-tauri/src/config.rs | property_bar | `propertyBar`/`searchPanel`/`propTemplates`/`propAliasMap` 字段入 AppConfig Rust 结构，枚举白名单 |
| 校验 | src-tauri/src/config.rs | validate_config | displayStyle ∈ {list,dual}、searchPos ∈ {left,center,right}、displayDefault ∈ {show,collapse,hide}，越界拒绝写入 |
| 桥接 | src/hooks/useConfig.ts | propertyBar | 配置热应用：样式/默认显隐/浮窗位置生效，未知枚举忽略并聚合告警 |
| 消费 | src/components/DocPropertyBar.tsx | useConfig | 面板按配置渲染 A/B 两态与默认显隐；SearchReplacePanel 按配置定位浮窗 |
| 消费 | src/components/SearchReplacePanel.tsx | searchPanel | 同上（浮窗默认位置与尺寸记忆） |
| 消费 | src/lib/shortcuts.ts | shortcuts | ⌘⇧Y 全局、搜索浮窗局部键注册，keymap 由配置/状态驱动 |
| 回滚 | snapshots/ | restore_config_snapshot | 写前快照，一步恢复 |

（三道机检时点：G0 阶段二 `./scripts/cw-data-surface.sh new`、G0-POST `tickets`、G1 出口 `diff`。）

## Risks / Trade-offs

- [⌘1~9 键段冲突（卡片直开 ⌘1–9）] → 局部 scope 抢占：浮窗打开且焦点在浮窗内时局部优先，Esc/失焦归还；e2e 覆盖「关闭浮窗后 ⌘2 恢复全局」。
- [frontmatter 块整体替换可能吞掉解析器不支持的字面写法] → 解析保留自由键**原文**（未识别键整行原样回写）；往返单测覆盖注释、锚点、多行字符串等边角，发现不支持的写法降级为「该文件面板只读 + 源码编辑」。
- [大文件属性面板渲染开销] → 面板仅渲染 frontmatter 字段（通常 <20 行），无风险；搜索扫描限当前文件，>500KB 走既有大文件守卫（source 模式无面板）。
- [A/B 两态双实现漂移] → 两态共享同一字段数据与操作引擎（决策 6），仅渲染层分支；单测以引擎为准。
- [CSS manifest 违规] → 面板 class 统一 `dpb-*` / `srp-*` 前缀并在 `src/styles/` 落 CSS，交付前 `verify.sh` 机检。
- [别称表误伤用户自义键] → 别称表只赋类型、不改名不重排；用户显式改名总是生效。

## Migration Plan

1. 落 `frontmatter.ts` + 纯函数单测（无 UI）→ 2. `DocPropertyBar` 只读渲染 → 3. 编辑交互与行操作 → 4. 设置项与数据面桥接 → 5. `searchScan.ts` + `SearchReplacePanel` → 6. 快捷键 scope → 7. e2e + `verify.sh`。每步可独立合入 main（feature flag 不需要——面板未挂载前对用户不可见，浮窗接管 searchKeymap 是唯一行为切换点，放第 5 步之后一次性切换）。
- 回滚：面板与浮窗均为新增组件，移除挂载点即回滚；配置新增字段对旧版本无影响（Rust 校验白名单按存在性可选）。

## Open Questions

- 无（13 轮原型反馈 + 10 问裁定已全部收敛；唯一遗留：⌘1~9 抢占策略已在 design 决策 5 固化为「局部优先、Esc 归还」，如维护者对实现细节有异议在 G1 评审提出）。
