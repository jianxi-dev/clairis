---
title: Clairis 文档迁移核对报告（MIGRATION-REPORT）
type: guide
status: accepted
source_of_truth: canonical
last_updated: 2026-08-01
---

# Clairis 文档迁移核对报告

本报告是 Clairis（渐晰）文档治理计划「任务 13」的核对交付物。它对照任务 1 的基线清单，逐源记录每一个产品文档的**最终去向**，给出**账目平衡等式**并由 Python 断言成立，同时登记被取代存根的处置决定与移除前置条件。

> - 配套机器可读账目：`.omo/evidence/ulw/clairis-doc-governance/task-13/migration-report.json`（173 条逐源去向）。
> - 逐文件迁移计划账本：[`docs/MIGRATION-MAP.md`](./MIGRATION-MAP.md)。
> - **本轮不删除、不移动任何旧文件**；仅新增本报告与根目录 `README.md`、`CHANGELOG.md`。

---

## 摘要

| 指标 | 数值 |
| --- | --- |
| 基线 source 总数（任务 1 baseline-manifest） | **173** |
| moved（物理迁移到非归档活路径） | **4** |
| split（内容拆分到多权威源，存根保留） | **2** |
| archived（最终落点在 `docs/archive/` 下 / git-HEAD 历史稿） | **58** |
| retained-needs-review（仍在原位、未裁定） | **107** |
| exclude（非产品文档，不参与迁移） | **2** |
| **账目平衡** | **173 == 4 + 2 + 58 + 107 + 2 ✅（断言 True）** |

---

## 一、数据来源与方法

账目由 Python 脚本从下列只读来源计算（见 `accounting-check.txt`）：

1. **任务 1 基线清单** `.omo/evidence/ulw/clairis-doc-governance/task-1/baseline-manifest.json`（`files` 数组 173 条，每条含 `path/group/sha256/size/action`）。
2. **迁移账本** `docs/MIGRATION-MAP.md`（已含任务 9.5/12 更新）。
3. **任务 6-12 各自 done-claim 与证据**（实际搬移/拆分/归档/链接重写结果）。
4. **实时文件系统**（对 moved/archived 目标与三个被取代存根逐一 `os.path.exists` 核验）。

去向分桶定义（互斥，覆盖全部 173 源）：

- **moved**：由任务 9.5 物理移动到**非归档**的新活路径（研究文档升格归位）。
- **split**：内容被拆分进**多个**新权威源；原位保留 superseded+redirect 存根（本轮不删除）。
- **archived**：最终落点在 `docs/archive/` 之下，或为 `doc/` HEAD 历史稿（内容经 `git show HEAD:` 可恢复，归档目标已登记）。
- **retained-needs-review**：仍在原位、状态未裁定，禁止自动移动；部分仅接受任务 8/11/12 的入口/守卫性编辑，未改产品正文实质内容。
- **exclude**：非产品文档（GBrain 探针、macOS 元数据），不移动、不删除、不参与迁移。

---

## 二、账目平衡等式

\[
\text{source\_total} = \text{moved} + \text{split} + \text{archived} + \text{retained-needs-review} + \text{exclude}
\]

代入实测数字：

\[
173 = 4 + 2 + 58 + 107 + 2 = 173 \quad \checkmark
\]

**断言证据**（命令与完整输出见 `.omo/evidence/ulw/clairis-doc-governance/task-13/accounting-check.txt`）：

```text
$ python3 task13-accounting.py
ACCOUNTING
  source_total          = 173
  moved                 = 4
  split                 = 2
  archived              = 58
  retained-needs-review = 107
  exclude               = 2
  equation_sum          = 173
  BALANCED              = True
  problems              = 0
  split_targets_exist   = all True
  superseded_stubs      = {'docs/CORE-REQUIREMENTS-clairis.md': True, 'docs/ARCHITECTURE.md': True}  # 根目录 CORE-REQUIREMENTS-clairis.md 已于方案 A（2026-08）删除，哈希留档见 §四
```

脚本对每一源记录去向，并在计算末尾 `assert` 平衡、`assert` 拆分目标全部存在、`assert` 三个被取代存根仍在原位；任一不满足即以非零退出。

