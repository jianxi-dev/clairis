# 设计 — editor-refine-batch1

来源：spec issue #1386；需求四要素 `docs/requirements/editor-refine-batch1/requirements.md`；对账表 `input-alignment.md`（已确认：#5 豆包式行手柄、#8 高度①，其余默认）。

## Context

批 1~3（editor-foundation-batch1 / editor-interaction-batch2 / editor-batch3-lowcost）归档后的用户验收返修，8 类问题。一手证据（2026-11-23 实读）确认多处为「已登记 requirement 未真正生效」或「能力已交付但无可达入口」：

- 菜单行仅悬停 `title` 补快捷键，无可见快捷键区（`src/editors/orchestration/block-menu.ts:899` 注释）。
- 菜单圆角 token 已定义（`src/styles/editor.css:13-14`：`--menu-radius: 12px` / `--menu-row-radius: 6px`），但文件名右键菜单（`src/components/TabBar.tsx:696`）仍用旧小圆角字面量。
- 高亮块三色面板与「类型」行已在 `block-menu.ts`（颜色行 616 起、类型行 472 起）与 `callout-attrs.ts` 交付，但缺「点击块 → 上方浮条颜色图标」入口。
- 图片编辑态/裁剪散布 `image.ts`(1415) / `imageCrop.ts`(530) / `imageToolbar.ts`(1032)，与 Quiet 对标差距集中。
- 转换手柄按块显示：`collectHandleSpecs`（`block-handle.ts:334`）每块一个；`anchorPos` 注释明确「手柄纵向位置固定取块首行行盒（D1），不随指针行移动」（`:446`）。
- 附件卡分类在 `fileEmbed.ts:89`（`classifyFileEmbed`），md 展开/样式面板/位置未实现。
- 图标词表在 `src/editors/icons.ts`（`ICON_REGISTRY`，`XxxOutlined` 命名），`OrderListOutlined` / `DisorderListOutlined` 已存在（:364 / :372）；附件类图标条目需补。

约束：模式切换 preview/edit/source 用 CSS display，不 remount EditorView；新增 `cm-*` decoration 类名须同步 `src/styles/` CSS（manifest 校验）；EditorView 实例在模块级 Map（`src/editors/editorRef.ts`），不进 store。本 change 不改动这三条机制，但行手柄与附件卡新类名须守 manifest。

## Goals / Non-Goals

**Goals:**
- 把 8 类验收问题收敛为可见行为：菜单快捷键区与圆角、高亮调色入口与类型行、有序图标、图片编辑八件、豆包式行手柄、附件图标、手柄位置统一、附件卡多格式。
- 行手柄为单套豆包式（每行一个、层级联动转换），不引入「两套并存」。
- 复用批次 3 已交付的三色面板与「一次改色一步撤销」，不新造颜色机制。

**Non-Goals:**
- 字符级高亮（`==text==` 渲染）；qlmanage 缩略图体系；行手柄两套并存；图片画板（Board 块）；附件拖放创建管线改造。

## Decisions

### D1 豆包式行手柄——行级显示与跟行走（最高语义风险）

- 现状：`collectHandleSpecs`（`block-handle.ts:334`）按「顶层块 → 容器嵌套块 → mermaid → 空行」枚举，每块一个 `HandleSpec`；`BlockHandlePlugin` 按 `handleKeysFor` 增量对账；手柄纵向锚定块首行（`:446`）。
- 方案：把「文本行块」（paragraph / list / task / heading / quote）改为**按可视文本行**枚举手柄，每行一个 `HandleSpec`（`kind: "line"`），行盒取该行 DOM rect，跟行走；非文本行块（表格 / 代码块 / mermaid / htmlBlock）保留块级手柄。`collectHandleSpecs` 与 `handleKeysFor` 支持行键（行 `from`），保持「纯内容变更只重算几何、不重建 DOM」的增量对账（E-42 口径）。
- 层级联动转换：行手柄触发转换时，若该行是列表项且有子级，则**联同下级子树一起转换**；末级行只转当前行。编号规则：子级按自身层级编号规则重排（2 层无序转有序 → 1、2 级都变有序，2 级按 2 级规则排号）。复用 `block-convert.ts` 的 `expandSiblingList`（:78）与 `LIST_TARGETS` 分组逻辑，扩展为「行子树区间」版本。
- 包裹语义：有序/无序列表转高亮 = 在列表**外套** callout（`> [!NOTE]` 包裹列表体），列表行保持原标记；新增 `wrapListInCallout` 纯函数，与 `toQuote`（`block-convert.ts:141`）同层。
- 拖动语义：拖动上级行 = 移动该行及其子级树（复用 `moveBlock`，:208），与联动转换同构。
- 接线：`block-menu.ts` 的转换动作（`ACTION_ROWS`）与 `floating-toolbar.ts` 的 `convertItem` 改调新纯函数，仍经 `dispatchBlockConvert`（:244）的 `structureTransaction`（一次转换一个 undo 步）。

