# 验收锚点 — editor-refine-batch1

锚点来源：spec issue #1386（8 条验收反馈 + 对账裁决 #5 豆包式行手柄、#8 高度①）、一手观察（`docs/requirements/editor-refine-batch1/requirements.md` 证据表代码位置）、spec delta `editing`（requirement 名与 Scenario）、`design.md` D1–D7。R-1…R-8 对应 tasks.md 1.1–7.1。

本 change 为批 1~3 归档后的验收返修，无原型（无 baseline png），锚点来源为显式决策与一手观察，全部走 `exact` / `state-machine`，无 `perceptual` 锚点。断言值取自 spec delta Scenario 的 SHALL 口径（`≤1px`、`≤2px`、`0`、`600px`、`严格不相等`）、设计系统 token 名（`--menu-radius` / `--menu-row-radius`）与结构名（`data-icon`、`cm-callout-color-panel`、`CALLOUT_EDIT_TYPES`）；不引入未定义像素值，密度具体数值以 design-system 条款为唯一来源。

## R-1 行手柄渲染与跟行走

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 指针移入多行文本行块 → 每个可视文本行各出现一个手柄并随该行滚动 | 手柄数=可视文本行数；行盒上沿偏差 ≤1px | spec delta 豆包式行手柄层级联动转换 Scenario 每行一个手柄并跟行走 / E-42 Scenario 输入后手柄贴住对应行且不重建 / D1 |
| A-1.2 | exact | 多行文本行块连续输入前后手柄根节点 DOM 标识变化数 | 0 | E-42 Scenario 输入后手柄贴住对应行且不重建 / 一手观察 block-handle.ts:446 |
| A-1.3 | exact | 表格与代码块产生的行级手柄数 | 0 | spec delta 豆包式行手柄层级联动转换 Scenario 非文本行块不产生行手柄 / D1 |
| A-1.4 | exact | 表格与代码块保留的块级手柄数 | 1 | spec delta 豆包式行手柄层级联动转换 Scenario 非文本行块不产生行手柄（仍按块显示手柄） / E-42 修改 requirement 正文 |

## R-2 层级联动转换与列表外套高亮

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 对两层无序列表的上级行触发「转为有序」→ 上级与下级一起转换、子级按自身层级编号规则排号 | 1 级与 2 级均有序；2 级编号从 1 起连续 | spec delta 豆包式行手柄层级联动转换 Scenario 上级联动下级一起转换 / D1 / 对账 #5 |
| A-2.2 | exact | 对无子级的末级行触发转换后其兄弟行与上级行的结构差异数 | 0 | spec delta 豆包式行手柄层级联动转换 Scenario 末级行只转当前行 / D1 |
| A-2.3 | state-machine | 对有序或无序列表触发「转为高亮」→ 列表外套 callout、列表行保持原标记与结构 | 列表标记保留数=原行数；外层 callout 数 1 | spec delta 豆包式行手柄层级联动转换 Scenario 列表转高亮保留列表格式 / D1 `wrapListInCallout` |

## R-3 图片编辑态

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 进入图片编辑态后编辑按钮选中态与未选中态的计算样式色差 | 色差 > 0 | spec delta 图片编辑 Quiet 对标 Scenario 编辑图标选中态 / D2 |
| A-3.2 | exact | 编辑态图片渲染宽度与进入编辑前宽度的差 | 0 | spec delta 图片编辑 Quiet 对标 Scenario 编辑态图片不缩小 / D2 |
| A-3.3 | state-machine | 描述区默认隐藏 → 点击工具条描述按钮切换显隐 → 进入裁剪态强制隐藏 | 默认隐藏；点击后显隐切换；裁剪态隐藏 | spec delta 图片编辑 Quiet 对标 Scenario 描述区默认隐藏与裁剪态强制隐藏 / D2 |
| A-3.4 | exact | 打开含多张图片的文档逐张召唤时的手柄缺失数 | 0 | spec delta 图片编辑 Quiet 对标 Scenario 图片手柄不缺失 / D2 / 一手观察 image.ts:270 |