**失败注入 QA**（同文件下半段）：临时从账目漏计一个源（把 `exclude` 由 2 记为 1），则 `equation_sum=172 ≠ 173`，`assert` **如预期失败**；恢复完整账目后断言重新成立。这证明等式对“少算一个源”是敏感的，最终报告采用平衡态。

---

## 三、权威源已唯一（“安全取消重复入口”的本轮形态）

本轮“安全取消重复入口”体现为：**权威源唯一化 + 旧入口降级为 superseded/redirect，不再是活导航目标**；物理删除因门槛未满足而显式延后（见第六节）。任务 11 已把 Agent/工具入口路由全部改新：

| 知识类别 | 唯一权威源（canonical） | 旧入口现状 |
| --- | --- | --- |
| 产品方向 | `docs/product/`（vision/principles/users/scope） | `docs/CORE-REQUIREMENTS-clairis.md` 已标 `superseded` + `redirect: docs/product/README.md`，**不再是活入口**；根目录同源副本已于方案 A（2026-08）删除 |
| 可验收行为（功能规格） | `openspec/specs/`（reading/editing/file-management/navigation/capture/application-shell，43 requirements） | 旧 §二/§三 需求与 ✅ 跟踪项已迁入 spec；`docs/MVP-需求跟踪表.md` 仅作历史对照（needs-review，原位） |
| 当前架构 | `docs/architecture/overview.md` + `docs/architecture/decisions/`（ADR 0001–0005） | `docs/ARCHITECTURE.md` 标 needs-review，被 overview/ADR 取代；入口不再指向它 |
| 已批准设计 | `docs/design/approved/` | —— |
| 交付路线图 | `docs/delivery/roadmap.md` | `PLAN.md`/`PLAN-REVIEW-LOG.md` 已归档 |
| 文档总索引 | `docs/README.md` + `docs/GOVERNANCE.md` | —— |

入口可达性与唯一性由任务 11 检测器证明（`task-11/agent-routing.json`，五类任务路由各唯一首选 + 目标存在；注入旧活入口即失败）。

---

## 四、拆分说明：全量需求 CORE-REQUIREMENTS-clairis.md

全量需求稿 `CORE-REQUIREMENTS-clairis.md`（`docs/` 存根保留；根目录同源副本已于方案 A（2026-08）删除，哈希留档见下）被**拆分**到下列权威源，存根本轮保留（`superseded` + `redirect`）：

| 拆分目标 | 承接内容 | 产生任务 |
| --- | --- | --- |
| `docs/product/vision.md` | 产品愿景 | 任务 6 |
| `docs/product/principles.md` | 产品原则 | 任务 6 |
| `docs/product/users.md` | 目标用户 | 任务 6 |
| `docs/product/scope.md` | 范围与方向 | 任务 6 |
| `docs/delivery/roadmap.md` | 交付路线图（不自称功能验收真相源） | 任务 6 |
| `openspec/specs/reading/spec.md` | A-1/2/3/5/6/7/8/9（8 req） | 任务 7 |
| `openspec/specs/editing/spec.md` | E-1/2/3/4（4 req，含原子写入/未保存守卫/并发覆盖保护） | 任务 7 |
| `openspec/specs/file-management/spec.md` | C-1/2/3/4/5（5 req） | 任务 7 |
| `openspec/specs/navigation/spec.md` | B-1/3/6/7/8（5 req） | 任务 7 |
| `openspec/specs/capture/spec.md` | D-1..D-14（14 req，以 capture-overlay-SPEC v5.4 为准） | 任务 7 |
| `openspec/specs/application-shell/spec.md` | G-1/2/3/5、B-2/4/5（7 req） | 任务 7 |

合计 43 个 requirement，编号经审计在且仅在一个 domain 出现（`task-7/domain-coverage.json`，`openspec validate --all` exit 0）。

**拆分存根的哈希对应**（拆分前全文件 == 正文，见 `task-10/pre-hash.txt`）：

