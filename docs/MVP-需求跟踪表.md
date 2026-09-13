---
title: MVP 需求跟踪表
type: delivery
status: superseded
last_updated: 2026-09-02
source_of_truth: historical
superseded_by: delivery/requirements-status.md
redirect: delivery/requirements-status.md
---

# 渐晰 MVP — 需求跟踪表

> ⚠️ **已废弃（2026-09-02）**：本表被 [需求实现状态总览](./delivery/requirements-status.md) 取代，仅作历史对照。需求跟踪的活入口为 `openspec/specs/` + `openspec/changes/`，状态一览见上表。

> **创建:** 2026-07-05  
> **用途:** 按功能点逐项跟踪，标注阶段、明确度、开发状态，作为开发执行依据  
> **对照:** MVP-渐明-v1.md 第三部分完整功能定义 + docs/product/ 与 openspec/specs/（原全量需求 `docs/CORE-REQUIREMENTS-clairis.md` 已被取代，仅作历史存根；仓库根目录同源副本已于方案 A 删除）

---

## 模块 A：核心阅读体验

| 编号  | 功能点           | 需求明确度 | 阶段  | 开发状态  | 说明                                                                             | 备注                                  |
| --- | ------------- | ----- | --- | ----- | ------------------------------------------------------------------------------ | ----------------------------------- |
| A-1 | 冷启动秒开         | ✅ 明确  | M   | 已完成   | 双击文件后 <1.5s 可读，冷启动到可交互 <1.0s                                                   | 沿用 V3 现有实现                          |
| A-2 | GFM 完整渲染      | ✅ 明确  | M   | 已完成   | 标题/列表/代码块/表格/链接/图片/粗斜体/任务/分割线/引用                                               | V3 marked 已实现，沿用                    |
| A-3 | HTML 预览       | ✅ 明确  | M   | 已完成   | iframe srcdoc + sandbox                                                        | E-1 方案 A 配合修改 CSP                   |
| A-4 | 纯文本支持         | ✅ 明确  | M   | 已完成   | .md / .html / .txt 各自以正确模式打开                                                   | V3 已实现                              |
| A-5 | 沉浸阅读          | ✅ 已明确 | R   | 已完成设计 | 进入/退出各 0.3s 过渡；Esc=退出；无状态快照=二进制切换；沉浸态字号=全局字号                                   | 已落地为 `openspec/specs/reading/spec.md`（设计依据 `docs/design/approved/immersive-reading/`） |
| A-6 | 字号缩放          | ✅ 已明确 | R   | 已完成设计 | 全局字号，CSS calc(ratio) 层级缩放；12-32px 步进；零新文件=现 config.json 字段；删字号数字提示；HTML rem 跟随 | 已落地为 `openspec/specs/reading/spec.md`（设计依据 `docs/design/approved/font-size-scaling/`） |
| A-7 | Dark/Light 主题 | ✅ 明确  | M   | 已完成   | 跟随系统 + 手动切换                                                                    | V3 已有实现，沿用                          |
| A-8 | 滚动顺滑          | ✅ 明确  | M   | 已完成   | 60fps，>500KB 自动降级                                                              | V3 已实现                              |
| A-9 | 阅读进度          | ✅ 已明确 | R   | 已完成设计 | 右侧 2px 墨线（常驻，已读/未读比例）+ 位置恢复（tabs[].scrollPos）+ 读完脉动触发；无 hover 面板、无 JSON 文件     | 已落地为 `openspec/specs/reading/spec.md`（设计依据 `docs/design/approved/reading-progress/`）  |

---

## 模块 B：导航体系（无侧栏 — V4 落地）

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| B-1 | 启动面板 | ✅ 已明确 | R | 已完成设计 | 首次启动中央渲染 0-welcome.md（产品展示）；0-welcome.md = README，展示格式清单、快捷键、安全感说明、CTA | 已落地为 `openspec/specs/application-shell/spec.md`（设计依据 `docs/design/approved/empty-state/`）+ `src-tauri/samples/0-welcome.md` |
| B-2 | 空白空状态 | ✅ 已明确 | R | 已完成设计 | 有 RecentFile 后叠加"继续上次"（scrollPos）+ "最近保存"（list_files mtime chips 5 个横向滚动）；按数据分块显示，不 if/else | 已落地为 `openspec/specs/application-shell/spec.md`（设计依据 `docs/design/approved/empty-state/`） |
| B-3 | 统一文件面板 | ✅ 已明确 | R | 待开发 | Cmd+P 三视图（空查询=当前上下文，输入=全局搜索，带选中文本=局部相关），Ctrl+1~9 直开条目；搜索范围：文件名+frontmatter title+H1+父目录 | 已落地为 `openspec/specs/navigation/spec.md`（设计依据 `docs/design/approved/navigation/`） |
| B-4 | 内置示例文件释放 | ✅ 已明确 | R | 已完成设计 | 释放到 `~/Documents/Jianxi/`；`.sample-bundle.json` marker 机制防重复释放、支持版本升级；三首示例文件内容已完成 | 已落地为 `openspec/specs/application-shell/spec.md`（设计依据 `docs/design/approved/empty-state/`）+ `src-tauri/samples/` |
| B-5 | 空状态设计规则 | ✅ 已明确 | R | 已完成设计 | 空白但不空旷：0-welcome.md 渲染；一键可达：主 CTA 首屏；历史是灵魂：最近保存 chips 5 个；快捷键提示：欢迎页内嵌 | 已落地为 `openspec/specs/application-shell/spec.md`（设计依据 `docs/design/approved/empty-state/`） |

