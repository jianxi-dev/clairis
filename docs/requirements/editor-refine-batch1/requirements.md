# editor-refine-batch1 需求四要素与输入包

- spec issue：#1386（https://github.com/jianxi-dev/clairis/issues/1386）；正文见同目录 `spec-issue.md`。
- 输入源：用户 2026-11-23 批1~3 验收反馈（聊天直报，8 条）+ 参照文档 quiet-md 逆向报告（`docs/research/competitors/quiet-md/editor-core.md` §4、`media-board.md` §2.3）。
- 对账表：同目录 `input-alignment.md`（已确认，含 `确认：` 行）。
- 一手证据（2026-11-23 本会话实读，非报告转述）：

| 证据 | 位置 | 观察 |
|---|---|---|
| 快捷键仅悬停 title | src/editors/orchestration/block-menu.ts:899 | 注释「只给注册表里有快捷键的动作补 title，其余行不补」——无可见快捷键列 |
| 菜单圆角 token | src/styles/editor.css:13-14 | `--menu-radius: 12px` / `--menu-row-radius: 6px` 已定义；多处接入 |
| 文件名右键菜单在 TabBar | src/components/TabBar.tsx | 右键菜单组件未接入 `--menu-radius`，旧小圆角字面量 |
| 手柄纵向固定首行 | src/editors/orchestration/block-handle.ts:446 | 注释「手柄纵向位置固定取块首行行盒（D1），不随指针行移动」；HoverGate 300ms 门控 |
| 手柄图标映射有序退化 | src/editors/orchestration/block-handle.ts:97-107 | `blockHandleIcon` 按首行 `^\s*\d+\.` 判有序，但用户反馈显示退化（需实施时复现定位） |
| 高亮块三色面板已交付 | src/editors/orchestration/block-menu.ts:616-760（`cm-callout-color-panel`，解析在 `src/editors/callout-attrs.ts`） | 批次 3 (#1378) 交付三色面板与一次改色一步撤销；缺可达入口（点击块浮条）。注：初稿误记 `block-color.ts`（那是行内文字色，162 行纯函数），propose 阶段实读后更正 |
| 图片编辑/裁剪 | src/editors/decorations/image.ts (1415 行) / imageCrop.ts (530) / imageToolbar.ts (1032) | 编辑态、裁剪角标、保存文字、描述区逻辑散布三文件；quiet 对标差距即此票范围 |
| 附件卡分类 | src/editors/decorations/fileEmbed.ts:89-116 | pdf/md/html/web 内嵌；样式调整（对齐+宽度）未实现 |
| quiet 手柄参照 | docs/research/competitors/quiet-md/editor-core.md §4 | 块级手柄+首行行盒+整块高 hover+最内层命中；用户最终选豆包式行手柄 |
| quiet 附件高度参照 | docs/research/competitors/quiet-md/media-board.md §2.3 | Preview 缩略图 clamp 120–600px |

## What（做什么）

1. **菜单快捷键区 + 圆角统一**：每个菜单行右侧新增可见快捷键显示区（kbd 样式，无快捷键留白），覆盖块菜单/浮条/轮盘/文件名右键菜单；文件名右键菜单容器接入菜单圆角 token，旧小圆角字面量移除。
2. **高亮块调色入口 + 高亮类型行**：恢复 Quiet 式交互——点击高亮块，上方浮条出现颜色图标，点开可调填充/边框/文字三色（复用批次 3 已交付的三色面板与一次改色一步撤销）；标注类子菜单顶部新增「高亮类型」单行，既有类型预设（含「纯高亮」）置于顶部。
3. **有序列表手柄图标还原**：手柄图标映射还原有序编号图标，与无序区分（映射仍按首行内容判定）。
4. **图片编辑 Quiet 对标八件**：编辑图标选中态、编辑态图片保持原尺寸不缩小、裁剪角标加大、裁剪样式拖动柄、裁剪态常驻（单次拖动不弹回）、移除「保存」文字、描述区默认隐藏仅按钮控制显隐（裁剪态强制隐藏）、修复《中汽系统搭建情况对称1110.md》图片手柄偶发缺失。
5. **豆包式行手柄**（对账 #5 裁决）：手柄按可视文本行显示，每行一个跟行走；层级联动转换——上级行手柄转换联同下级一起转换，末级行只转当前行；子级按自身层级编号规则排号（2 层无序列表转有序，1 级 2 级都变有序，2 级按 2 级编号规则排号）；有序/无序列表转高亮=外套高亮、列表保持原格式；表格/代码块等非文本行块不产生行手柄。
6. **附件手柄图标**：转换手柄图标按附件扩展名映射为附件类图标，机制同图片扩展名映射。
7. **手柄位置统一**：表格与高亮块的手柄位置统一到块左侧垂直居中，不再落在左上角。
8. **附件卡多格式效果**：md 默认展开（宽度=正文同宽；高度自适应+上限 600px+内部滚动+底缘渐隐，对齐 quiet 附件缩略图 clamp 哲学）；md/docx 提供样式调整面板（对齐+宽度，面板式同图片）；docx 提供显示位置（对齐）调整；修复附件引用行首加空格后整块退化为源码的 bug。

## Why（为什么）

- 批1~3 交付后验收发现：菜单行无可见快捷键区，文件名右键菜单仍是旧小圆角，与其他菜单不成一套——用户需要不悬停即可读快捷键、全应用菜单圆角一致。
- 高亮块是标注密度最高的块，批次 3 交付了三色面板却没有可达入口，标注菜单里也没有高亮类型入口——面板能力被闲置，需补齐 Quiet 式调色入口与类型切换。
- 有序列表手柄图标退化，用户无法一眼区分有序/无序——需还原上版图标映射。
- 图片编辑与 Quiet 差距大（无选中态、图片自动缩小、裁剪标识小、拖动柄样式不对、裁剪一次就弹回、多出「保存」文字、描述区常驻、手柄偶发缺失），是验收中最集中的体验落差。
- 转换手柄按块显示不跟行走，用户无法在任意行直接操作——对账裁决改豆包式行手柄，每行一个、层级联动。
- 附件手柄沿用图片图标，块类型不可识别——需按扩展名映射附件图标。
- 表格/高亮块手柄落左上角，与其他块位置不统一——需统一到左侧垂直居中。
- 附件卡多格式效果未实现：md 展开后居中无样式、docx 无法调位置、引用前加空格退化源码——需补齐样式调整与展开尺寸。

## Scope（范围）

- 菜单面：块菜单（`src/editors/orchestration/block-menu.ts`）、浮条、轮盘、文件名右键菜单（`src/components/TabBar.tsx`）。
- 手柄系统：`src/editors/orchestration/block-handle.ts`。
- 图片编辑：`src/editors/decorations/image.ts`、`imageCrop.ts`、`imageToolbar.ts`。
- 附件卡：`src/editors/decorations/fileEmbed.ts`。
- 高亮块入口（交互层）：`src/editors/orchestration/block-color.ts` 与标注菜单（既有类型预设含「纯高亮」）。
- 圆角/样式 token：`src/styles/editor.css`。

## Non-goals（范围外）

- 字符级高亮（`==text==` 渲染）。
- qlmanage 缩略图体系。
- 行手柄「两套并存」方案（对账已裁，选豆包式单套行手柄）。
- 图片画板（Board 块）。
- 附件拖放创建管线改造。
