# 任务清单：文档属性面板 5 项验收修订

> 规格：`specs/doc-property-panel/spec.md`（P-1/P-3/P-4/P-6/P-7 修订）。设计：`design.md`（决策 D1～D8 + 数据面六栏表）。需求输入：GitHub #1019/#1021/#1022/#1023/#1024。
>
> **切片说明（QG-7）**：每票贯穿数据→UI→测试全层，做完用户能在页面上看到东西；#1024 的 Rust schema + 桥接 + 设置 UI 为一张垂直票（天然一条链）。
>
> **测试归属（QG-2/QG-4）**：单测与 Playwright e2e 随各票交付（票面 AC 列明）。
>
> **数据面机检三连**：G0 阶段二 `./scripts/cw-data-surface.sh new`（propose 后）→ G0-POST `tickets`（拆票时）→ G1 出口 `diff`（随 6.1 收口）。
>
> **归档**：G4 收口后按 change-workflow 归档；5 张来源票已在看板 ready-for-agent 列，本 change 不新发 issue，编排方按既有票映射拆票（`fixes #N`）。

## 1. 垂直切片

- [ ] 1.1 **布尔字段值内仅状态图形**（`fixes #1021`）：`DocPropertyBar.tsx` `ValueView` 布尔分支与 `ValueEditor` 的 `dpb-switch` 去掉「开/关」文字，值内仅 `◉`/`○`；`title` 置 `已开启`/`已关闭`；编辑态保留 `role="switch"`/`aria-checked`/`aria-label`。AC：`npm run tauri dev` 打开含 `flag: true` 文档 → 编辑态属性面板布尔行文本仅 `◉`、悬停出「已开启」，切 false 后 `○` + 「已关闭」，读屏属性含状态语义；e2e 断言值节点 textContent 不含「开/关」且 title 精确匹配。锚点：A-1.1/A-1.2/A-1.3。Blocked by：None。接线归属：本票自足（改既有组件渲染，无新导出 API）。标签：ready-for-agent、ui-surface、p3。粒度：用户可见交付物。**数据面**: 无

- [ ] 1.2 **工具条与行内操作图标统一注册表**（`fixes #1022`）：先在 `docs/design/system/spec.md` §2.3 动作组补 `copy`/`cut`/`paste`/`arrowUp`/`arrowDown`/`trash` 条款（24×24、笔画 1.7、三档尺寸），再在 `src/ui/icons.ts` 注册并令 `DocPropertyBar.tsx` OpsBar 七按钮经 `iconSvg(name, 14)` 渲染（`close` 复用既有）；移除 Unicode 字形与自绘 SVG。AC：选中若干行 → 操作条七按钮均为 SVG 且与 MD 横向工具条同一图标源、同描边体系；设计走查截图并排对比；CSS manifest 机检通过。锚点：A-2.1/A-2.2。Blocked by：None。接线归属：本票自足（`iconSvg` 既有 API，新增概念由本票注册）。标签：ready-for-agent、ui-surface、p3。粒度：用户可见交付物。**数据面**: 规格

- [ ] 1.3 **面板可见时编辑态隐藏 frontmatter 源码块**（`fixes #1019`）：新增 `src/editors/decorations/frontmatterHide.ts`，对 `--- ... ---` 块施加 `Decoration.replace` 隐藏；`editorDecorations()` 经 `EditorDecorationsOptions` 注入 `shouldHideFrontmatter` + `frontmatterRange`；折叠态显示一行摘要占位、`⌘⇧Y` 隐藏态恢复完整源码块；源码态强制不隐藏。AC：编辑态面板展开 → 正文顶部无 `---` 块；折叠 → 仅一行「文档属性 · N 个字段」摘要；`⌘⇧Y` 隐藏面板 → 完整 YAML 恢复；切源码态 → YAML 完整可编；光标移入正文首段落位正确、Ctrl+Z 撤销面板编辑不串位；e2e 覆盖四种切换。锚点：A-3.1/A-3.2/A-3.3/A-3.4。Blocked by：None。接线归属：本票导出 `createFrontmatterHideDecorations`，接线位置 = `src/editors/decorations/index.ts` 装配 + `ContentArea` 传入显隐回调。标签：ready-for-agent、ui-surface、p2。粒度：用户可见交付物。**数据面**: 无

