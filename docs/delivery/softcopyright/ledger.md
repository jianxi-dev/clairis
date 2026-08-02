---
title: 软著资料台账
type: delivery
status: draft
last_updated: 2026-08-02
---

# 软著资料台账

Clairis（渐晰）软件著作权登记申请的材料清单与追踪台账。**台账为核心**（规划 Decision 1）：从现在（Phase M 开发期）开始积累，申请时机在 Phase R（Release 1.0 稳定版发布）之后。

- 阶段参照：Phase M = 软著 MVP（占位与最小可用），Phase R = Release 1.0（正式发布），见 [`roadmap.md`](../roadmap.md)。
- 规划与决策来源：[`.omo/drafts/clairis-software-copyright-prep.md`](../../../.omo/drafts/clairis-software-copyright-prep.md)。
- 工具配置：`scripts/softcopyright/config.json`；说明书骨架、操作手册、模板小节见 `docs/delivery/softcopyright/application.md`（后续任务建立）。

## 一、材料清单

> 采集时机列：**M 级期** = Phase M 开发/测试期间采集（过期不补，如截图）；**R 级期** = Phase R 发布期采集；**申请前** = 正式申请前定稿。
> 状态枚举：未开始 | 积累中 | 已具备。所有行初始为「未开始」，不杜撰日期，盘点时如实更新。

| 材料项 | 2026 规范要求 | 来源/产出 | 采集时机（M 级期/R 级期/申请前） | 状态（未开始\|积累中\|已具备） | 证据位置 | 缺口处理 |
|---|---|---|---|---|---|---|
| 源代码文档 | 仅自有代码；前 30 后 30 页、每页 ≥50 行（去空行）；<3000 行全量；页眉标注软件名+版本号 | `build-source-doc.mjs` 生成 PDF（任务 5） | 申请前 | 未开始 | `scripts/softcopyright/out/`（不入库） | 依赖行数统计与配置定稿 |
| 有效行数报告 | 报告需标注统计口径（扩展名/排除规则/去空行） | `count-lines.mjs`（任务 3）+ 台账记录 | M 级期（首次）+ R 级期（终版） | 未开始 | 本台账「有效行数」记录区（下方） | 工具待建（任务 3） |
| 说明书 | ≥10~15 页图文并茂，真实截图 | `manual-skeleton.md` + 手册正文（后续任务） | R 级期 + 申请前 | 未开始 | `docs/delivery/softcopyright/manual-skeleton.md` | 骨架待建（任务 5） |
| 测试截图（每功能域） | 截图须含软件名称与版本号；真实渲染，禁止虚构/PS；不截用户真实数据 | `capture-screens.mjs` + `screens-config.json`（任务 2），复用 e2e tauri-mock 桥 | **M 级期**（随功能域开发采集）+ R 级期复采 | 未开始 | `docs/delivery/softcopyright/screenshots/` | 采集脚本与场景配置待建（任务 2） |
| 功能与技术特点概述 | 概述核心功能与技术特点，与说明书/截图一致 | 按 openspec 6 功能域规格撰写 | R 级期 + 申请前 | 未开始 | `docs/delivery/softcopyright/application.md`（操作手册内模板） | 依赖操作手册（后续任务） |
| 开源组件与许可清单 | 如实列出第三方依赖及许可证 | 由 `package.json` / `Cargo.toml` 依赖核对整理 | M 级期（首次核对）+ R 级期复核 | 未开始 | 待定（建议 `docs/delivery/softcopyright/third-party-licenses.md`） | 首次核对清单待建 |
| 申请表字段 | 按版权中心 2026 登记申请表逐字段核对 | 操作手册字段映射表 | 申请前 | 未开始 | `docs/delivery/softcopyright/application.md` | 依赖操作手册（后续任务） |
| 申请表正式件与签名扫描件 | 线上填报 + 签章扫描件，格式按中心要求 | 申请时从版权中心官网填报生成 | 申请前 | 未开始 | 不入库（含个人信息） | 申请主体核实后执行 |
| 主体身份材料 | 个人名义申请：身份证件等；申请前向版权中心核实主体要求 | 申请人自备 | 申请前 | 未开始 | 不入库（含个人信息） | 申请前核实（规划 Open assumption） |
| 开发完成日期锚点 | 开发完成 ≤ 首次发表 ≤ 申请日；开发完成晚于主体成立时间 | git 历史 + 里程碑 tag（`v1.0.0`）锚定 | R 级期 | 未开始 | git tag + `CHANGELOG.md` | 依赖 R 级发布（规划 Decision 4） |
| 首次发表日期锚点 | 同上日期链；无公开则填「未发表」 | GitHub Release | R 级期 | 未开始 | GitHub Release 页 | 依赖 R 级发布（规划 Decision 4） |
| AI 生成代码声明 | 如实声明 AI 辅助生成代码的工具、范围与修改记录 | `.omo/evidence/` 记录 + git 历史 | M 级期（持续积累）+ R 级期汇总 | 未开始 | `.omo/evidence/`、git 历史 | 按 [application.md「AI 生成代码声明」模板](./application.md) 填写（模板后续任务建立） |
| git 开发记录 | 官方建议保留 git 开发记录作为原创性证据 | 仓库 git 历史（中文提交） | M 级期（持续积累） | 未开始 | git 历史（本仓库） | 无缺口，随开发自然积累 |
| 查重预案 | 官方查重 >30% 需独创性说明；避免与公开代码撞库 | 查重报告 + 独创性说明 | 申请前 | 未开始 | 待定（建议 `scripts/softcopyright/out/`） | 按 [application.md「查重预案」模板](./application.md) 演练（模板后续任务建立） |
| 受理/补正记录 | 补正 ≤2 次否则驳回；记录受理与补正往来 | 版权中心系统记录 | 申请前（申请后） | 未开始 | 不入库（含个人信息） | 申请后如实登记 |
| 软件名称与版本号定稿 | 命名规范：品牌号+核心功能+后缀；与商标权人一致 | `config.json` 定稿 + 申请核对 | R 级期 + 申请前 | 未开始 | `scripts/softcopyright/config.json` | 当前为占位值，申请前定稿 |
| 文件头注释 | 自有源文件头部含软件全称与版本号（与申请材料页眉一致） | 源文件头部注释，既有文件不强制回填 | M 级期（新文件随写） | 未开始 | `src/`、`src-tauri/src/` | 规划 Decision 5，随开发执行 |

