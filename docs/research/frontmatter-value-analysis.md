# Markdown Frontmatter 功能价值分析（v3，含 Codex 评审修订）

> 状态：2026-11-22 生成 v2 后经 Codex 独立评审（裁决 REVISE，16 条发现），按评审修正为 v3。
> v2 的事实错误已逐条修正，未能立即修正的列为待办。原始评审全文见文末「附录 A」。
> 用途：为「frontmatter 属性治理 + 查询能力」方向提供决策依据。

## 一、结论先行

**frontmatter 值得继续投入，但定位必须从「字段类型扩展」转为「属性治理 + 确定性查询」，且投入节奏受两道前置门槛约束：** ① 缺陷 #1320 归因关闭（P0 退出条件）；② 真实需求验证（P2 立项条件）。类型维度无证据要求继续扩展（6 个可推断类型 + 2 个声明型 + unknown 兜底，覆盖 Obsidian Properties 全部 6 类）。

## 二、仓库实地核实（2026-11-22，经 Codex 复核修正）

| 核实项 | 实测结果（v3 修正后） |
|--------|----------|
| 当前分支 | `feat/dp-select-options`，与 `origin/main` 同一提交（非领先，仅工作区有未提交改动） |
| 字段类型 | `src/lib/frontmatter.ts:20` 自述「八类 + 未识别」；**类型推断只推断 6 种**（text/number/date/datetime/boolean/array，`frontmatter.ts:360`），select/multiselect 只能由别称表、模板或用户覆盖声明，unknown 为兜底态。枚举 9 个值 ≠ 9 个可推断类型，「9 > Obsidian 6」不能作为封顶论证 |
| 受控词表 | **未建立**。进行中的票 5.1 是「同键自动补全」——`collectFieldOptions`（`DocPropertyBar.tsx:206`）只聚合已打开页签的同键值并允许任意新增，spec 明确「不新增配置或持久化键」（`specs/doc-property-panel/spec.md:179`）。无 enum、无 allowed values、无 vault 级词表 |
| 字段模板 | **已交付**（v2 漏计）：`src/lib/propTemplates.ts:10` + 设置页（`SettingsView.tsx:2018`）+ 套用实现（`DocPropertyBar.tsx:2992`），已接入 Rust 配置与预设值 |
| 类型存储层次 | 三层：应用级推断映射（`propAliasMap` + 模板类型，`src/types/index.ts:151`）、路径级临时覆盖（`docFieldTypes.ts:15`，localStorage，重命名/移动/跨机即丢）、**vault 级字段定义不存在** |
| 属性面板 | 成熟（A 一行条 / B 精排双列、拖拽排序、隐藏语义、托管日期）；未提交改动 +334 行实现下拉选项菜单 |
| 全文搜索底座 | **不可直接复用为查询数据源**：`search.rs:19` 扫描整个 home、上限 20,000 文件、单文件只读前 64KB、只返回「命中当前查询词」的摘要对象、frontmatter 仅提取 title（`search.rs:81`）；`flatten_files`（`directory.rs:164`）上限 2,000、深度 5、只返回元数据 |
| 全文搜索底座 | 无 vault/workspace 根模型：`defaultSavePath`（`src/types/index.ts:100`）只是新建文件初始目录；搜索扫 home；无文件监听与索引刷新机制 |
| 跨文档查询 | 不存在。且 change 记账滞后：`tasks.md` 9 张票 0 张勾选，8 项实现已合并（PR #1322–#1330）但 change 未满足归档条件 |
| 开放缺陷 | #1320「正文输入日期后内容跳动并整体消失」未归因——若属属性/日期链路，P0 不能带病归档 |

## 三、碰撞修正（v2 旧草稿失实点，经 Codex 复核后再修正）

1. **「当前仅简单集成」失实**（维持），但真实差距与 v2 描述不同：已交付的能力比 v2 认为的多（模板），比 v2 认为的少（受控词表、vault 级定义）。
2. **「先对齐 Obsidian 六类」已完成且超越**（维持，但论证修正）：覆盖成立是事实，但不能用枚举数量论证封顶——正确表述是「无证据要求更多类型」。
3. **「先定主消费方」降级为待决事项**（维持），并按评审新增一道更硬的前置：**真实需求验证**。生态成熟 ≠ 本产品用户有高频属性查询需求。

