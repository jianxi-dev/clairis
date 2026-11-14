# 验收锚点 — editor-surface-batch19

锚点来源：用户 2026-11-14 反馈（spec issue #833）+ 4 张截图一手观察（`cw-vision.sh describe`）；design.md D1–D17。R-1…R-21 对应 A1–A9 / B1–B7 / C1–C5。

## R-1 A1 转换手柄二级菜单生命周期

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 二级菜单移出「父菜单 ∪ 二级面板」并集后节点数 | 0 | #833 A1 / design D1 |
| A-1.2 | exact | 菜单栈打开期间下层文字新增 / 转换手柄节点数 | 0 | #833 A1 / design D1 |
| A-1.3 | state-machine | 指针移出→菜单消失；回到并集→保持 | 移出→0，回到→1 | #833 A1 / design D1 |

## R-2 A2 提示外壳统一胶囊

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 任一类自绘提示的计算 `border-radius` ≥ 提示高度一半 | "true" | #833 A2 / design D2 |
| A-2.2 | exact | 矩形外壳提示节点数 | 0 | #833 A2 / design D2 |

## R-3 A3 mermaid 手柄识别与菜单贴合

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 复现文档三处 mermaid 手柄节点总数 | 3 | 一手观察：复现文档 / design D1 |
| A-3.2 | exact | 转换菜单垂直中心与手柄中心偏差上限（px） | 2 | #833 A3 / design D1 |
| A-3.3 | exact | 「使用图标增强表现」处手柄节点数 | 1 | 一手观察：复现文档 / design D1 |

## R-4 A4 分栏交互修复

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 进入分栏后重复文本节点数 | 0 | #833 A4 / design D3 |
| A-4.2 | exact | 栏目左上角小方框节点数 | 0 | #833 A4 / design D3（DEFAULT＝移除） |
| A-4.3 | state-machine | `+` 滑入→选择菜单出现；移出→消失 | 滑入→1，移出→0 | #833 A4 / design D3 |
| A-4.4 | exact | 分栏间隔线计算 `width` 下限（px） | 1 | #833 A4 / design D3 |

## R-5 A5 单元格与分栏内外渲染一致

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 单元格 / 分栏内标题装饰节点数下限 | 1 | #833 A5 / design D3 |
| A-5.2 | exact | 单元格 / 分栏内可见源码标记（`**` / `##`）节点数 | 0 | #833 A5 / design D3 |
| A-5.3 | state-machine | 同一块在编辑态与预览态走同一渲染管线 | 编辑态→预览态渲染一致 | #833 A5 / design D3 |

## R-6 A6 编辑态边框对齐

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 代码块 / 引用块 / mermaid 与正文左边界 x 差 | 0 | #833 A6 / design D4 |
| A-6.2 | exact | 三类块彼此左边界 x 差 | 0 | #833 A6 / design D4 |

## R-7 A7 图片工具条状态

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | state-machine | 点「裁剪」→按钮呈选中态 | 选中态→class 存在 | #833 A7 / design D5 |
| A-7.2 | exact | 裁剪后图片显示尺寸与裁剪矩形比例相符 | "true" | #833 A7 / design D5 |
| A-7.3 | exact | 「添加描述」默认描述区 `display` | "none" | #833 A7 / design D5 |
| A-7.4 | exact | 「添加描述」图标 path 与旧值不同 | "true" | #833 A7 / design D5 |

## R-8 A8 图片 / 视频手柄六点与对齐

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 图片 / 视频转换手柄手柄点数 | 6 | #833 A8 / 截图：单元格转换手柄 / design D1 |
| A-8.2 | exact | 与标题手柄纵向中心差上限（px） | 2 | #833 A8 / design D1 |

## R-9 A9 表格与单元格手柄复用全局菜单

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 滑入表格表头转换手柄节点数 | 1 | 截图：单元格转换手柄1-任务 / design D6 |
| A-9.2 | exact | 滑入单元格转换 / 新增手柄节点数 | 2 | 截图：单元格新增手柄 / design D6 |
| A-9.3 | exact | 单元格菜单项集与全局菜单项集相等 | "true" | #833 A9 / design D6 |
| A-9.4 | exact | 上缘 / 左缘行列插入热点完整（非孤立灰点） | "true" | 截图：单元格转换手柄1-任务 / design D6 |

## R-10 B1 新增手柄菜单重构（基础 / 常用）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | exact | 基础段图标数 | 8 | #833 B1 / design D7 |
| A-10.2 | exact | 基础段文字节点数 | 0 | #833 B1 / design D7 |
| A-10.3 | exact | 常用段项数 | 8 | #833 B1 / design D7 |
| A-10.4 | exact | 基础段前三项可访问名顺序 | "H1,H2,H3" | #833 B1 / design D7 |

## R-11 B3 分栏弹窗说明与实时栏数

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 分栏弹窗说明文字节点数 | 1 | #833 B3 / design D7 |
| A-11.2 | exact | 滑到第 3 根柱子时实时栏数文案 | "3" | #833 B3 / design D7 |