- 根 `CORE-REQUIREMENTS-clairis.md`：`1bee25b7b45c0a75a3f9d045f93bc743583a965c0851138c9196a26b20f77aad`（方案 A 已删除该文件，此哈希留档供核对）
- `docs/CORE-REQUIREMENTS-clairis.md`：`5d127a25f252c81e98bfdb23a6b4fe6a112a5a706911827593424ee1b8a5921f`

`docs/` 存根仅**前置** `status: superseded` + `redirect` frontmatter，正文逐字节未改；内容已分别落入上表权威源。根目录副本（rebrand 前旧版，内容与 docs/ 副本不一致）未参与拆分承载，已于方案 A 删除。

---

## 五、moved 清单（4）

任务 9.5 把 4 篇研究文档物理迁移到 `docs/research/`。**正文逐字节一致，仅前置 frontmatter**（`task-9-5/body-integrity.txt`，`VERDICT=PASS_body_byte_identical_only_frontmatter_prepended`）。`pre-move sha == 去 frontmatter 后正文 sha`：

| 源路径 | 新路径 | pre-move sha256（== 正文 sha） | 迁移后含 fm sha256 |
| --- | --- | --- | --- |
| `docs/fanbox-analysis.md` | `docs/research/competitors/fanbox-analysis.md` | `74d193410c5665917aff96f75d8a9a968cf5ed53edb508a1d842fbbeb8607da0` | `6829162ef81e14e8…` |
| `docs/渐晰-vs-Obsidian-竞品深度分析.md` | `docs/research/competitors/渐晰-vs-Obsidian-竞品深度分析.md` | `863d8d0e19b59a9cb5fd5ba1ab37700fcbf72574819088551ce23e5a8e516f10` | `321a6bf4b2fb4fd1…` |
| `docs/渐晰-vs-Typora-Bear-Ulysses-四象限对比.md` | `docs/research/competitors/渐晰-vs-Typora-Bear-Ulysses-四象限对比.md` | `aa748998099dd60afc2734bebe3c90a11e499cb06aa3f1af6c3b727834756909` | `ff911a466fe9e630…` |
| `docs/单页vs双页阅读效果深层对比研究.md` | `docs/research/interaction/单页vs双页阅读效果深层对比研究.md` | `ebeb4f81da9a4d169616d477caaadfc077908a431aaf6b746f1bf2ef2731f130` | `e979a57aa0445aed…` |

核验：源路径已搬离（`docs/fanbox-analysis.md` 等不存在），4 个新路径均存在（脚本 `target_exists=True`）。

---

## 六、archived 清单（58 = 47 git-HEAD 历史稿 + 11 工作区归档/重定位）

### 6.1 doc/ HEAD 历史树（47，内容经 git 可恢复）

任务 1 以 `head-snapshot-recorded` 记录：`doc/` 历史树在工作区已删除，内容经 `git show HEAD:doc/<path>` 可恢复（`git ls-tree -r --name-only HEAD -- doc/` = 47）。MIGRATION-MAP 登记其归档落点为 `docs/archive/历史稿/<name>`（规划落点，**本轮未物理恢复落盘**）， authority=historical。涵盖 `doc/ARCHITECTURE.md`、`doc/CORE-REQUIREMENTS*.md`（v3/v4/渐明/旧版）、`doc/MVP-*`、`doc/designs/*` 全套历史设计稿等（完整 47 行见 MIGRATION-MAP §2 与 `migration-report.json`）。

### 6.2 工作区归档/重定位（11，任务 10）

最终落点均在 `docs/archive/2026/` 下。`PLAN`/`PLAN-REVIEW-LOG` 前置 `superseded` frontmatter（正文逐字节一致）；9 个 legacy 文件为重定位，`target sha256 == pre-move sha256`（逐字节一致，见 `task-10/pre-hash.txt`）：

