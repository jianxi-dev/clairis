# 设计：文档属性面板 5 项验收修订

## Context

- 需求输入：GitHub #1019 / #1021 / #1022 / #1023 / #1024（维护者 2026-11-17 验收反馈，逐条全文与 triage brief 已读）。前四条为用户裁定覆盖原型/现状，第五条为归档 change `doc-property-and-search-panel` **决策 8** 的计划项缺口。
- 基准：`openspec/changes/archive/2026-11-16-doc-property-and-search-panel/`（P-1～P-10 现状、决策 1～8、anchors R-1～R-10 写法）。
- 现状代码：`DocPropertyBar.tsx` OpsBar 七按钮 Unicode 字形（L114-127）、`ValueView`/`ValueEditor` 布尔分支渲染「◉ 开 / ○ 关」（L466-472、L572-588）；`TypeIcon` 自绘 12px SVG + 字符混排；`SettingsView.tsx` 模板区裸文本 `键名:类型` textarea + 「不能覆盖内置模板」拦截（L981、L1933）；`src/lib/frontmatter.ts` 硬编码 `ALIAS`/`CANON_TYPE` 9 组 + `resolveAlias`（L173-209、L412）；`src-tauri/src/config.rs` 有 `property_bar`/`search_panel`/`prop_templates`，无 `prop_alias_map`；`src/ui/icons.ts` 注册表 112 键 + `iconSvg(name,size)`，尺寸档 14/18/24。
- 硬约束：三模式 CSS display 切换不 remount；新增 `cm-*` decoration class 必须同步 `src/styles/`（CSS manifest）；配置走既有 AppConfig 三层合并 + 快照回滚；数据面契约见下文六栏表。

## Goals / Non-Goals

**Goals:**
- 面板可见时编辑态正文不再重复显示 frontmatter 源码块，且不破坏光标/选区/undo。
- 布尔字段值内仅状态图形，提示移入 `title`/aria。
- 工具条与行内操作图标统一到 `src/ui/icons` 注册表，与 MD 菜单同源。
- 模板字段可设类型、内置模板可编辑并可恢复默认。
- `propAliasMap` 应用配置落地（校验 + 桥接 + 设置 UI + 热应用），硬编码转内置默认可重置。

**Non-Goals:**
- 类型选择器八类图标（Aa/123/◉/▾/☑/?/☰）本批**不**并入注册表（仅评估，见 Open Questions OQ-1）。
- 跨文件/全局别名导入导出、正则匹配键名（P-6 语义不变：精确键名匹配、只赋类型不改名）。
- AI 语义搜索等无关功能。

## Decisions

1. **#1019 前言块隐藏走 CM6 `Decoration.replace` 新模块 `src/editors/decorations/frontmatterHide.ts`**：面板可见且处于编辑态时，对 `--- ... ---` 整块（`parsed.start..parsed.end`）施加 `Decoration.replace({})` 隐藏；折叠态改为一块 `FoldToggleWidget` 式单行摘要占位（`文档属性 · N 个字段`，点击跳源码态）；`⌘⇧Y` 隐藏态**恢复显示完整源码块**。理由：`Decoration.replace` 是仓库既有「隐藏范围」做法（`fold.ts` 折叠段同法），比过滤渲染简单且天然可逆；隐藏态露出源码块满足「源码可及性」，与 P-1 源码态约束不冲突。替代方案（改 frontmatter 解析为只读文本域）会与面板编辑双写冲突，弃。
   - 安全约束：隐藏范围不得包含光标当前行；源码态（mode=source）不启用隐藏；装饰重建走 `editorDecorations()` StateField 既有通道（`EditorDecorationsOptions` 注入 `shouldHideFrontmatter: () => boolean` + `frontmatterRange(state): {from,to}|null`），不新增全局监听。