- [ ] 1.4 **模板字段类型 UI 与内置模板可编辑**（`fixes #1023`）：`SettingsView.tsx` 属性模板区由 textarea 改为字段列表 UI（键名输入 + 类型选择器[八类直选，复用 `TypeSelector` 菜单形态] + 可选预设值 + 行删除 + 新增字段）；内置模板放开编辑——保存写 `AppConfig.propTemplates` 同名条目（覆盖层），每内置模板提供「恢复默认」移除该条目回落 `BUILTIN_PROP_TEMPLATES`；单事务可撤销。AC：设置中改内置「通用」某字段类型为日期并保存 → 新文档套用后该字段显示日期类型；点「恢复默认」→ 新文档套用回内置原类型；非法键名（含 `:`/`#`）拦截提示；单测覆盖 `normalizePropTemplates` 同名覆盖与移除回落。锚点：A-4.1/A-4.2/A-4.3。Blocked by：None。接线归属：本票自足（沿用既有 `saveAppConfig`/`propTemplates` 写路径，无新导出 API）。标签：ready-for-agent、ui-surface、p3。粒度：用户可见交付物。**数据面**: 消费

- [ ] 1.5 **`AppConfig.propAliasMap` 落地**（`fixes #1024`）：Rust `config.rs` 增 `prop_alias_map: Option<HashMap<String,String>>` + `validate_config` 白名单（八类类型枚举、键名合法）；`frontmatter.ts` 把 `ALIAS`/`CANON_TYPE` 转为内置默认 `BUILTIN_ALIAS_MAP`，`resolveAlias(key, aliasMap?)` 先配置后内置，`parseFrontmatter(doc, aliasMap?)` 增参；`useConfig.applyRustConfig` 归一化并写入 `editorStore.config.propAliasMap` 热应用；`SettingsView.tsx` 新增「别称映射」区（内置 9 组只读 + 自定义行[键名+类型选择器+删除] + 恢复默认）；`DocPropertyBar` 读取并传入。AC：设置新增 `customdate → 日期` 保存 → 打开含 `customdate: 2026-11-17` 外部文件自动识别日期类型且显示名不变、重新打开即生效；点「恢复默认」→ 自定义清空、`createdate` 重新可识别；非法类型值拒绝写入并告警；单测覆盖配置优先/大小写不敏感/回落内置。锚点：A-5.1/A-5.2/A-5.3。Blocked by：None。接线归属：本票导出 `parseFrontmatter(doc, aliasMap?)` 与 `resolveAlias(key, map?)`，接线位置 = `DocPropertyBar.tsx` 读 `config.propAliasMap` 传入。标签：ready-for-agent、ui-surface、p3。粒度：用户可见交付物。**数据面**: 存储,校验,桥接,消费,回滚

- [ ] 1.6 **集成验收与交付**：`npm run tauri dev` 手动走查全量关键路径（布尔悬停、工具条图标并排、frontmatter 隐藏四态、模板类型选择与恢复默认、映射新增/恢复），按仓库 UI 约定用功能说明性语言记录；`bash scripts/verify.sh` 全绿（tsc → eslint → vitest → CSS manifest → cargo check → 两套 Playwright）；数据面机检 `diff` 收口；更新 `docs/delivery/requirements-status.md`；G4 归档。锚点：A-1.1～A-5.3 全量。Blocked by：1.1、1.2、1.3、1.4、1.5。接线归属：不适用（收口票）。标签：ready-for-agent、ui-surface。粒度：integrate-verify。**数据面**: 无

## 2. 来源票映射

| 任务 | 来源 issue | PR 关联 |
|---|---|---|
| 1.1 | #1021 布尔字段开/关文案应改提示显示 | `fixes #1021` |
| 1.2 | #1022 工具条图标未复用仓库图标注册表 | `fixes #1022` |
| 1.3 | #1019 面板可见时编辑态正文仍显示 frontmatter 源码块 | `fixes #1019` |
| 1.4 | #1023 模板缺字段类型设置 UI 且内置模板不可编辑 | `fixes #1023` |
| 1.5 | #1024 字段映射表（propAliasMap 应用配置）未建立 | `fixes #1024` |
| 1.6 | 上述五票收口 | 随 1.1～1.5 PR |