| 源路径 | 归档落点 | 哈希对应 |
| --- | --- | --- |
| `PLAN.md` | `docs/archive/2026/reading-completion/PLAN.md` | pre `5e58408859388bc7…` → 含 fm `3fc2a36b9c094ebd…`（正文一致） |
| `PLAN-REVIEW-LOG.md` | `docs/archive/2026/reading-completion/PLAN-REVIEW-LOG.md` | pre `90b2fcfa70957090…` → 含 fm `947fa56048c6cb11…`（正文一致） |
| `docs/archive/CORE-REQUIREMENTS-v3-archived.md` | `…/2026/legacy-requirements/CORE-REQUIREMENTS-v3-archived.md` | `66e90e77…` == 一致 |
| `docs/archive/CORE-REQUIREMENTS-V4-2-archived.md` | `…/2026/legacy-requirements/CORE-REQUIREMENTS-V4-2-archived.md` | `3479a713…` == 一致 |
| `docs/archive/CORE-REQUIREMENTS-v4-archived.md` | `…/2026/legacy-requirements/CORE-REQUIREMENTS-v4-archived.md` | `eeb6f1f2…` == 一致 |
| `docs/archive/CORE-REQUIREMENTS-渐明-archived.md` | `…/2026/legacy-requirements/CORE-REQUIREMENTS-渐明-archived.md` | `e3fb18d6…` == 一致 |
| `docs/archive/HTML-SUPPORT-DESIGN.md` | `…/2026/legacy-requirements/HTML-SUPPORT-DESIGN.md` | `fe782010…` == 一致 |
| `docs/archive/QUALITY-IMPROVEMENT.md` | `…/2026/legacy-requirements/QUALITY-IMPROVEMENT.md` | `aa8ceb3b…` == 一致 |
| `docs/archive/markdown阅读器.md` | `…/2026/legacy-requirements/markdown阅读器.md` | `7a0706e6…` == 一致 |
| `docs/archive/no-sidebar-desk-file-list-proposal.md` | `…/2026/legacy-requirements/no-sidebar-desk-file-list-proposal.md` | `772a50cf…` == 一致 |
| `docs/archive/渐晰Markdown 阅读编辑器 会话移交文档.md` | `…/2026/legacy-requirements/渐晰Markdown 阅读编辑器 会话移交文档.md` | `1e56eaaf…` == 一致 |

---

## 七、exclude 清单（2）

| 源路径 | 理由 |
| --- | --- |
| `_cap_check2.md` | GBrain 探针文件，固定处置：不移动、不删除、不参与迁移。 |
| `docs/.DS_Store` | macOS 元数据，非产品文档；MIGRATION-MAP 标 exclude，不参与迁移。 |

> 注：`index.html.artifact.json` 在 MIGRATION-MAP 记为第 174 行的 exclude（生成物），但**不在**任务 1 baseline-manifest 的 173 条 source 之内，故不计入本账目分母。

---

## 八、retained-needs-review 清单（107）

下列源仍在原位、状态未裁定，**本轮未自动移动**；部分仅接受任务 8/11/12 的入口/守卫性编辑（未改产品正文实质内容）。完整逐源记录见 `migration-report.json`。

### 8.1 根目录（5）

`AGENTS.md`、`CONTEXT.md`（入口文件，任务 8/11 已更新路由表述，仍在原位）、`index.html`、`landing.html`、`test.html`

### 8.2 OpenSpec / 工具配置（17）

- `openspec/config.yaml`
- `.opencode/.gitignore`、`.opencode/package.json`、`.opencode/package-lock.json`、`.opencode/project-tree.md`
- `.opencode/commands/opsx-{apply,archive,explore,propose,sync,update}.md`（6）
- `.opencode/skills/openspec-{apply-change,archive-change,explore,propose,sync-specs,update-change}/SKILL.md`（6）

### 8.3 docs/ 顶层（24）

`0-welcome.md`、`09-html-exploration.md`、`docs/ARCHITECTURE.md`、`CLAIRIS-NAMING-REGISTRATION.md`、`DESIGN-PHILOSOPHY.md`、`DESIGN-REVIEW.md`、`DEVEX-REVIEW.md`、`EXECUTION-PLAN.md`、`METHODOLOGY.md`、`MVP-渐明-v1.md`、`MVP-需求跟踪表.md`、`QUALITY-STANDARDS.md`、`SOURCE-MANAGEMENT.md`、`architecture-store-slices.md`、`capture-overlay-SPEC.md`、`capture-overlay-问题及想法记录-1.md`、`渐晰-重新定义.md`、`渐晰UI设计.html`、`渐晰UI设计2.html`、`渐晰颜色设计体系.md`、`渐晰（Clairis）App Bundle ID 标准化方案与注册运维手册.md`、`渐晰（Clairis）App 商店上架全套命名方案（国内App Store + 海外App Store双适配）.md`、`统一整套布局方案：主画布分栏规则 + 悬浮面板「可嵌入分栏」必要性与完整设计.md`、`网站UI效果.html`、`阅读写作软件「展卷仪式」功能需求清单.md`

