---
title: 插件管理机制对标研究：DeepSeek Harness / Pi / Obsidian / Omarchy → Clairis
type: research
source_of_truth: supporting
status: draft
last_updated: 2026-11-02
---

# 插件管理机制对标研究：DeepSeek Harness / Pi / Obsidian / Omarchy → Clairis

> 目的：为 Clairis 设计插件（扩展）管理机制提供对标依据。素材为各产品官方文档一手来源 + 本仓库现状调查（2026-09-27）。
> 关联：Omarchy→Clairis 设计映射见 `omarchy-zh/.scratch/.../21-design-to-clairis.md`（ticket #21）。

---

## 一、四个产品的插件机制概览

### 1. DeepSeek Harness —— "一切皆插件"（Cordis 元框架）

**架构底座**：其插件系统建立在 Cordis 框架（`@deepseek-ai/cordis`，论文 arXiv 2608.25512）之上。Cordis 提供"时空可组合性"两个正交维度的形式化保证：

- **时间可组合性（revertible effects）**：每个组件通过 context 注册的所有副作用（事件监听、工具、定时器、服务）都自动携带逆操作，**插件卸载时自动完整回滚**——不需要手写 removeListener/clearInterval。
- **空间可组合性（reactive coeffects）**：组件用 `inject = ['tools', 'llm']` 声明依赖，框架保证依赖就绪后才激活组件；context 变更自动驱动激活/停用。

**插件形态**：就是一个导出 `apply(ctx)` 的 TypeScript 模块（函数/对象/Service 类三种形式）。**没有传统 manifest 文件**——本地插件通过 `cordis.yml` patch（覆盖层）注册绝对路径，`pnpm dsh web --patch ./cordis.yml` 加载。

**管理方式**：极简。当前处于开发者导向阶段，无插件市场、无权限模型、无沙箱（文档未提及）。"一切皆插件"落地为：任何能力（工具/服务/事件/定时器）都经同一个 `ctx` 注册并纳入自动清理体系。

### 2. Pi Agent —— TypeScript 进程内扩展 + 包分发

- **形态**：TS/JS 模块（`jiti` 免编译加载），单文件 / 目录（`index.ts`）/ npm 包（`package.json` 里 `pi.extensions` 字段）三种。
- **两级位置**：全局 `~/.pi/agent/extensions/`，项目级 `.pi/extensions/`（**需项目信任后才加载**）。另有 `settings.json` 的 `packages` 数组支持 `npm:` / `git:` / `builtin:` 协议分发。
- **能力面极宽**：注册工具、命令、快捷键、provider、MCP server、UI 组件、会话生命周期钩子（40+ 事件）、消息管线钩子（tool_call 可拦截/改写）。
- **安全立场**：**明确声明无沙箱**——扩展与宿主同权限运行，"只加载可信来源"；安全靠 `project_trust` 事件做项目级信任门。
- **热重载**：`/reload`。

### 3. Obsidian —— 核心插件 / 社区插件双轨制

- **核心插件**：官方内置、默认部分开启、可逐个关闭，与 app 同版本发布，不需要"安装"。
- **社区插件**：每个插件是 vault 内 `.obsidian/plugins/<id>/` 目录（`manifest.json` + `main.js` + 可选 `styles.css` + `data.json` 存设置）。
  - manifest：`id/name/author/version/minAppVersion/description`（封闭 schema）。
  - 生命周期：`onload()` / `onunload()`，设置经 `loadData()/saveData()` 读写 `data.json`。
- **安全模型**：
  - 默认 **Restricted Mode**——不执行任何第三方代码；用户显式开启社区插件。
  - 社区目录**每个版本都过自动安全扫描**（2025 起从"仅首次人工审"升级为全版本自动审）+ 开发者政策约束。
- **分发**：官方社区目录（集中审核上架），不做 npm/git 直装。

### 4. Omarchy —— "扩展点 = 数据文件"（约定优于 API）

Omarchy 没有传统意义上的插件系统，它的可扩展性来自**约定式数据文件**：

- 菜单 = `omarchy-menu.jsonc`；钩子 = `~/.config/omarchy/hooks/<event>.d/` 目录；主题 = 语义 token TOML + `*.tpl` 模板渲染 + 原子切换；shell = `shell.json`。
- **所有权三分**：`/usr/share/omarchy`（系统，升级可覆盖）/ `~/.config`（用户，升级永不碰）/ 运行时生成态。
- 第三方主题被**剥掉可执行文件**只留颜色数据——用数据格式本身限制插件能力，而非沙箱。
- 更新走唯一入口（锁 + 快照 + 幂等 migrations），扩展即数据所以天然可回滚。

---

## 二、横向对比

| 维度 | DeepSeek Harness | Pi | Obsidian | Omarchy |
|---|---|---|---|---|
| 插件形态 | `apply(ctx)` TS 模块 | TS/JS 模块（文件/目录/npm 包） | manifest+main.js 目录包 | 数据文件（jsonc/toml/目录约定） |
| 真相源 | cordis.yml patch 覆盖层 | 目录发现 + settings.json | `.obsidian/plugins/` + 官方目录 | 约定路径数据文件 |
| 分发 | 无（开发者直载） | npm / git / builtin 协议 | 官方集中目录（审核上架） | git 仓库（整机 omakase） |
| 能力边界 | ctx 注册一切，自动清理 | 全宿主能力 + 40+ 生命周期钩子 | Plugin API（UI/命令/设置/事件） | 仅数据（无可执行面） |
| 安全 | 无沙箱/权限模型（未提及） | 同权限运行 + 项目信任门 | Restricted Mode + 全版本自动扫描 + 政策 | 剥离可执行内容 |
| 生命周期 | 注册即 tracked，卸载自动回滚 | 事件驱动（session_start/shutdown 等） | onload/onunload | 无运行时（数据渲染） |
| 隔离 | 无 | 无 | 无（但默认关闭第三方代码） | 格式性隔离 |
| 热重载 | dev patch | /reload | 重启 vault | 即改即生效（数据） |