## 二、有效行数记录区

> 每次运行 `count-lines.mjs` 后在此登记：日期、有效行数、统计口径（扩展名/排除规则）。当前尚未首次运行，留空待填。

| 日期 | 有效行数 | 统计口径说明 |
|---|---|---|
| （待填） | | |

## 三、M 级盘点 checklist（Phase M 完成时执行）

- [ ] 已运行行数统计并登记有效行数（本台账记录区）
- [ ] 六个功能域（reading/editing/file-management/navigation/capture/application-shell）测试截图已采集，且截图含软件名称与版本号
- [ ] 台账各材料项状态已如实更新（无「积累中」项停留在旧状态）
- [ ] 开源组件与许可清单完成首次核对
- [ ] AI 生成代码声明完成初稿（按 application.md 模板）

## 四、R 级盘点 checklist（Phase R / Release 1.0 发布时执行）

- [ ] 终版行数统计完成，源代码文档 PDF 已生成（build-source-doc.mjs）
- [ ] 申请表字段逐一核对完毕（application.md 字段映射）
- [ ] 开发完成日期锚点（git tag `v1.0.0`）与首次发表日期锚点（GitHub Release）已定稿
- [ ] 申请前终检：全部材料项状态 = 已具备，无「未开始」残留
- [ ] 查重预案已演练（查重报告 + 独创性说明就绪）