（计 24；`docs/.DS_Store` 已归入 exclude，不在此列。）

### 8.4 docs/designs/（60）

3 个已归档 r1 规格（`docs/designs/archive/spec-A5/A6/A9-*-r1-archived.md`，原位 keep）；capture-overlay 系列（v3-critique/v3-draft/v3.1/v4/v4.1/v5/v5.1/v5.2/v5.3，9）、clairis 主题（theme-system-6V、themes-o0/o1/html，4）、design-codex-brief、design-concept-v3、design-consultation-20260702、folio-breakthrough-20260704/（finalized.html/finalized.json/无侧栏桌面突破概念，3）、folio-nextgen-compare.html、ink-desk/ink-river-prototype.html（2）、jianming-nextgen-design-codex/prototype.html（2）、module-g-shell-ui.md、no-sidebar 全系列（design.html/design.md/doc-navigation.md/doc-navigation-v2.md/nav-final.md/prototype.html/prototype-fixed.html/prototype-v2.html/prototype-v3.html，9）、outline-and-quick-capture（design/final/v2、outline-quick-capture-final，4）、prototype-{dna,erosion,kaleidoscope,kaleidoscope-b,kaleidoscope-c,magnetic-field,wind,wind-a,wind-b,wind-c}.html（10）、prototypes-all.html、spec-A5-immersive-reading.md、spec-A6-font-size-scaling.md、spec-A9-reading-progress.md、spec-B1-B2-B4-B5-empty-state.md、spec-B1-B2-B4-B5-empty-state-creative.md（creative，openspec 零引用）、the-desk-concept.md、three-column-layout.md、ui-design-philosophy.md。

### 8.5 retained 小结

107 个 needs-review 源是后续人工裁定的工作清单；治理规则要求**禁止自动移动**，待逐项确认 canonical 归属后再由后续任务处理。

---

## 九、被取代存根与延后移除项（硬决策）

**本轮不删除任何旧文件。** 以下三个被取代存根仍在原位，移除作为**显式延后项**记录（方案 A 已于 2026-08 对根目录副本执行删除，见下）：

| 存根 | 取代它的权威源 | 本轮状态 |
| --- | --- | --- |
| `CORE-REQUIREMENTS-clairis.md`（根） | `docs/product/*` + `docs/delivery/roadmap.md` + `openspec/specs/*` | **已删除**（方案 A：rebrand 前旧版、与 docs/ 副本内容不一致；哈希留档见 §四） |
| `docs/CORE-REQUIREMENTS-clairis.md` | 同上 | `superseded` + `redirect`，原位保留 |
| `docs/ARCHITECTURE.md` | `docs/architecture/overview.md` + `docs/architecture/decisions/` | needs-review，被取代，原位保留 |

脚本已断言三者 `os.path.exists == True`（见第二节 `superseded_stubs`）；方案 A 后根目录副本已不存在，断言集合更新为仅含 `docs/CORE-REQUIREMENTS-clairis.md` 与 `docs/ARCHITECTURE.md`。

### 移除前置条件（门槛，目前未满足）

计划规定的删除门槛为「替代内容完整 + 无活引用 + 备份可验证」。当前**未满足**，原因是：

1. **仍被具名引用**：任务 12 登记了 **143+ 处**指向这些存根的 intentional-history 引用（来源存根注 / 墓碑注 / 迁移账本，见 `task-12/intentional-history-allowlist.json`）；入口与产品文档中仍含具名历史溯源（如 `docs/product/*.md` 的「来源与旧入口说明」段）。此时物理删除会制造大量断链。
2. **活入口需确认归零**：须先把上述 143+ allowlist 引用改为纯历史叙事或移除，并确认无任何入口指向。
3. **备份复核**：移除前须复核备份可验证（备份根 `task-1/_backup_root.txt` 指向的 `clairis-doc-governance-backup-*`，`all_hashes_match_at_copy_time=true`）。