---

## 模块 B+：文件面板交互

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| B-6 | 三视图切换 | ✅ 已明确 | R | 待开发 | 空查询=当前上下文，输入=全局搜索，带选中文本=局部相关 | 已落地为 `openspec/specs/navigation/spec.md`（设计依据 `docs/design/approved/navigation/`） |
| B-7 | Ctrl+1~9 直开 | ✅ 已明确 | R | 待开发 | 面板内数字1-9对应条目，一键打开，无需Enter | 已落地为 `openspec/specs/navigation/spec.md`（设计依据 `docs/design/approved/navigation/`） |
| B-8 | 后退/前进历史 | ✅ 已明确 | R | 待开发 | Cmd+[/Cmd+] 标准历史栈导航 | 已落地为 `openspec/specs/navigation/spec.md`（设计依据 `docs/design/approved/navigation/`） |

---

## 模块 C：文件管理基础

| 编号  | 功能点    | 需求明确度  | 阶段  | 开发状态 | 说明                                                                                                            | 备注                                              |
| --- | ------ | ------ | --- | ---- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| C-1 | 打开文件   | ✅ 明确   | M   | 待完善  | Cmd+O；文本类：.md/.html/.txt/.py/.yaml/.json/.js/.ts/.css/.csv 等以源码模式打开；媒体类：.pdf/.jpg/.png/.gif/.mp4/.mov 以预览模式打开 | V3 已注册部分文件关联 + 对话框                              |
| C-2 | 拖拽打开   | ✅ 明确   | M   | 已完成  | 拖入窗口松开即打开；支持 C-1 全格式                                                                                          | V3 已实现                                          |
| C-3 | 自动保存   | ✅ 明确   | M   | 已完成  | 编辑停止 2s 后自动写入                                                                                                 | V3 debounce 已实现                                 |
| C-4 | 新建文档 | ✅ 已明确 | R | 待开发 | Cmd+N 创建空白编辑页，初始内容 `""`，首次保存时选路径+文件名 | 决策：空文件，不加默认问候语。示例走 B-4 独立释放（~/Documents/Jianxi/），不归新建流程 |
| C-5 | 全部文件视图 | ✅ 已明确  | R   | 待开发  | 工作目录所有文件按 mtime 倒序，超 20 条折叠为"显示全部 →"                                                                          | 已落地为 `openspec/specs/navigation/spec.md`（设计依据 `docs/design/approved/navigation/`） |

---