## R-4 裁剪态

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 进入裁剪态后角标尺寸与既有默认值的比较 | 大于既有默认值（命中区同步增大） | spec delta 图片编辑 Quiet 对标 Scenario 裁剪角标加大与拖动柄图标 / D3 |
| A-4.2 | state-machine | 进入裁剪态后拖动裁剪边界一次 → 裁剪态保持、不弹回普通选中态 | 裁剪态保持 | spec delta 图片编辑 Quiet 对标 Scenario 裁剪态常驻 / D3 |
| A-4.3 | exact | 裁剪区下方「保存」文字出现数 | 0 | spec delta 图片编辑 Quiet 对标 Scenario 裁剪区下方无保存文字 / D3 |
| A-4.4 | exact | 裁剪拖动柄图标与裁剪样式图标的键名关系 | 键名相同 | spec delta 图片编辑 Quiet 对标 Scenario 裁剪角标加大与拖动柄图标 / D3 / 一手观察 imageCrop.ts:510 |

## R-5 高亮块调色入口与高亮类型行

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | state-machine | 点击高亮块 → 上方浮条出现颜色图标 → 点开三色面板 | 颜色图标出现数 1；面板行数 4（填充 / 边框 / 文字 / 恢复默认） | spec delta 高亮块调色入口与高亮类型行 Scenario 点击高亮块出现颜色入口 / D4 |
| A-5.2 | state-machine | 在颜色面板改动填充色后按一次撤销 → 三色属性还原 | 填充 / 边框 / 文字三属性均还原为改色前值 | spec delta 高亮块调色入口与高亮类型行 Scenario 改色为一步撤销 / D4 |
| A-5.3 | exact | 标注类子菜单「高亮类型」行的位置与展开项内容 | 位于顶部第 1 行；展开项含「纯高亮」 | spec delta 高亮块调色入口与高亮类型行 Scenario 高亮类型行位于顶部且含纯高亮 / D4 |

## R-6 菜单快捷键区与圆角统一

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 块菜单 / 浮条 / 轮盘 / 文件名右键菜单每行右侧 kbd 样式快捷键区出现数 | 每行 1 | spec delta 菜单快捷键列与圆角统一 Scenario 菜单行显示可见快捷键区 / D5 |
| A-6.2 | exact | 无快捷键动作行右侧的占位文字数 | 0 | spec delta 菜单快捷键列与圆角统一 Scenario 菜单行显示可见快捷键区 / D5 |
| A-6.3 | exact | 文件名右键菜单容器计算圆角与块菜单容器计算圆角的差 | 0（等于 `--menu-radius` 12px） | spec delta 菜单快捷键列与圆角统一 Scenario 文件名右键菜单圆角与其它菜单一致 / D5 / 一手观察 editor.css:13 |
| A-6.4 | exact | 菜单行计算圆角与行圆角 token 的差 | 0（等于 `--menu-row-radius` 6px） | spec delta 菜单快捷键列与圆角统一 Scenario 文件名右键菜单圆角与其它菜单一致 / D5 / 一手观察 editor.css:14 |

## R-7 附件手柄图标与手柄位置统一

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 附件块手柄 `data-icon` 与图片图标的关系 | 严格不相等 | spec delta E-42 Scenario 附件手柄图标按扩展名 / D6 |
| A-7.2 | exact | 表格与高亮块手柄垂直中心与块渲染矩形垂直中心的偏差 | ≤2px | spec delta E-42 Scenario 表格与高亮块手柄垂直居中 / D6 |
| A-7.3 | exact | 有序列表与无序列表手柄 `data-icon` 的关系 | 严格不相等 | spec delta E-42 Scenario 有序列表手柄图标可区分 / D6 |
| A-7.4 | exact | `htmlBlock` 与 `yamlFrontMatter` 回落默认拖拽图标的条目数 | 0（均有明确图标条目） | spec delta E-42 修改 requirement 正文 / D6 / 一手观察 icons.ts `ICON_REGISTRY` |

## R-8 附件卡多格式

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | md 附件展开高度与上限的关系 | ≤600px | spec delta E-50 Scenario md 附件默认展开与尺寸上限 / D7 / 对账 #8 ① |
| A-8.2 | state-machine | md 附件内容超出上限 → 内部滚动且底缘渐隐提示截断 | 可内部滚动；底缘渐隐出现 | spec delta E-50 Scenario md 附件默认展开与尺寸上限 / D7 |
| A-8.3 | state-machine | 选中 md 或 docx 附件打开样式调整面板 → 对齐与宽度可调 | 对齐与宽度调整后附件呈现变化 | spec delta E-50 Scenario md 与 docx 样式调整面板 / D7 |
| A-8.4 | state-machine | 选中 docx 附件调整显示位置 → 对齐随之变化 | 对齐随之变化 | spec delta E-50 Scenario docx 显示位置调整 / D7 |
| A-8.5 | exact | 附件引用行首加前导空格后整块退化为源码的次数 | 0 | spec delta E-50 Scenario 前导空格不退化 / D7 |