### D2 图片编辑 Quiet 对标——编辑态

- 选中态：`imageToolbar.ts` 的编辑按钮按下态（参 `updateCropState` :555 / `setCaptionActive` :566 模式），编辑图标 active 高亮。
- 不缩：`image.ts` `ImageWidget`（:606）编辑态宽度计算保持原渲染尺寸，移除编辑态缩放。
- 描述区：caption 默认隐藏，仅工具条按钮切换（`setCaptionActive` / `showCaptionInput` :415）；裁剪态强制隐藏（`notifyImageCropState` :576）。
- 手柄偶发缺失：实施时先复现《中汽系统搭建情况对称1110.md》，定位 `scanImageReference`（`image.ts:270`）与装饰重建时机根因，按证据修复（疑手柄对账键/重建时机）。

### D3 图片编辑 Quiet 对标——裁剪态

- 角标加大：`imageCrop.ts` `HANDLE_MARK` / `HANDLE_CURSOR`（:510 起）尺寸与命中区加大。
- 拖动柄图标：换成裁剪样式图标（参 `CropOutlined` :279）。
- 常驻：进入裁剪态后保持，单次拖动不弹回选中态（`imageCrop.ts` `mount` :209 状态机）。
- 去「保存」文字：移除裁剪区下方「保存」文字（`SAVE_BUTTON_TESTID` :53 相关），保存走工具条既有双入口。

### D4 高亮块调色入口与高亮类型行

- 调色入口：点击高亮块 → 上方浮条出现颜色图标 → 点开三色面板（填充/边框/文字 + 恢复默认）。复用 `block-menu.ts` 的 `cm-callout-color-panel`（:616 起）与 `callout-attrs.ts` `setCalloutAttrs`（:105）/ `serializeCalloutAttrs`（:81）；在 `floating-toolbar.ts` 的 callout 动作组加颜色入口。
- 高亮类型行：在浮条/轮盘的「高亮」转换组（`floating-toolbar.ts:456` `convert-callout-group`）顶部新增「高亮类型」单行，展开既有 `CALLOUT_EDIT_TYPES`（`callout-types.ts:38`，含第 14 类「纯高亮」:53）。
- 一次改色一步撤销：沿用既有 `applyCalloutColor` 事务（不新造）。

### D5 菜单快捷键区 + 圆角统一

- 快捷键区：`block-menu.ts` 行渲染（:899 附近）右侧新增 kbd 显示区，无快捷键留白；浮条（`floating-toolbar.ts`）与轮盘同构；文件名右键菜单（`TabBar.tsx:696`）每行右侧加 kbd 区。既有悬停 `title` 保留，可见列为增量。
- 圆角统一：`TabBar.tsx` 右键菜单容器接入 `--menu-radius`（12px），移除旧小圆角字面量；行圆角走 `--menu-row-radius`。token 已在 `editor.css:13-14`，不新增数值。

### D6 附件手柄图标 + 表格/高亮块手柄位置 + 有序列表图标还原

- 附件图标：`blockHandleIcon`（`block-handle.ts:97`）增加 `file` 类型按扩展名映射，机制同 `imageMediaIcon`（:79）；缺失图标条目补 `src/editors/icons.ts` `ICON_REGISTRY`。
- 位置统一：表格与高亮块手柄从左上角改为块左侧垂直居中（`block-handle.ts` 手柄定位 / `anchorPos` / `anchorClientY` 逻辑）。
- 有序图标还原：复现 `blockHandleIcon` 有序判定（:103 `/^\s*\d+\./`）退化根因（疑 `getBlocks` 首行不含编号或被 `BLOCK_ICON_NAME.list` 覆盖），按证据修复；映射仍按首行内容判定。

### D7 附件卡多格式

- md 展开：`fileEmbed.ts` `renderMarkdownBody`（:383）/ `FileEmbedWidget`（:454）默认展开；宽度=正文同宽（100%）；高度自适应 + 上限 600px + 内部滚动 + 底缘渐隐（新增 CSS，同步 manifest）。
- md/docx 样式面板：对齐 + 宽度（面板式同图片），复用 `FileEmbedWidget` 选择态（`selectEmbed` :177）与工具条。
- docx 位置：对齐调整。
- 空格退化：定位 `classifyFileEmbed`（:89）/ 引用解析对前导空格的判定，修复「引用行首加空格整块退化源码」。