2. **#1021 布尔值显示「图形在内、文案出值」**：`ValueView` 布尔分支与 `ValueEditor` 的 `dpb-switch` 均去掉「开/关」文字，值内仅 `◉`（true）/ `○`（false）状态图形；`title` 提示 true=`已开启`、false=`已关闭`；编辑态保留 `role="switch"` + `aria-checked` + `aria-label`（「已开启」/「已关闭」）。理由：用户裁定「值里提示的文字信息可以以提示信息方式显示，不要显示在值内」；保留 ◉/○ 作为状态图形满足「开关态图形」诉求。
3. **#1022 图标全部经 `src/ui/icons` 注册表消费**：OpsBar 七按钮逐一映射——复制 `copy`、剪切 `cut`、粘贴 `paste`、上移 `arrowUp`、下移 `arrowDown`、删除 `trash`、取消 `close`（`close` 已存在，直接复用）。缺的 6 个概念（copy/cut/paste/arrowUp/arrowDown/trash）按 `design-system:§2` 流程**先补 spec 条款再注册**（24×24 viewBox、笔画 1.7、三档尺寸 14/18/24）；OpsBar 用 14 档（密集工具条）。`dpb-ico-svg` 自绘 12px 日历/时钟是否并入注册表本批不做（OQ-1）。理由：MD 横向工具条已用 `iconSvg(name, 14)`，同源即视觉统一；Unicode 字形与自绘 SVG 是该票根因。
4. **#1023 内置模板编辑 = 同名覆盖 + 显式恢复默认**：设置区模板编辑由 textarea 改为**字段列表 UI**（每行：键名输入 + 类型选择器[八类直选，复用面板 `TypeSelector` 菜单形态] + 可选预设值输入 + 行删除；底部「新增字段」）。内置模板放开编辑：保存写 `AppConfig.propTemplates` 同名条目——`normalizePropTemplates` 现有「按名合并、同名覆盖」逻辑天然把用户改动落为**内置定义的覆盖层**；「恢复默认」= 从 `propTemplates` 移除该内置名，下次 normalize 回落 `BUILTIN_PROP_TEMPLATES`。数据结构 `PropTemplateFieldConfig{key,type,value}` 不变（types/index.ts:65）。理由：复用既有 normalize 合并语义，零 schema 变更；「恢复默认」是删除覆盖层而非另立 reset 字段，避免状态双写。替代方案（复制为自定义模板再改）会丢失「内置名」语义、模板菜单出现重名，弃。
5. **#1024 `AppConfig.propAliasMap` schema 与合并序**：Rust `prop_alias_map: Option<HashMap<String, String>>`（serde camelCase `propAliasMap`），值为 `FrontmatterType` 枚举字符串；`validate_config` 白名单校验——键名 trim 后非空、不含 `:#\r\n`，值 ∈ {text,number,date,datetime,boolean,array,select,multiselect,unknown}，未知键值拒绝写入并聚合告警。合并序：**应用配置 > 内置默认**（内置 9 组来自 `ALIAS`/`CANON_TYPE` 常量，转为 `BUILTIN_ALIAS_MAP`）；`resolveAlias(key, aliasMap?)` 先查传入配置、未命中再查内置。`parseFrontmatter(doc, aliasMap?)` 增可选参（缺省=内置），保持纯函数可测。理由：P-6「只赋类型不改名」不变；配置热应用即可让新映射生效（QG-7 可见性来自「改配置即识别」）。
6. **#1024 设置区映射表 UI**：新增「别称映射」区——上半为**内置默认 9 组只读**（键名 + 类型 + 「内置」标记），下半为**用户自定义映射**行（键名输入 + 类型选择器 + 删除），底部「恢复默认」清空自定义行；新增行即时写 `AppConfig.propAliasMap` 并热应用。理由：区分「内置可重置」与「用户可维护」，避免用户误以为内置可被删除。
7. **配置桥接复用既有链路**：`propAliasMap` 走 `useConfig.applyRustConfig` 归一化（未知类型忽略并告警）→ 写入 editorStore `config.propAliasMap` → `DocPropertyBar` 读取并传入 `parseFrontmatter`；不新增 store 字段、不走 `patch_config`。模板编辑沿用 `saveAppConfig()` 既有写路径。
8. **测试口径**：单测覆盖 `resolveAlias` 配置优先/大小写不敏感、`parseFrontmatter(doc, map)`、`normalizePropTemplates` 同名覆盖与移除回落；e2e 断言「布尔值节点文本不含『开/关』且 title 含『已开启』」「工具条 `img/svg` 来源与 MD 菜单一致」「编辑态面板展开时正文 `.cm-line` 首行不含 `---`」「隐藏态后 frontmatter 行可见」；`verify.sh` 全绿。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§2 | — | 新增 copy/cut/paste/arrowUp/arrowDown/trash 图标条款：24×24 viewBox、笔画 1.7、三档尺寸 14/18/24；缺条款不得注册 |
| 存储 | src-tauri/src/config.rs | prop_alias_map | 新字段入 AppConfig Rust 结构（Option<HashMap<String,String>>），旧配置缺省读为 None |
| 校验 | src-tauri/src/config.rs | validate_config | 键名非空且不含 `:#\r\n`，值 ∈ 八类类型白名单，越界拒绝写入并聚合告警 |
| 桥接 | src/hooks/useConfig.ts | applyRustConfig | 归一化 propAliasMap 写入 editorStore.config，未知枚举忽略并告警，热应用即时生效 |
| 消费 | src/lib/frontmatter.ts | resolveAlias | 先查应用配置 propAliasMap、未命中回落内置 9 组；只赋类型不改名 |
| 消费 | src/components/SettingsView.tsx | propAliasMap | 映射表管理 UI（内置只读 + 自定义行 + 恢复默认）写回 AppConfig |
| 消费 | src/components/Content/DocPropertyBar.tsx | config.propTemplates | 模板字段类型选择器与内置覆盖保存读 propTemplates，套用行为不变 |
| 回滚 | snapshots/ | restore_config_snapshot | 写前快照，propAliasMap/propTemplates 误改一步恢复 |

