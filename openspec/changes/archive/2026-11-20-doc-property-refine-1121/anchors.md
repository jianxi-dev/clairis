# 验收锚点 — doc-property-refine-1121

锚点来源：用户 2026-11-21 反馈（spec issue #1254，14 项优化 + 2 个缺陷）+ 截图证据；design.md D1–D11 与「数据面」。R-1…R-8 对应 tasks.md 1.1–7.1。

## R-1 tags 字符串崩溃修复（tasks 1.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 打开含 `tags: "#"` 文档后属性窗格抛错次数 | 0 | #1254 bug 报告（tags: "#"） / design D3 |
| A-1.2 | exact | `tags: "#"` 归一为单元素列表后的列表项数 | 1 | design D3 |
| A-1.3 | state-machine | 首次编辑该字段后 YAML 值由字符串变为列表 | 编辑→`["#"]` | design D3 |

## R-2 时间输入框 Tab 键修复（tasks 1.2）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 光标在时/分输入框按 Tab 后文档首字符仍为 `-` 且属性面板不消失 | 按 Tab→首字符 `-` | #1254 时间tab键问题.png / design D11 |
| A-2.2 | exact | 面板内 Tab 触发 `setFrontmatterField` 的调用次数 | 0 | design D11 |
| A-2.3 | state-machine | Tab 的焦点落点在面板内下一控件（非正文） | Tab→面板内焦点 | design D11 |

## R-3 frontmatter 容错解析与识别扩展（tasks 2.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 含 `{{date}}` 模板占位文档兜底解析出的顶层字段数下限 | 6 | #1254 读书笔记模版截图.png / design D1 |
| A-3.2 | exact | 空值且未命中别称的字段识别类型 | "text" | #1254 mdpkg文档截图.png / design D2 |
| A-3.3 | exact | 内置别称表新增条目数 | 9 | design D2 |
| A-3.4 | state-machine | 编辑整块不可解析文档的一个键后，未改动键的原始字节保持不变 | 编辑→其余字节不变 | design D1 |

## R-4 日期/日期时间选择器改版（tasks 3.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 日期字段的原生 `<input type="date">` 节点数 | 0 | #1254 日期窗口.png / design D8 |
| A-4.2 | exact | 点击标题「月」进入月网格后的月格数 | 12 | design D8 |
| A-4.3 | exact | 秒为 00 的日期时间展示格式 | "YYYY-MM-DD HH:mm" | #1254 时间窗口.png / design D8 |
| A-4.4 | exact | 日期字段提交值格式 | "YYYY-MM-DD" | design D8 |

## R-5 面板头部/footer/图标（tasks 4.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | A/B 两态 footer 中「计数」相对「日期」的 DOM 顺序 | 计数索引 0、日期索引 1 | design D4 |
| A-5.2 | exact | A/B 右侧按钮顺序中「添加字段」的索引 | 0 | design D4 |
| A-5.3 | exact | 计数左缘与字段类型图标左缘的水平偏差上限（px） | 2 | design D4 |
| A-5.4 | exact | 锁图标渲染尺寸上限（px，小于其他面板图标一档） | 12 | design D7 |
| A-5.5 | exact | A（L）与 B（T）形态切换图标 path 不同 | 1 | design D5 |
| A-5.6 | exact | 「全选」按钮的全选图标节点数下限 | 1 | design D5 |

## R-6 字段行（tasks 5.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 删除叉号默认 `opacity` | 0 | design D7 |
| A-6.2 | state-machine | 行悬停/聚焦/选中后删除叉号 `opacity` | 悬停→1 | design D7 |
| A-6.3 | exact | 字段名与值计算字号相等（随正文同步） | 1 | design D6 |
| A-6.4 | exact | 行内字段类型文字节点数 | 0 | #1254 A模式字段文字位置图.png / design D6 |
| A-6.5 | exact | 类型图标、字段名、值包围盒垂直中心两两偏差上限（px） | 1 | design D6 |
| A-6.6 | exact | 文本/多行/列表/标签值编辑器填满本行的宽度差上限（px） | 0 | design D6 |

## R-7 选中操作条去色（tasks 6.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 操作条背景色与选中行高亮色不同 | 1 | design D7 |
| A-7.2 | exact | 操作条图标经 `iconSvg` 渲染的 SVG 节点数 | 7 | design D4 |
| A-7.3 | exact | 操作条内 Unicode 字形文本节点数 | 0 | design D4 |

## R-8 改名锁扩展名（tasks 7.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | state-machine | 页签改名提交后标题仍以原扩展名结尾 | 提交→`.md` | design D9 |
| A-8.2 | exact | 改名输入框内出现扩展名（`.md`）的次数 | 0 | design D9 |
| A-8.3 | exact | 另存为预填名以 `.md.md` 结尾的次数 | 0 | design D9 |
| A-8.4 | exact | 属性面板标题字段显示值以 `.md` 结尾的次数 | 0 | design D9 |