## 四、互联网证据（2026-05 ~ 2026-11，来源见文末附录 B）

### 4.1 支持继续投入的证据

- **结构化查询与导航检索是两类问题**（IWE）：「还有哪些决策处于 draft」这类过滤/计数/排序问题，agent 通读正文耗时 40 秒、漏 2 篇、幻觉 1 篇；`status: draft` 确定性查询瞬时零 token 零错误。
- **frontmatter 是文档的类型签名**（understandingdata）：有 schema 可按接口决定相关性，搜索空间 200 → 30；字段名不一致直接废掉查询。
- **frontmatter 是模型与系统间的契约**（branchpost）：无受控枚举时 AI 生成内容在变体命名间漂移，标签碎成孤岛且失败静默。标签/分类必须是 enum。
- **确定性抽取稳定性远超 LLM 抽取（2026-11 实测）**：crawlbase 测试中 25 个字段跑 3 次，确定性管道 17–19 个字段完全一致，LLM schema 抽取仅 2 个一致；mdaios 论文论证 frontmatter 提取「deterministic — no LLM required, no risk of hallucination」。
- **token 成本校准**（mnmnote）：10 字段 YAML 头实测 80 token，占短笔记 71%。没有检索系统在它上过滤时是纯噪音；Biaoyue 场景（本地库 + 将有过滤查询）落在 signal 区。
- **生态印证「markdown 即数据库」是成熟范式**：mdq / pql / flatmark / fmql / FlokinMD / Obsidian Dataview(DQL)。均为确定性查询，无一靠 LLM 查询。

### 4.2 对标对象动态（2026-11）

- Obsidian Bases 高速迭代：1.14（2026-10）看板视图与分组管理；1.15（2026-11）过滤器拖拽排序；路线图含日历视图、可见行聚合计数、Bases 发布支持。核心插件在吸收第三方查询插件的用例。
- 对 Biaoyue 的含义（按评审降级为参照而非结论）：查询层价值被头部产品反复验证；但「Bases 吸收全部用例」为二手转述，Dataview 停止活跃开发需以仓库提交记录复核后再引用。
- Dataview 教训：自研 DSL 解析器维护成本高，Bases 证明 UI 驱动 + 声明式配置更可持续——支持选 builder API 而非自研 DSL。

## 五、能力定位与边界（v3 修正）

### 5.1 属性治理（第一优先）

| 属性 | 现状 | 优先级 |
|------|------|--------|
| 受控词表（持久化 enum + 启用范围 + 旧值迁移） | 未建立（票 5.1 仅同键自动补全） | **最高**——查询可靠性的前提 |
| vault 级字段定义 | 不存在；且路径级 localStorage 覆盖在重命名/移动/跨机时丢失 | **最高**——建议落为可随库迁移的文本文件，而非仅 localStorage/应用配置 |
| 必填/格式约束 | 无。必填语义未定义（保存阻断 vs 诊断提示 vs 查询完整性指标）；硬强制会破坏外部 Markdown 与无损写回原则 | 高，**只做缺失提示，不做保存阻断** |
| 默认值 | 模板已有预设值；仅用于新建/套用模板，不反写旧文档 | 已基本交付，需演进 |
| 字段模板 | 已交付（`propTemplates.ts` + 设置页 + 套用） | 已交付，需演进 |
| 更多字段类型 | 无证据要求扩展 | 不做 |

### 5.2 查询层（核心价值，前置门槛最重）

