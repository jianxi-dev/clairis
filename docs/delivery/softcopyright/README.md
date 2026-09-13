---
title: 软著资料准备（域入口）
type: delivery
status: draft
last_updated: 2026-08-02
---

# 软著资料准备（softcopyright）

Clairis（渐晰）软件著作权登记申请的**资料积累与准备域**。定位：从 Phase M 开发期开始的持续积累体系，申请时机在 Phase R（Release 1.0 稳定版发布）之后，保证申请时资料自然齐全。

- 阶段参照：Phase M = 软著 MVP（占位与最小可用），Phase R = Release 1.0（正式发布），见 [`roadmap.md`](../roadmap.md)。
- 规划与决策来源：`../../../.omo/drafts/clairis-software-copyright-prep.md`。
- 工具与配置：`scripts/softcopyright/`（行数统计、截图采集、源代码文档生成）。

## 本域文档

| 文档 | 职责 | 状态 |
|---|---|---|
| [资料台账 `ledger.md`](./软著资料台账.md) | 材料清单 + 状态 + 采集时机 + 盘点 checklist（**域核心**） | 已建立 |
| [开发流程证据链规范 `process.md`](./process.md) | git 提交 / 里程碑 tag 与 Release / 文件头注释 / AI 辅助开发记录 / 行数守护与盘点 | 已建立 |
| [申请操作手册 `application.md`](./application.md) | 主体核实、字段映射、日期逻辑、补正预案、自查清单 | 后续任务建立 |
| [说明书骨架 `manual-skeleton.md`](./manual-skeleton.md) | 说明书结构、截图规范、正文模板 | 后续任务建立 |
| [测试截图 `screenshots/`](./screenshots/) | 按功能域采集的测试截图（含软件名称与版本号），可入库作为证据链 | 随开发采集 |

## 与工具目录的关系

- 执行入口（命令）见 [`scripts/softcopyright/README.md`](../../../scripts/softcopyright/README.md)：`count-lines.mjs`（有效行数统计）、`capture-screens.mjs`（截图采集）、`build-source-doc.mjs`（源代码文档 PDF，申请前使用）。
- 唯一配置源 `scripts/softcopyright/config.json`（软件名称/版本号占位、统计口径、截图目录）。
- 本域文档只承载**规范与记录**；生成的 PDF 等产物在 `scripts/softcopyright/out/`，永不入库。

## 使用方式

- **开发期（现在起）**：按 `process.md` 执行 git 提交、文件头注释、AI 记录；功能域实现完成即采集截图；台账状态随开发更新。
- **里程碑（Phase M / R）**：按 `process.md` 第五节与 `ledger.md` 第三、四节执行盘点。
- **申请前**：依 `application.md` 核对字段与日期链，用 `build-source-doc.mjs` 生成源代码文档，依 `manual-skeleton.md` 完成说明书。