## 模块 D：大纲侧栏 + Quick Capture

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| D-1 | 大纲侧栏 Cmd+Shift+E | ✅ 已明确 | P1 | 待开发 | Hover 展开 + Pin 固定,无标签页 | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-2 | Headings Palette Cmd+R | ✅ 已明确 | R | 待开发 | fuzzy 搜索 + 右侧 Preview + Enter 跳转 | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-3 | Quick Capture overlay | ✅ 已明确 | R | 已完成 | Cmd+Shift+.,热启动 <50ms,全局,Dock bounce | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-4 | prefix sticky 输入 | ✅ 已明确 | R | 已完成 | .问题 -待办 !灵感 ?思考,Enter=save,double-Enter=reset | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-5 | inbox daily file 保存 | ✅ 已明确 | R | 已完成 | inbox-YYYY-MM-DD.md + archive/ 子文件夹 | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-6 | 文件面板 QC 条目接入 | ✅ 已明确 | R | 待开发 | Cmd+P "继续" 分组嵌入 + 单条 archive/删除 | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-7 | QC 转正 | ✅ 已明确 | R | 待开发 | 转正为灵感文件夹 / 当前工作目录文档 | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-8 | Cmd+Shift+, Inspector | ✅ 已明确 | R | 待开发 | flat list + search + archive + 转正 | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-9 | QC filter / batch | ✅ 已明确 | P2 | 待开发 | filter tabs / batch archive / batch 转正 | 已落地为 `openspec/specs/capture/spec.md`（设计依据 `docs/design/approved/outline-quick-capture/`） |
| D-10 | 窗口宽高可调 | ✅ 已明确 | R | 已完成 | 拖拽四边/四角调整，320~600宽/280~800高，持久化 | v5.4 新增，SPEC §三.5 |
| D-11 | 面板拖拽分隔条 | ✅ 已明确 | R | 已完成 | textarea↔history 4px 分隔条，panelRatio 0.2~0.8，持久化 | v5.4 新增，SPEC §三.5 |
| D-12 | X 按钮保存关闭 | ✅ 已明确 | R | 已完成 | 有内容先保存再关闭，无内容直接关闭 | v5.4 新增，SPEC §三.5 |
| D-13 | Escape 无内容直接关闭 | ✅ 已明确 | R | 已完成 | 不再 minimize 到胶囊，直接关闭 | v5.4 新增，SPEC §三.7 |
| D-14 | Capsule tooltip 移除 | ✅ 已明确 | R | 已完成 | hover 无视觉反馈，只保留单击 popover + 双击恢复 | v5.4 新增，SPEC §三.8 |
| D-15 | 一次批量混合 prefix 录入 | ✅ 已明确 | R | 已完成 | 多行混合 prefix 一次批量提交；无前缀续行归并；空行硬分隔并清空 prefix；批内 capturedAt 严格互异（第 i 条 `Date.now() + i`）；失败降级链 `append_inbox_batch` → 逐条 `append_inbox` → localStorage `clairis_capture_fallback`；空切分结果不写入 | v5.5 新增，SPEC §三.12 |

---

## 模块 E：基础编辑能力

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| E-1 | 源码模式 | ✅ 明确 | M | 已完成 | 一键切换，保留编辑状态 | V3 已实现，沿用 |
| E-2 | GFM L2 编辑 | ✅ 已明确 | M | 已完成 | CM6 decoration 美化语法标记（bold/italic/quote/list/heading/code）。IME composition 降级和 Cmd+Click 导航留 P1 | 决策：当前 decorations 已覆盖核心语法，M-2 视为完成。IME/Cmd+Click 为 P1 polish，不影响核心读写 |
| E-3 | 保存文件 | ✅ 明确 | M | 已完成 | Cmd/S + 原子写入 | V3 tempfile→persist 已实现 |
| E-4 | HTML 源码编辑 | ✅ 明确 | M | 已完成 | CM6 html() 语法高亮 | V3 已实现 |

---

## 模块 F：HTML 预览增强（方案 A）

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| F-1 | CSP 放宽 | ✅ 已明确 | R | 待开发 | iframe CSP 放宽为 `default-src * 'unsafe-inline'; script-src 'none'`，脚本仍禁止/其余全放行 | ponytail: 一步到位不加白名单配置页，安全底线=script-src none。HTML 编辑联调留 Phase 1 |

---

## 模块 G：界面布局（基于 V4 无侧栏决策）

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| G-1 | 移除左侧栏逻辑 | ✅ 已明确 | R | 待开发 | 移除 Toolbar 左栏按钮、移除 Cmd+\ 快捷键、leftSidebar 传 null | 设计文档：`openspec/specs/application-shell/spec.md`（设计依据 `docs/design/approved/shell-ui/`） |
| G-2 | 右侧边栏默认隐藏+空占位 | ✅ 已明确 | R | 待开发 | Clairis 无边栏哲学 — **无右侧边栏**。收回原设计，导航由 Cmd+P 承担 | 设计文档：`openspec/specs/application-shell/spec.md`（设计依据 `docs/design/approved/shell-ui/`） |
| G-3 | 工具栏 hover 淡入 | ✅ 已明确 | R | 待开发 | Toolbar 被删除 — 合并进 Chrome Bar（单一顶栏 40px） | 设计文档：`openspec/specs/application-shell/spec.md`（设计依据 `docs/design/approved/shell-ui/`） |
| G-5 | 正文分栏（可选） | ✅ 已明确 | R | 待开发 | Cmd+Option+→/↓ 分栏，拖拽页签到边缘生成，分隔线 hover 暗示，独立 TabBar | 设计文档：`openspec/specs/application-shell/spec.md`（设计依据 `docs/design/approved/shell-ui/`） |