- **形态：前端 builder API**（`where / orderBy / groupBy / limit / count / project`）方向维持，但「不引入 SQLite、零新依赖」**在基准测试前不定案**：先做数据源/性能 spike（1k / 10k 文件）与 ADR，再在按需扫描 / Rust 元数据缓存 / SQLite 投影之间选择。
- **数据源需新建独立命令/数据契约**（批量返回路径、mtime、frontmatter 解析状态、规范化字段），避免 N 次文件读取 IPC；`search.rs` 不可复用（见第二节）。
- **vault/workspace 根模型是前置设计门槛**（v2 错列为「立项时定」）：它决定权限、忽略规则、符号链接策略、索引缓存与隐私边界。
- **查询语义需先立规格**：重复键、非法 YAML、缺失值、空数组、嵌套对象、日期时区、大小写、字符串/数字混用、多选包含、排序稳定性——当前解析器是「容错展示」，不等于「可确定性查询」的规范化模型。解析错误应作为可查询的数据质量状态，不静默丢弃。

### 5.3 报表层（价值出口，收缩）

砍到「一个只读分组列表/表格」，先用 P2 验证使用率，再决定是否做看板/统计卡。

### 5.4 AI 边界（拆开三条链路，不再混为一谈）

- **查询执行**：必须确定性，不依赖 AI——这一条有实测证据支撑。
- **查询表达（自然语言 → builder 条件）**：可后置的可选增强；AI 生成候选条件后仍由确定性执行器校验执行。v2 把这条与执行混为一谈，是证据链错误。
- **写入侧填充（批量回填/词表建议）**：AI 胜任，但涉及多文件写入——必须包含写前预览、逐文件审计、快照与失败回滚，**从主路线移除**，另立实验 change。

## 六、路线图（v3 修正：拆阶段、加门槛）

| 阶段 | 内容 | 前置门槛 | 状态 |
|------|------|----------|------|
| P0 交互收口 | 票 5.1 收尾；修复 tasks.md 记账（0/9 → 实际）；归档 `doc-property-refine-1121b` | **缺陷 #1320 复现、归因、关闭/转票**——确认非属性/日期链路污染后 P0 才可退出 | 8 项实现已合并，记账未修 |
| P0.5 需求验证 | 用 5 个真实用户任务 + 3 类代表性库验证属性查询需求强度；若用户只需要按状态筛选，**改走轻量路线**（现有 `Cmd+P` 加元数据 facet / 单字段过滤），不建完整 builder/report 层 | P0 完成 | 新增（Codex 发现 #9） |
| P1a 词表/Schema 模型 | 受控词表持久化 + vault 级字段定义（可随库迁移的文本文件）+ 迁移策略 | P0.5 验证通过 | 待立项 |
| P1b 编辑期诊断 | 必填缺失提示 + 格式约束提示（不阻断保存） | P1a | 待立项，与 P1a 拆开 |
| P2a 数据源 spike | 独立扫描命令/数据契约 + 1k/10k 基准 + vault 根模型 ADR（扫描 vs 缓存 vs SQLite 投影） | P1a | 待立项 |
| P2b 查询语义规格 + builder | 查询语义规格 + fixture 集 + 纯 builder + 单一过滤入口 | P2a ADR 定案 | 待立项 |
| P3 报表（收缩） | 只读分组列表/表格 | P2b 使用验证 | 后置 |
| P4 AI 填充（移出主路线） | 批量回填：写前预览 + 逐文件审计 + 快照 + 回滚 | 独立实验 change | 明确后置 |

**替代方案对比义务**（Codex 发现 #16）：P0.5 阶段须用至少一个真实任务比较三条路线的交付成本与用户价值——① 单字段 facet（最轻）；② builder API（本报告主路线）；③ 兼容 Obsidian Bases/Dataview 格式而非自建。淘汰须写明理由。

## 七、待决事项（不阻塞 P0/P0.5）

1. **主消费方**：视图层投入节奏取决于主要用户是人还是 agent/程序；P0.5 的需求验证同时回答此问题。
2. **查询语义细节**：日期时区、大小写、多值包含等——P2b 规格阶段定。
3. **字段定义文件的落点与格式**：随库迁移的文本文件（推荐方向）具体格式——P1a 立项时定。

## 八、风险与未验证项（v3 更新）