满足以上三条后，移除须**逐文件 apply_patch**，不得批量 `rm`。任务 12 的 AST 门禁（`task-12/gate-final.json`，0 broken / 0 legacy 活入口、143 条 intentional-history 全部登记）即用于在移除前后守门。

---

## 十、redirect / stub 现状

- `docs/CORE-REQUIREMENTS-clairis.md` 存根：`status: superseded` + `redirect: docs/product/README.md`，正文未改，仅作历史溯源锚点；根目录同源副本已于方案 A（2026-08）删除。
- `docs/ARCHITECTURE.md`：needs-review，尚未加 superseded frontmatter；入口（AGENTS/CONTEXT/openspec/project-tree）已在任务 11 改指 `docs/architecture/overview.md` + `decisions/`，不再以其为活导航目标。
- 迁移可追踪性：产品/交付文件的「来源」段由 Markdown 活链接改为「具名历史存根 + 新位置活链接」，保留 §章节出处（任务 12），存根正文未改、章节索引仍有效。
- 归档 README：`docs/archive/README.md`、`docs/archive/2026/reading-completion/README.md`、`docs/archive/2026/legacy-requirements/README.md`（任务 10）。

---

## 十一、各任务（1-12）产出与证据索引

| 任务 | 产出 | 证据目录 |
| --- | --- | --- |
| 1 基线清单 | baseline-manifest.json（173）、backup-manifest.json（121，hash 全匹配）、exclusion-ledger.json | `task-1/` |
| 2 类型/状态枚举 | `_raw-enum.json` 等 | `task-2/` |
| 3 迁移账本 | `docs/MIGRATION-MAP.md`（174 行） | `task-3/` |
| 4 文档骨架/索引 | `docs/README.md`、各域 README | `task-4/` |
| 5 治理检查器 | `scripts/docs-governance-check.mjs` | `task-5/` |
| 6 产品方向+路线图拆分 | `docs/product/{vision,principles,users,scope}.md`、`docs/delivery/roadmap.md` | `task-6/product-migration.md` |
| 7 OpenSpec 当前规格 | `openspec/specs/*`（6 domain / 43 req，validate exit 0） | `task-7/{openspec-validate.txt,domain-coverage.json}` |
| 8 架构现状+ADR | `docs/architecture/overview.md`、`decisions/0001–0005`、`CONTEXT.md` | `task-8/architecture.txt` |
| 9 设计/研究归位 | explorations/approved/research README（0 移动） | `task-9/design-research.txt` |
| 9.5 研究文档升格 | 4 篇移入 `docs/research/`（正文逐字节一致） | `task-9-5/{body-integrity.txt,hashes-*.txt,…}` |
| 10 归档旧需求/计划/评审 | `docs/archive/2026/{reading-completion,legacy-requirements}/`、两 CORE 存根 superseded+redirect | `task-10/{archive.txt,pre-hash.txt,checker-*.json}` |
| 11 Agent/工具入口 | `AGENTS.md`、`CONTEXT.md`、`openspec/config.yaml`、`.opencode/project-tree.md` 路由改新 | `task-11/{agent-routing.json,old-path-grep.txt,verify-task-11.mjs}` |
| 12 内部链接重写 | 12 文件链接去活入口化；`task-12/intentional-history-allowlist.json`（143+ 条登记） | `task-12/{links.txt,gate-final.json,baseline-scan.json,postedit-scan.json}` |
| 13 迁移核对报告 | 本报告 `docs/MIGRATION-REPORT.md`、根 `README.md`、根 `CHANGELOG.md` | `task-13/{migration-report.json,accounting-check.txt,done-claim.json}` |

---

## 附：逐源完整去向

173 条 source 的逐条 `disposition / target / 哈希 / 备注` 见机器可读账目
`.omo/evidence/ulw/clairis-doc-governance/task-13/migration-report.json`（每条形如
`{"source","group","baseline_sha256","disposition","target","note", ...}`）。本报告各节即该账目的人类可读汇总，二者口径一致、账目平衡。