## 数据面

> 命中信号：路径 `src/editors/icons.ts` / `src/editors/orchestration/block-menu.ts` / `floating-toolbar.ts`，关键词「图标 / 快捷键 / 菜单项 / 轮盘」。本 change **不写入任何配置字段**（无 `config.rs` / `settings.json` 变更），图标映射为代码内常量（SSOT 在 `ICON_REGISTRY`）；按 `docs/agents/data-surface.md` 六栏登记，回滚靠 change 级 git revert（缺省回落到变更前实现）。

| 落点 | 位置 | 载体 / 符号 | 判据 | 负责票 | 不变量 |
|---|---|---|---|---|---|
| 规格 | design-system:§2 | — | 图标尺寸档 14/18/24；菜单圆角 12/6；kbd 字号；不复制像素值，引用条款号 | 6 / 7 | 视觉数值只在 spec 定义一次 |
| 存储 | `src/editors/icons.ts` | `ICON_REGISTRY` | 有序/附件图标条目唯一；缺条目回落 `DragHandleOutlined` | 7 | `data-icon` 词表唯一；`fill=currentColor` |
| 校验 | `src/editors/orchestration/block-handle.ts` | `blockHandleIcon` | 按首行/扩展名判定有序与附件；未知类型回落默认把手 | 1 / 7 | 判定正则不改既有 heading/list 语义 |
| 桥接 | `src/editors/orchestration/block-menu.ts` / `floating-toolbar.ts` | `ACTION_ROWS` / `convert-callout-group` | 菜单/浮条动作经命令注册表；高亮组顶部类型行 | 2 / 5 | 动作经 `commands.ts` 注册，不另立旁路 |
| 消费 | `src/editors/orchestration/block-handle.ts` / `floating-toolbar.ts` / `TabBar.tsx` | `cm-block-menu-item` / `--menu-radius` | 每行右侧 kbd 区；无快捷键留白；菜单容器圆角=token | 6 | `MENU_WIDTH` / `MENU_ROW_HEIGHT` 常量值不变 |
| 回滚 | git（代码常量，无配置写入） | `git revert` | 无配置字段落地；revert 即回退，缺省回落到变更前实现 | 全部 | 不新增配置字段 / 不动 `config.rs` |

## Risks / Trade-offs

- [行手柄数量倍增导致抖动/性能] → 沿用 E-42 增量对账（行键 + 只重算几何），先例 `calloutAttrs` 与手柄纯函数单测；e2e 断言长文档连续输入不重建。
- [层级联动转换语义边界（子树判定/编号）] → 先落纯函数单测（2 层无序转有序的排号、末级只转当前行、外套高亮保留列表），再接线；语义风险最高，排最前。
- [图片手柄偶发缺失根因未定] → 实施票先真机复现再改，禁止在未定位前打补丁。
- [有序图标退化根因未定] → 同上，复现后按证据修复。
- [新增 `cm-*` 类名触发 manifest 校验] → 交付前同步 `src/styles/`，`bash scripts/verify.sh` 全绿。
- [「标注菜单」指向存在歧义] → DESIGN DEFAULT：浮条/轮盘的「高亮」转换组（`convert-callout-group`）顶部加类型行；若验收指斜杠菜单高亮组，同口径复用 `CALLOUT_EDIT_TYPES`。

## Migration Plan

- 无配置迁移、无数据库迁移、无后端改动；全部为前端代码常量与装饰逻辑。
- 回滚：change 级 `git revert`；行手柄如需回退，保留 `collectHandleSpecs` 块级路径开关（实施时评估是否留 feature flag，默认不留，靠 revert）。
- 交付：`bash scripts/verify.sh` 全绿 + `npm run tauri dev` 手点关键路径。

## Open Questions

- 「标注菜单的子菜单顶部」确切指浮条/轮盘高亮组还是斜杠菜单高亮组（DESIGN DEFAULT：浮条/轮盘高亮组，见 Risks）。
- 行手柄是否需要「两套并存」过渡（对账已裁：不并存，单套豆包式）。
- 附件卡 md 展开 600px 上限是否需随主题 token（DESIGN DEFAULT：固定 600px，对齐 quiet clamp 哲学；如设计系统有条款则引用条款号）。