（三道机检时点：G0 阶段二 `./scripts/cw-data-surface.sh new`、G0-POST `tickets`、G1 出口 `diff`。）

## Risks / Trade-offs

- [前言块 `Decoration.replace` 吞光标/选区] → 隐藏范围排除光标所在行；源码态强制不隐藏；e2e 覆盖「隐藏后点击正文→光标落位正确」「Ctrl+Z 撤销面板编辑不串位」。
- [`Decoration.replace` 与既有折叠/块装饰叠加顺序] → frontmatterHide 模块在 `editorDecorations()` 装配中置于结构装饰之后、行内标记之前，避免替换范围与行内 widget 冲突。
- [工具条图标新增 6 概念膨胀注册表] → 先补 `design-system:§2.3` 动作组条款再注册；若已有概念可表达则复用（如 `close`），不新增第四档尺寸。
- [内置模板覆盖层被误读为「内置被改」] → UI 明示「内置（可编辑，恢复默认可还原）」；normalize 合并序稳定：用户同名条目覆盖内置、删除即回落。
- [propAliasMap 用户键误伤既有键] → 仅精确键名匹配、只赋类型不改名不重排；用户显式改名总是生效（沿用 P-6 既有保护）。
- [e2e 与 CSS manifest] → 新 decoration class 统一 `cm-fmh-*` 前缀并在 `src/styles/` 落 CSS；OpsBar 若改用 `Icon` 组件需确认 `data-testid` 不回归。

## Migration Plan

1. 纯函数层：`resolveAlias`/`parseFrontmatter` 增配置参 + `BUILTIN_ALIAS_MAP`（无 UI）→ 2. 设置区模板字段列表 UI + 内置覆盖 + 恢复默认 → 3. 设置区映射表 UI + Rust 校验 + 桥接 → 4. 布尔值图形/title → 5. OpsBar 图标注册表化（含 design-system 条款）→ 6. frontmatterHide 装饰 + 折叠/隐藏态 → 7. e2e + `verify.sh`。每步可独立合入 main（1023/1024 为增量配置字段，对旧配置无影响；1019 仅编辑态面板可见时生效）。
- 回滚：配置新增字段对旧版本无影响（Rust `skip_serializing_if`）；装饰模块移除挂载即回滚；UI 改动按设置区局部回退。

## Open Questions

- **OQ-1**：类型选择器八类字符图标（Aa/123/◉/▾/☑/?/☰）是否同批并入注册表统一？本 change 只做工具条，类型图标留待维护者裁定（不影响 #1022 验收：验收标准只要求工具条一致）。
- **OQ-2**：`dpb-ico-svg` 自绘 12px 日历/时钟是否升为注册表 14 档概念？同上，本批不做。