1. **性能未实测**：P2a 基准解决；v2「零依赖」结论已降级为待验证假设。
2. **外部证据引用完整性**：URL 已补（附录 B），但「Dataview 停止活跃开发」「Bases 吸收全部用例」两条仍为二手转述，引用前需复核原始仓库提交记录。
3. **agent 抽取 vs frontmatter 的本仓量化对比仍缺**：现有证据为外部实测外推。
4. **票 5.1 未提交且性质修正**：它不是受控词表，P1a 的「受控词表」仍是全量新工作。
5. **#1320 归因未知**：P0 退出的硬门槛。

## 附录 A：Codex 评审记录（2026-11-22）

裁决：**REVISE**。16 条发现（10 高 / 6 中），全文要点：

- 高 #1：9 枚举值 ≠ 9 可推断类型（推断仅 6 种）→ 封顶论证不成立。✅ 已修正（§二/§一）
- 高 #2：票 5.1 是同键自动补全非受控词表。✅ 已修正（§二/§5.1）
- 高 #3：字段模板已交付，v2 漏计。✅ 已修正（§二/§5.1）
- 高 #4：search.rs 不可直接复用为查询数据源。✅ 已修正（§二/§5.2）
- 高 #5：无 vault 根模型，查询范围不能后置。✅ 已修正（§5.2/§六）
- 高 #6：类型存储三层，路径级 localStorage 会丢。✅ 已修正（§二/§5.1）
- 高 #7：抽取稳定性证据不能证明「查询执行不碰 AI」，三链路应拆分。✅ 已修正（§5.4）
- 高 #8：外部证据无引用来源，决策级缺陷。✅ 部分修正（附录 B 补 URL；两条二手转述标注待复核）
- 高 #9：生态成熟 ≠ 本产品需求，缺验证门槛。✅ 已修正（P0.5 新增）
- 高 #10：缺陷 #1320 未纳入 P0 退出条件。✅ 已修正（§六）
- 中 #11：实现进度与 OpenSpec 记账混淆。✅ 已修正（§二/§六；记账修复列为 P0 任务）
- 中 #12：P1 范围过大 + 必填语义未定义。✅ 已修正（拆 P1a/P1b，必填降为提示）
- 中 #13：P2 过大 + 零依赖过早定案。✅ 已修正（拆 P2a/P2b + spike/ADR）
- 中 #14：查询语义未定义。✅ 已修正（§5.2 + P2b）
- 中 #15：P3/P4 应收缩/移出。✅ 已修正（§5.3/§六）
- 中 #16：缺替代方案对比。✅ 已修正（P0.5 对比义务）

## 附录 B：参考来源

- IWE《Structured questions need a query layer, not better retrieval》 https://iwe.md/blog/agents-and-structured-questions/ （2026-05）
- understandingdata《Frontmatter as Document Schema》 https://understandingdata.com/posts/frontmatter-as-document-schema/ （2026-03）
- branchpost《Frontmatter as a contract between AI and your CMS》 https://branchpost.dev/blog/frontmatter-as-a-contract （2026-05）
- mnmnote《Your Frontmatter Is Content to the AI》 https://blog.mnmnote.com/posts/your-frontmatter-is-content-to-the-ai （2026-07）
- crawlbase《Structured Data Extraction at Scale: Scrapers vs LLM Schemas》 https://crawlbase.com/blog/structured-data-extraction-at-scale-scrapers-vs-llm-schema-extraction/ （2026-11）
- mdaios 论文 https://github.com/KardungLa/mdaios/blob/main/paper/mdaios-paper-en.md
- Obsidian 1.14 changelog（看板视图） https://obsidian.md/changelog/2026-10-05-desktop-v1.14.4/ （2026-10）；1.15 changelog（过滤器排序） https://obsidian.md/changelog/2026-11-02-desktop-v1.15.0/ （2026-11）；Roadmap https://obsidian.md/roadmap/
- 生态工具：mdq（github.com/davidgasquez/mdq）、pql（github.com/postmeridiem/pql）、flatmark（github.com/omarchouman/flatmark）、fmql（github.com/buyuk-dev/fmql）、FlokinMD（github.com/sergiocardoso/flokin-md）、Dataview（github.com/blacksmithgu/obsidian-dataview）
- 标注待复核（二手转述）：「Dataview 已停止活跃开发」「Bases 吸收 Dataview 全部用例」