## R-12 B2 状态栏页面宽度弹窗配色

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-12.1 | exact | 选中档进度条与色块计算色相等 | "true" | #833 B2 / design D8 |
| A-12.2 | exact | 未选中档与选中档同色相 | "true" | #833 B2 / design D8 |

## R-13 B4 页签右键菜单图标与导出 hover 二级

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-13.1 | exact | 「移动到」与「打开文件位置」图标 path 去重数 | 2 | #833 B4 / design D9 |
| A-13.2 | state-machine | hover「导出」→二级出现 | 出现→1 | #833 B4 / design D9 |
| A-13.3 | exact | 移出父项后二级节点数 | 1 | #833 B4 / design D9 |

## R-14 B7 页签名下拉信息窗

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-14.1 | exact | 信息窗行数 | 3 | 截图：文件信息 / design D9 |
| A-14.2 | exact | 路径可点击层数下限 | 1 | 截图：文件信息 / design D9 |
| A-14.3 | exact | 最近保存时间文案非空 | "true" | 截图：文件信息 / design D9 |

## R-15 B6 md 编辑态横向工具条回滚

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-15.1 | exact | md 编辑态横向工具条按钮集合等于回滚目标版本 | "true" | #833 B6 / design D11 |
| A-15.2 | exact | HTML 可视化编辑态工具条按钮集合不变 | "true" | #833 B6 / design D11 |

## R-16 B5a 插入文件内嵌渲染

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-16.1 | exact | 内嵌内容节点数下限 | 1 | #833 B5 / design D10 |
| A-16.2 | exact | 默认高度约一屏 | "true" | #833 B5 / design D10 |
| A-16.3 | state-machine | 拖拽改高宽→显示尺寸变化 | 变化→生效 | #833 B5 / design D10 |

## R-17 B5b 内嵌文件滚动定格与重开保持

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-17.1 | state-machine | 滚动后滑出→定格；再次打开→保持 | 定格→重开一致 | #833 B5 / design D10 |
| A-17.2 | exact | 重开后定格位置与滑出时一致 | "true" | #833 B5 / design D10 |

## R-18 B5c 内嵌文件名称态、悬浮预览与新标签页

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-18.1 | state-machine | 名称态 hover→悬浮预览出现 | 出现→1 | #833 B5 / design D10 |
| A-18.2 | exact | 切换名称态 / 内容态节点正确 | "true" | #833 B5 / design D10 |
| A-18.3 | exact | 点击支持打开的链接在新标签页打开 | "true" | #833 B5 / design D10 |

## R-19 C1a 标题字体配置字段与设置 UI

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-19.1 | exact | `heading_fonts` 含 6 级键 | "true" | #833 C1 / design D12 |
| A-19.2 | exact | 非法字体被拒绝并回落 | "true" | #833 C1 / design D12 |
| A-19.3 | exact | 设置面板逐级入口数 | 6 | #833 C1 / design D12 |

## R-20 C1b 标题字体在编辑态与预览态应用

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-20.1 | exact | h1 计算 `font-family` 等于配置值 | "true" | #833 C1 / design D12 |
| A-20.2 | exact | 正文计算 `font-family` 不变 | "true" | #833 C1 / design D12 |
| A-20.3 | exact | 默认 h1 `font-family` 等于 `--type-font-sans` | "true" | #833 C1 / L-1 第 6 条 |

## R-21 C2 栏目页签空白处拖动窗口

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-21.1 | state-machine | 空白处按下移动超阈值→窗口位置变化 | 超阈值→拖动 | #833 C2 / design D13 |
| A-21.2 | exact | 页签 / 按钮区域按下不触发窗口拖动 | "true" | #833 C2 / design D13 |

## R-22 C3 左边栏固定隐藏 / 显示

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-22.1 | exact | 固定隐藏后左侧箭头区域节点数 | 0 | #833 C3 / design D14 |
| A-22.2 | state-machine | 隐藏态滑入→不显示；取消固定→滑入显示 | 隐藏→0，取消→1 | #833 C3 / design D14 |
| A-22.3 | exact | 设置开关写入 `rail_pin_hidden` | "true" | #833 C3 / design D14 |

## R-23 C4a 文本 / 脚本文件行号

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-23.1 | exact | 非 Markdown 文本 / 脚本编辑态行号节点数下限 | 1 | #833 C4 / design D15 |
| A-23.2 | exact | Markdown 编辑态行号节点数 | 0 | #833 C4 / design D15 |

## R-24 C4b 预览态语法颜色与代码块缩进

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-24.1 | exact | 预览态代码块 `.tok-*` 节点数下限 | 1 | #833 C4 / design D15 |
| A-24.2 | exact | 代码块前导缩进保留 | "true" | #833 C4 / design D15 |

## R-25 C5 颜色菜单恢复默认

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-25.1 | exact | 颜色菜单「恢复默认」项存在 | "true" | #833 C5 / design D16 |
| A-25.2 | exact | 点击后 `mdb-color-*` 节点数 | 0 | #833 C5 / design D16 |