**共同规律**（四家无一例外）：

1. **插件真相源是文件系统目录**，不是注册表/数据库——可 git、可备份、可被 agent 读写。
2. **生命周期必须有卸载回滚**：Harness 用 effect 逆操作自动化，Obsidian 用 onload/onunload 约定，Pi 用事件。没有回滚约定的插件系统都会腐烂。
3. **安全 = 默认关 + 显式开 + 来源可信**，四家都不做真沙箱（Obsidian 的 Restricted Mode、Pi 的 project trust、Omarchy 的数据化）。
4. **数据文件优先于 API**：能力面越收敛为声明式数据，插件越安全、越可被 AI 生成。

---

## 三、Clairis 现状与定位

- **无面向用户的插件系统**。代码中 `plugin/extension` 全部是编辑器内部实现（CM6 extensions、slash 菜单、marked math extension）。
- **最接近"插件"的既有机制**是 mdpkg（Markdown 打包格式）：`manifest.extensions.symbols`（`off|core|extended`）与 `extensions_required`（封闭 schema，不支持项报错 E702）——这是**文档级**的能力声明，不是应用级插件。
- 产品信条（`docs/product/principles.md`）："用最少干扰达成用户所愿"、键盘优先 ≥80%、无边栏零弹窗。**大而全的插件管理 UI 与信条冲突**。
- Omarchy 映射报告（ticket #21）已给出关键判断：**"扩展点 = 数据文件，先做约定式数据，再做插件 API"**（启示 8）+ 所有权三分（启示 3）。

## 四、对 Clairis 的设计建议

按 Omarchy 支柱模型组织：**omakase 默认 + 约定式扩展 + agent 可重塑**，三个来源各取所长：

### 建议 1：双轨制取 Obsidian，默认体验取 Omarchy（omakase）

- **内置能力 = 核心插件化**：把 Clairis 内置功能（数学渲染、代码高亮、拖拽上传…）按"核心插件"组织——统一可开关、统一生命周期，但**默认全开、藏进设置深处**（不学 Obsidian 的长开关列表，学 Omarchy 的"默认值即产品"）。
- **这一步不需要插件 API**，只是内部架构收敛：每个核心能力实现 `enable()/disable()` 幂等接口。它为未来社区插件铺路（同一个生命周期约定），又立刻改善内部代码组织。

### 建议 2：扩展点先做数据文件，不做代码 API（Omarchy 原则 8）

第一优先级扩展点全部声明式：

- **主题/排版** = 语义 token 文件（对齐 mdpkg 的 symbols 分级思路与 Omarchy 的 token 管线）
- **slash 命令片段 / 快速捕获模板** = `~/.clairis/snippets/`、`~/.clairis/templates/` 目录约定
- **AI 技能/提示词** = markdown 文件目录（对齐 pi 的 skills 模型）

数据文件天然满足：无执行风险、可 git、可被 agent 直接读写生成、卸载即删文件（时间可组合性退化版）。

### 建议 3：若做代码级插件，取 Pi 形态 + Obsidian 安全门

- 形态：TS 模块 + `manifest.json`（封闭 schema：`id/name/version/minAppVersion`），目录 `~/.clairis/plugins/<id>/`；生命周期 `onload()/onunload()`，注册项统一 tracked、卸载自动清理（学 Cordis 的 effect 追踪思想，不必引框架）。
- 安全：**默认关闭第三方插件**（Restricted Mode 等价物）+ 目录级信任确认；远期分发再考虑审核，现阶段不做市场。
- 与 Clairis 信条的衔接：插件管理入口放设置深处，无常驻 UI，零弹窗。

### 建议 4：升级永不毁用户数据 = 结构性目录三分

采纳 Omarchy 启示 3：

```
<app resources>/        内置默认（升级可整体覆盖）
~/.config/clairis/      用户覆盖层（升级永不碰；snippets/templates/plugins 皆在此）
~/Library/Application Support/clairis/  运行时生成态（缓存/索引）
```

### 分阶段路线

| 阶段 | 内容 | 对标 |
|---|---|---|
| P0（无 API） | 核心能力插件化（统一 enable/disable）+ 数据文件扩展点（snippets/templates/主题 token）| Omarchy |
| P1 | manifest + onload/onunload + 信任门，支持本地目录安装 | Pi 形态 + Obsidian 安全 |
| P2 | 分发（git/npm 协议）、社区目录、自动扫描 | Obsidian / Pi packages |

**一句话结论**：Clairis 不需要"插件市场"式的管理界面，需要的是**Omarchy 式的数据文件扩展点 + Obsidian 式的双轨与安全门 + Cordis 式的卸载回滚纪律**——先让"放一个文件到某个目录"成为唯一的插件形态，等真实需求出现再上代码级 API。
