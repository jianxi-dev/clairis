# 验收锚点 — editor-interaction-batch2

锚点来源：`quiet-md-逆向学习总报告.md` §3.1 批次 2（第 5–8 项）+ 批次 1 proposal Non-goals 移交项 + 本仓 HEAD 一手源码实读；design.md D1–D7 与「数据面」。R-1…R-6 对应 `specs/editing/spec.md` 的 E-42…E-47。

## R-1 块手柄增量对账与块型图标（E-42）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 长段落连续输入后手柄上沿与首行行盒偏差上限 | ≤ 1px | 报告批次2-5 / 一手证据 block-handle.ts:270,656-687 |
| A-1.2 | state-machine | 块型转换/插入只替换受影响手柄，其余节点复用 | 复用节点数严格等于转换前数减受影响数（差值 0） | 报告批次2-5 / 一手证据 block-handle.ts:415 |
| A-1.3 | exact | 文末「+」点击后文末严格等于原内容加一个空段，一次撤销后空段消失 | 差值 1 段 / 撤销后 0 段 | 报告批次2-5 / editor-core.md §8.1 |

## R-2 拖拽重排只作用于被移动区间（E-43）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 拖块后除两段外文档其余字节逐字节不变 | 差异字符数 0 | 批次1 proposal Non-goals / 一手证据 block-handle.ts:112,139-141 |

## R-3 图片裁剪坐标系与保存可靠性（E-44）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 打开裁剪并保存后图片显示宽度比值 | 严格等于 1 | 报告批次2-6 / media-board.md §3 / imageCrop.ts:147-148,183-189 |
| A-3.2 | state-machine | 装饰重建销毁裁剪框后再松手仍写回；Esc 取消不残留 | 写回 1 次 / 取消后 crop 属性不存在 | 报告批次2-6 / imageCrop.ts:295 |

## R-4 列表层级缩进与编号一致性（E-45）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 连续按 5 次 Tab 后深度，及第 6 次后的上限 | 5 / 6 | 报告批次2-7 / layout-lists.md §3 / list.ts:58 |
| A-4.2 | state-machine | 有子项空项回车退一层、无子项空项回车退出列表且列表项数减 1 | 项数 -1 | 报告批次2-7 / layout-lists.md §3 |
| A-4.3 | exact | 两个有序项间插入新项后编辑态显示编号依次 | 1、2、3（源码字面量一致） | 报告批次2-7 / layout-lists.md §3 |

## R-5 分栏编辑防双活与 stale 提交（E-46）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | state-machine | 编辑期间偏移改变后 commit 落回正确单元格且有提示 | 提示 ≥1 条 / 丢字 0 | 报告批次2-8 / layout-lists.md §3 / columns.ts:198 |
| A-5.2 | exact | 重复点击同一单元格时 `.cm-column-editor` 节点数 | 1 | 报告批次2-8 / columns.ts:164,530 |

## R-6 块类型图标一致性（E-47）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 同一语义在手柄与块菜单的 `data-icon` 名严格相等；引用块为 `FormatQuoteOutlined` | 名差值 0 / `FormatQuoteOutlined` | 设计系统 §2 / 一手证据 icons.ts COMMAND_ICON_NAME |
| A-6.2 | exact | 表格块 `data-icon` 指向网格条目且不含 `TableChartOutlined` | 0 处 `TableChartOutlined` | 设计系统 §2 / 台账「表格网格图标」行 |
