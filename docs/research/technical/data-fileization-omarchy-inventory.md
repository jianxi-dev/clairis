---
title: 数据文件化盘点——omarchy 扩展点落地现状、AI 可改通路与数据范围
type: research
source_of_truth: supporting
status: draft
last_updated: 2026-11-10
---

# 数据文件化盘点——omarchy 扩展点落地现状、AI 可改通路与数据范围

> **目的**：回答四个问题——数据文件化是如何实现的、任务如何安排落实、如何让数据尽可能文件化后 AI 可直接修改、数据文件化的范围有哪些。
> **依据**：`docs/research/technical/plugin-management-benchmark.md`（Omarchy「扩展点 = 数据文件」对标）、已归档 change `2026-11-01-text-config-layer` 与 `2026-11-03-extension-points` 的 design.md、已归档 change `layout-portal`（[#170](https://github.com/jianxi-dev/clairis/issues/170)）的 design.md D11、ADR 0004/0005。
> **效力**：第 6 层 research（supporting），不参与行为裁定；行为真相源在 `openspec/specs/` 与 change 内。
> **勘误（2026-11-10）**：本文 11-04 版有三处与代码不符，已就地更正——①`user/views/{rail,grid,preview}.json` **从未实现**：`layout-portal` D11 未按独立文件落地，视图规格实际合并进 `user/settings.json` 的 `railViewSpec` / `previewSettings` / `aiViewSpec` / `paneLayout` 四字段（现状见 `docs/architecture/overview.md` §7；`grep -rn "user/views" src-tauri/src` 零命中）；②扩展管理面已落地（`src-tauri/src/extension_packages.rs`，[#184](https://github.com/jianxi-dev/clairis/issues/184) 已关闭）；③扩展点根目录是 `app_config_dir()`——macOS `~/Library/Application Support/dev.biaoyue.app/`、Linux `~/.config/dev.biaoyue.app/`，文中 `~/.config/clairis/` 为旧标识符写法。数据面现行判据已升级为 `docs/agents/data-surface.md`（六栏落点 + 机检），本文 §3.2 保留为历史推理。

---

## 一、数据文件化是如何实现的（已落地机制）

Omarchy 的核心借鉴是：**扩展点 = 数据文件，不执行用户代码**（benchmark 建议 2 → extension-points change 前提 D6）；加上**所有权三分**目录约定（benchmark 建议 4）。落地分两批：

### 1.1 配置三层与快照回滚（text-config-layer，2026-11-01 归档，已实现）

在 `app_config_dir()` 下建立四类文件，这是数据文件化的**底座**：

```
defaults/settings.json              # 内置默认（随包发布，升级整体覆盖，用户不可改）
user/settings.json                  # 用户层 / AI 唯一写入口（升级永不触碰）
state/state.json                    # 派生状态（recentFiles、scrollPositions）
snapshots/settings-<RFC3339>.json   # user 快照，最近 10 份
```

关键机制（design.md D2–D8）：

- **合并**：有效配置 = defaults ← user 深合并（`serde_json::Value`），前端只看到合并后的 `AppConfig`，结构不变。
- **原子写**：任何写路径先校验 → 写前快照当前 user → tempfile 原子替换；**任何失败路径不产生部分写入**。
- **快照回滚**：写入前自动快照（保留 10 份），`restore_config_snapshot` 一键恢复（拒绝路径穿越）。
- **校验门**：字段级白名单（字号/宽度/比例/主题枚举），非法值拒绝，磁盘不变。
- **热应用**：后端 500ms 轮询 `user/settings.json` 的 `(mtime, len)`，变化即 `config-changed` 事件 → 前端即时生效。**文件被外部改（包括 AI 直接改）也能被发现**——这是「数据文件化后 AI 可改」的物理前提。

### 1.2 扩展点 = 数据文件（extension-points，2026-11-03 归档，已实现）

同一目录三分哲学扩展到用户可扩展点——**放一个文件到某个目录就生效**：

| 扩展点 | 位置 | 格式 | 生效方式 |
|---|---|---|---|
| snippets（斜杠命令） | `app_config_dir()/snippets/*.md` | frontmatter `id/label/keywords/icon` + 正文即插入文本 | 目录扫描 → 注入斜杠菜单；插入走 `insertCommandTextAt` 单事务可撤销 |
| templates（新建页模板） | `app_config_dir()/templates/*.md` | 文件名即模板名；占位符仅 `{{date}}`/`{{title}}` | 新建页选择后写入；未知占位符原样保留不吞内容 |
| theme tokens（主题覆盖） | `app_config_dir()/theme.toml` | `[tokens]` + 仅颜色值 | 白名单：只接受已声明 `--app-*` 键；未知键忽略并聚合告警；删文件即恢复默认 |
| 核心能力开关 | 设置·高级·能力 | `{ id, enable(), disable() }` 幂等接口 | 默认全开、无常驻 UI；关闭=移除扩展不删数据 |

容错原则：单个文件格式非法 → 跳过该文件并在设置里列出原因，**不影响其它文件**；目录不存在/扫描失败 → 返回空列表不算错误。这继承了 Omarchy「用数据格式本身限制能力」（无执行面 → 最坏结果是「没生效」而不是「搞坏应用」）。

---

## 二、任务是如何安排落实的（已完成 vs 排队中）

| 批次 | change / 票 | 内容 | 状态 |
|---|---|---|---|
| 底座 | `2026-11-01-text-config-layer` | 三层配置 + 原子写 + 快照回滚 + 热应用 | ✅ 已归档（4/4 票） |
| 执行层 | `2026-11-01-ai-agent-loop` + `ai-entry-v1` | agent 循环（三工具）、确认卡三档、撤销/快照 UI | ✅ 已归档 |
| 扩展点 P0 | `2026-11-03-extension-points`（[#76](https://github.com/jianxi-dev/clairis/issues/76)/[#78](https://github.com/jianxi-dev/clairis/issues/78)） | snippets / templates / theme.toml / 能力开关 | ✅ 已归档（4/4 票，票未关需收尾） |
| 视图规格文件化 | `layout-portal`（[#177](https://github.com/jianxi-dev/clairis/issues/177)、[#179](https://github.com/jianxi-dev/clairis/issues/179)，均已关闭） | 设计为 `rail.json`/`grid.json`/`preview.json`/布局树 + 快照 10 份（design.md D11） | ❌ **未按 D11 落地**：change 已归档（16/16 票），但独立文件从未实现；视图规格合并进 `user/settings.json` 四字段（overview §7） |
| 扩展管理面 | `layout-portal` [#184](https://github.com/jianxi-dev/clairis/issues/184)（已关闭） | 文件夹式扩展（manifest.json + SKILL.md）、拖入即启用、AI 生成、导出 | ✅ 已落地（`src-tauri/src/extension_packages.rs`） |
| AI 技能文件化 | 未立项 | 提示词/SKILL 目录约定（对齐 pi skills 模型，benchmark 建议 2 第三条） | 🗒 未立项 |

落实方式遵循仓库硬约束：**每批能力 = 一个 OpenSpec change**（G0–G4 五 gate），数据文件的目录、格式、校验规则写进 change 的 design.md D 条，验收锚点进 `anchors.md`/`conformance.json`，逐票实施逐票验收。**不做「一次把所有数据都文件化」的大票**——每批跟着需要它的功能 change 走，避免没有消费者的空目录。

---

## 三、如何让数据尽可能文件化后 AI 可直接修改

### 3.1 三条设计保障（已实现或已在 change 中锁定）

1. **真相源是文件，不是注册表**（benchmark 共同规律 1）：AI 与用户读写**同一份文件**（`user/settings.json`、`app_config_dir()/*.md|toml`），不存在「AI 改了内存、用户存盘被覆盖」的双真相问题。
2. **写路径收敛 + 热应用**：结构化配置走 `save_config`（校验→快照→原子写）；文件被外部改动由 500ms 轮询发现并 `config-changed` 热生效。**AI 既可走受控写，也可直接改文件**，两条路都即时生效且不产生部分写入。
3. **可逆兜底（D7 铁律）**：写前确认卡（人话、三档密度）+ 写前快照（10 份）+ 撤销条；AI 改坏了 `restore_config_snapshot` 一步回来。视图规格类改动（#179）同样经确认卡+快照链路。

### 3.2 「尽可能文件化」的可操作判据（评审清单）

拿到任何「应该可配置/可扩展」的需求时，按序回答：

- **需要改源码吗？** → 需要 = 违反 D6，先想办法变成文本（P4）。
- **是可变状态吗？** → 是 = 应落 `user/` 层文本文件（defaults 层只放精选默认，D5）。
- **会执行代码吗？** → 会 = 不进数据文件扩展点（保持 P0 无执行面；代码级插件是 P1 的事且需信任门）。
- **AI 改错的代价是什么？** → 若最坏是「没生效/被忽略」（白名单容错），合格；若可能「搞坏应用」，缺校验门。

### 3.3 明确的边界（不文件化的数据）

| 数据 | 去处 | 理由 |
|---|---|---|
| API key | OS 钥匙串（`get/set/delete_api_key`） | ADR 0005：密钥永不落盘进配置文件 |
| EditorView 实例 | 内存模块级 Map（`editorRef.ts`） | ADR 0004：store/文件只存纯文本，编辑器对象不可序列化 |
| 运行时缓存/索引 | `~/Library/Application Support/dev.biaoyue.app/` | 可随时重建的生成态，不属于用户可改数据（所有权三分） |
| 派生状态（recentFiles/滚动位置） | `state/state.json` | 用户行为产物，AI 不直接写（读取参与上下文可以） |

---

## 四、数据文件化的数据范围（全量盘点）

| # | 数据 | 文件位置 | 状态 | AI 可改方式 |
|---|---|---|---|---|
| 1 | 应用设置（字号/主题/宽度/皮肤…） | `user/settings.json`（defaults 合并） | ✅ 已落地 | 受控写 `save_config`（校验+快照+热应用） |
| 2 | 核心能力开关 | `user/settings.json` 能力段 | ✅ 已落地 | 受控写；默认全开 |
| 3 | 斜杠 snippets | `app_config_dir()/snippets/*.md` | ✅ 已落地 | **直接写文件**，扫描即生效 |
| 4 | 新建页 templates | `app_config_dir()/templates/*.md` | ✅ 已落地 | 直接写文件 |
| 5 | 主题 token 覆盖 | `app_config_dir()/theme.toml` | ✅ 已落地 | 直接写文件（白名单容错） |
| 6 | 配置快照 | `snapshots/settings-*.json`（10 份） | ✅ 已落地 | 恢复入口（AI 触发恢复走确认卡） |
| 7 | 用户文档内容 | 用户自己的 md/html 文件 | ✅ 天然文件化 | 编辑器直接改；可视化编辑走 html-visual-editing（保存写回字节不变约束） |
| 8 | 视图规格（阅读空间/网格/悬浮窗） | `user/settings.json` 的 `railViewSpec` / `previewSettings` / `aiViewSpec` | ✅ 已落地（非独立文件） | AI 视图改写经确认卡+快照（#179 已关闭；预设 6 条） |
| 9 | 工作区布局树（pane 树） | `user/settings.json` 的 `paneLayout`（序列化 JSON 字符串） | ✅ 已落地（非独立文件） | 同上；快照可回滚 |
| 10 | 扩展包（manifest.json + SKILL.md） | `app_config_dir()/extensions/<id>/` | ✅ 已落地 | AI 一句话生成新扩展（默认启用）+ 直接编辑 SKILL.md |
| 11 | AI 提示词 / 技能 | 约定目录（对齐 pi skills） | 🗒 未立项 | 目标形态：markdown 文件直接改 |
| 12 | 快速捕获收件箱 | 收件箱数据文件（按日） | ✅ 已落地 | 经捕获浮层/命令写入 |
| 13 | API key | OS 钥匙串 | ✅ 已落地 | **永不文件化**（ADR 0005） |
| 14 | 生成物（contentweave 学习页） | 离线单文件 HTML | 🚧 阶段 2 另立 change | 产物即文件 |

---

## 五、结论

- **实现骨架已经就位**：三层目录（defaults / user / 运行时）+ 原子写 + 快照回滚 + 热应用轮询，是 Omarchy「扩展点 = 数据文件」在本仓库的落地底座；snippets/templates/theme.toml 三个扩展点已可用（「放一个文件就生效」）。
- **缺口不在「文件没建」，而在「UI 结构没数据化」**：视图规格已随 `layout-portal` 落地，但落点是 `settings.json` 四字段而非 D11 设计的独立文件（这是实现选择，不是欠账）；扩展管理面已落地。真正的缺口是轮盘/工具条/图标/菜单仍是代码常量——现行判据与落点契约见 `docs/agents/data-surface.md`。
- **AI 可改的三要素**：真相源唯一（文件）、写路径收敛且有热应用（改了就生效）、可逆兜底（确认卡+快照+撤销）——三者缺一，AI 可塑就会退化为「危险直改」。
- **范围纪律**：密钥永不文件化；执行代码不进数据扩展点；没有消费者的数据文件不提前建目录。