---

## 模块 H：设置与配置

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| H-1 | 正文字号 | ✅ 明确 | M | 已完成 | 16px 默认，12-32px，12-32px，持久化 | 跟随 A-6 |
| H-2 | 主题跟随系统 | ✅ 明确 | M | 已完成 | 自动/亮色/暗色 | V3 已实现 |
| H-3 | 界面语言 | ✅ 明确 | M | 已完成 | 中文 | V3 已实现 |
| H-4 | 默认打开方式 | ✅ 已明确 | R | 待开发 | 打开文件默认进入预览模式（非编辑），用户手动切换才进入编辑 | — |
| H-5 | 自动保存间隔 | ✅ 明确 | M | 已完成 | 2s debounce | V3 已实现 |

---

## 模块 I：展卷仪式系统

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| I-1 | 展卷动画 | ✅ 明确 | P1 | 待开发 | 非阻塞、可跳过、批量抑制、TTI <1.0s | 待 openspec 建立（当前仅在 CORE-REQUIREMENTS §二 P1） |
| I-2 | 收卷仪式 | ✅ 明确 | P1 | 待开发 | 微型总结+合卷动画 | 待 openspec 建立（当前仅在 CORE-REQUIREMENTS §二 P1） |
| I-3 | 自动专注联动 | ✅ 明确 | P1 | 待开发 | 进入专注模式自动触发仪式 | 待 openspec 建立（当前仅在 CORE-REQUIREMENTS §二 P1） |

---

## 模块 J：视觉引擎

| 编号 | 功能点 | 需求明确度 | 阶段 | 开发状态 | 说明 | 备注 |
|------|--------|----------|------|---------|------|------|
| J-1 | CanvasFrame 完整实现 | ✅ 明确 | P1 | 待开发 | 注册制视觉引擎，支持 30+ 语法高亮 | 待 openspec 建立（当前仅在 CORE-REQUIREMENTS §二 P1） |

---

## 里程碑跟踪（Phase M）

| 编号 | 里程碑 | 待解决的需求点 |
|------|--------|---------------|
| M-2 | L2 编辑器 bug 修复 | ✅ 已明确 | E-2 decorations 已覆盖核心语法，IME/Cmd+Click 留 P1 |
| M-3 | 移除左侧栏逻辑 | ✅ 已明确 | G-1 设计已定：Toolbar 移除左栏按钮，App 移除 Cmd+\ 快捷键 |
| M-4 | 右侧边栏默认隐藏 | ✅ 已明确 | Clairis 无边栏 — 导航由 Cmd+P 承担 |
| M-5 | 工具栏 hover 淡入 | ✅ 已明确 | Chrome Bar 常驻显示（不再需要 hover 触发），40px 单一顶栏 |
| M-6 | i18n 中文 | 确认所有菜单位置是否已覆盖 |
| M-7 | 软著截图+说明书 | B-1/B-4 设计已完成，待 R 阶段开发完成后截图 |

---

## 备注

- ⚠️ 标记 = 需求需具体明确，再开发  
- ❌ 标记 = 需求需先设计，才能开发  
- ✅ 标记 = 当前已明确或已有 V3 实现，可直接开发

---

> 本文档为渐晰开发**唯一跟踪依据**。  
> 任何 ⚠️/❌ 标记的功能点，开发前必须先回复明确需求并更新此表。  
> 功能进度变化格式：待开发 → 开发中 → 待测试 → 已完成。  
> 任何变更须同步更新 `openspec/specs/` 功能规格，并在 `docs/delivery/roadmap.md` 反映阶段归属（原 `docs/CORE-REQUIREMENTS-clairis.md` 已被取代，不再维护）。

---

## 开发状态跟踪（过渡期说明）

本表的「开发状态」列（已完成/已完成设计/待开发）仍作为人工状态概览，便于一览全局进度。

权威跟踪机制如下：
- **当前功能行为**（怎么算对）：见 `openspec/specs/<domain>/spec.md`
- **进行中变更**（正在改什么）：在 `openspec/changes/<change-name>/` 建立变更工作包（proposal + design + tasks + delta specs）；完成后归档到 `openspec/changes/archive/` 并合并到 `openspec/specs/`
- **已批准设计**（体验定案）：见 `docs/design/approved/<feature>/`
- **阶段与里程碑**：见 `docs/delivery/roadmap.md`

过渡期：`openspec/changes/` 当前为空（尚无活跃变更）。在建立第一个 OpenSpec 变更工作流前，本表仍是开发状态的概览入口；建立后，逐功能状态以 OpenSpec 变更为准。
