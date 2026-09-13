---
title: 开发流程证据链规范
type: delivery
status: draft
last_updated: 2026-08-02
---

# 开发流程证据链规范

Clairis（渐晰）软件著作权登记申请的**开发过程证据链规范**：从 Phase M 开发期起，git 历史、里程碑 tag、文件头注释、AI 辅助开发记录与行数/截图盘点共同构成"原创性演进 + 开发完成日期 + 首次发表日期"的证据链。申请时机在 Phase R（Release 1.0 稳定版发布）之后。

- 阶段参照：Phase M = 软著 MVP（占位与最小可用），Phase R = Release 1.0（正式发布），见 [`roadmap.md`](../roadmap.md)。
- 材料追踪：本规范执行结果（日期锚点、盘点记录）登记在[资料台账 `ledger.md`](./软著资料台账.md)。
- 规划与决策来源：`../../../.omo/drafts/clairis-software-copyright-prep.md` Decision 4/5/6/7。
- 工具：行数统计 [`count-lines.mjs`](../../../scripts/softcopyright/count-lines.mjs)、截图采集 [`capture-screens.mjs`](../../../scripts/softcopyright/capture-screens.mjs)。

## 一、git 提交规范

> 呼应 `AGENTS.md` 既有约定：commit message 默认中文；实现上最小 diff 优先。

- **message 用中文，一句话说明"改了什么 / 为什么"**，采用 Conventional Commits 前缀（`feat`/`fix`/`docs`/`refactor`/`chore` 等）+ 中文描述，例如 `feat(softcopyright): 有效代码行数统计与页数判定`。
- **禁止无意义提交**：不得使用 `fix`、`update`、`wip`、`misc` 等空泛标题；每个提交应能被一句话讲清改动意图。无法一句话讲清的改动应拆分为多个提交。
- **保留私有仓库完整 git 历史，不 squash、不重写历史**（不 `rebase`/`reset --hard`/`filter-branch` 重写已提交内容）。2026 新规将 git 历史作为**开发过程与 AI 辅助开发记录**的证据来源，重写历史会破坏证据链的时间线连续性；私有仓库保持私有（公开会被版权中心查重库收录）。
- 每次提交前 `git status` + `git diff --cached` 检查，只 stage 本任务文件，不 `git add -A` / `git add .` / `git add -u` 误入其他会话的未提交改动。

## 二、里程碑 tag 与 Release

> 作用：锚定"开发完成日期 / 首次发表日期"两个时间锚点。日期逻辑：**开发完成 ≤ 首次发表 ≤ 申请日**，开发完成日期须晚于主体成立时间。

- **V1.0 发布时**（Phase R 完成节点）执行：
  1. 打**附注 tag**：`git tag -a v1.0.0 -m "Release 1.0：..."`（附注说明对齐 CHANGELOG 摘要），并推送。
  2. 发布 **GitHub Release**：以 `v1.0.0` tag 为基础，正文包含 `CHANGELOG.md` 对应版本摘要；若无公开版，首次发表日期按「未发表」处理。
  3. 将**实际执行日期**登记到下方「里程碑记录表」，并同步更新 `ledger.md` 的「开发完成日期锚点」「首次发表日期锚点」两行状态。
- 私有仓库 tag 与 Release 只作为内部时间锚点，不构成公开发表；首次发表状态以申请时实际核实为准。

### 里程碑记录表

> **留空不杜撰**：仅在里程碑实际发生时登记真实日期（YYYY-MM-DD），未发生前保持空行。

| 里程碑 | 开发完成日期（tag `v1.0.0`） | 首次发表日期（GitHub Release / 未发表） | 备注 |
|---|---|---|---|
| Release 1.0（Phase R 完成） | （未发生，待填） | （未发生，待填） | |

## 三、源文件头注释规范

- **自有源文件**（`src/`、`src-tauri/src/`）**新建文件**时，头部注释包含软件全称与版本号占位，与 `scripts/softcopyright/config.json` 的 `softwareName` / `version` 一致（当前占位：`Clairis 渐晰阅读编辑软件`、`V1.0`），例如：

  ```ts
  // Clairis 渐晰阅读编辑软件 V1.0
  ```

- 头部注释仅标识软件归属，不得写入个人信息；申请前 `config.json` 定稿后，注释中的名称/版本随新文件同步更新。
- **既有文件不强制回填**——回填会导致 git 历史大范围改动，与「保留完整 git 历史」的证据链原则冲突（Decision 5）。

## 四、AI 辅助开发记录

> 2026 新规要求如实声明 AI 生成代码的工具、范围与修改记录。

- **保留 `.omo/evidence/` 与 git 历史**作为 AI 生成代码的修改记录证据：`.omo/evidence/` 存放各任务的执行证据（如 grep 断言输出、验证记录），git 历史记录每次改动的实际内容与时间。
- 申请前按 [`application.md`](./application.md) 的「AI 生成代码声明」模板，从 `.omo/evidence/` 与 git 历史汇总：使用的 AI 工具、辅助生成范围、人工修改与验证过程。
- `.omo/evidence/` 与 git 历史均为**持续积累**（M 级期起），不申请前临时补造。

## 五、行数守护与里程碑盘点

> 每个里程碑（Phase M 完成、Phase R / Release 1.0 发布）执行一次，作为阶段完成检查项。

1. 运行 `node scripts/softcopyright/count-lines.mjs`，将结果（日期、有效行数、统计口径）登记到 `ledger.md`「有效行数记录区」。
2. 运行 `node scripts/softcopyright/capture-screens.mjs`，按 `screens-config.json` 场景采集截图，更新 `ledger.md` 测试截图项状态。
3. 更新 `ledger.md` 各材料项状态，勾选对应阶段盘点 checklist（见 `ledger.md` 第三、四节）。

**截图采集触发点前置**：某功能域功能实现完成**即采集**该功能域截图——将 `screens-config.json` 中该场景从 `pending` 流转为 `ready`（`ready` 表示可真实截图；`pending` 表示功能未实现/环境不可达，不尝试截图），并在功能实现完成后运行采集脚本补采。**不等到申请前统一补拍**：截图只能在开发/测试期采集，过期不补。

> 本规范第 1、2 节（git 历史、tag/Release）与第 4 节（AI 记录）的遵守，随开发自然发生，不额外造作；第 3、5 节为主动执行的检查项。
