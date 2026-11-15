# 验收锚点 — editor-surface-batch20

锚点来源：用户 2026-11-15 反馈（spec issue #897）+ 一手证据 `标月 Biaoyue2.pdf` / `formula-mermaid.md`；design.md D1–D6 与「数据面」。R-1…R-29 对应 tasks.md 1.1–6.1。

## R-1 A1 打印→PDF 内容完整性

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 打印输出 PDF 文本含 mermaid 之后「代码高亮」小节出现次数下限 | 1 | #897 缺陷1 / 一手证据 Biaoyue2.pdf |
| A-1.2 | exact | 打印输出 PDF 文本含 typescript 代码块函数名 `greet` 出现次数下限 | 1 | 一手证据 formula-mermaid.md |
| A-1.3 | exact | 打印输出 PDF 文本含 DANGER callout 文案出现次数下限 | 1 | 一手证据 formula-mermaid.md |
| A-1.4 | exact | 画布高度守卫须按缩放折算为设备像素（`PNG_SCALE`×CSS 上限） | 1 | design D1 |

## R-2 B1 卡片视频缩略图与悬浮窗画面

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 网格卡片视频缩略图内取帧后 `<video>` 节点数下限 | 1 | #897 缺陷2 / design D2 |
| A-2.2 | state-machine | 缩略图取帧：`onLoadedMetadata` 后 `currentTime` > 0 | 就绪→已取帧 | #897 缺陷2 / design D2 |

## R-3 B2 文本卡片标题不压进度

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 文本卡片标题矩形与进度文字矩形交集面积（px²） | 0 | #897 缺陷2 / design D2 |

## R-4 B3 字幕同名收敛

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 打开 `a.mp4`（同目录含 `a.srt` 与 `b.srt`）时字幕候选数 | 1 | #897 缺陷3 / design D2 |
| A-4.2 | exact | 初始打开同名视频自动加载的字幕文件数 | 1 | #897 缺陷3 / design D2 |

## R-5 B4 重启不自动播放与单声道

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 打开/重启恢复后 `HTMLMediaElement.play` 调用计数 | 0 | #897 缺陷6 / file-management C-6 |
| A-5.2 | exact | 点击播放一次后 `play` 调用计数 | 1 | #897 缺陷6 / design D2 |
| A-5.3 | exact | 同时输出声音的音轨数上限 | 1 | #897 缺陷6 / design D2 |

## R-6 B5 MD 编辑态媒体渲染

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | MD 编辑态图片节点 `naturalWidth` 下限（px） | 1 | #897 缺陷5 / design D2 |
| A-6.2 | exact | MD 编辑态视频节点 `readyState` 下限 | 1 | #897 缺陷5 / design D2 |
| A-6.3 | exact | 解析失败时裂图「问号框」节点数 | 0 | #897 缺陷5 / design D2 |

## R-7 B6 进度缩略图定位与格内适配

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-7.1 | exact | 缩略图浮层 top 与进度条 top 的关系（缩略图 top < 进度条 top） | 1 | #897 缺陷12 / design D2 |
| A-7.2 | state-machine | 分栏比例改到 90% → 播放器尺寸适配格内容区 | 变化→尺寸=格内容区 | #897 缺陷12 / design D2 |

## R-8 B7 播放图标

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-8.1 | exact | 新播放图标 path 与 `camera`（截图）图标 path 不同 | 1 | #897 优化3 / design D2 |
| A-8.2 | exact | 卡片播放角标使用新播放图标的节点数下限 | 1 | #897 优化3 / design D2 |

## R-9 B8 MD 嵌入图片圆角统一

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-9.1 | exact | 编辑态图片与视频块计算 `border-radius` 之差（px） | 0 | #897 优化4 / design D2 |

## R-10 B9 嵌入视频宽度档与全屏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-10.1 | exact | 嵌入视频默认宽度 / 内容区宽度的比值（容差 ±5%） | 0.667 | #897 优化5 / design D2 |
| A-10.2 | exact | 宽度档菜单项数（满页面宽度 + 全屏） | 2 | #897 优化5 / design D2 |
| A-10.3 | exact | 右键「全屏」触发窗口全屏调用的次数下限 | 1 | #897 优化5 / design D2 |

## R-11 C1 提示外壳与方位

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-11.1 | exact | 自绘提示计算 `border-radius` ≥ 提示高度一半（任一类） | 1 | #897 缺陷4 / editing E-22 |
| A-11.2 | exact | 原生矩形 `title` 提示节点数 | 0 | #897 缺陷4 / editing E-22 |
| A-11.3 | state-machine | 全局「提示时长」设 1.0s → 1100ms 出现、1000ms 前不出现 | 设置→延迟生效 | #897 缺陷4 / configuration |
| A-11.4 | exact | 状态栏右键入口提示水平中心与按钮中心偏差上限（px） | 4 | #897 缺陷4 / application-shell |

## R-12 C2 悬浮窗高度

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-12.1 | exact | 悬浮窗高度相对现状基线收紧（px，负增量） | ≤0 | #897 优化2 / design D3 |
| A-12.2 | exact | 图标与容器上下间距上限（px，设计系统刻度） | 8 | #897 优化2 / 设计系统 §3 |

## R-13 C3 导出子菜单生命周期与菜单提示

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-13.1 | state-machine | 指针移出「导出行 ∪ 二级面板」并集 → 子菜单节点数 | 移出→0 | #897 缺陷7 / navigation 页签右键菜单文件动作 |
| A-13.2 | exact | 菜单项悬停时原生黑矩形 `title` 节点数 | 0 | #897 缺陷7 / editing E-22 |

## R-14 C4 移动到图标与去重

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-14.1 | exact | 「移动到」图标含向右箭头（path 与 locate/folder 不同） | 1 | #897 优化8 / 设计系统 §2.3 |
| A-14.2 | exact | 图标去重单测通过（不同概念不复用 path） | 1 | #897 优化8 / src/__tests__/ui/icons.test.ts |

## R-15 C5 菜单统一 grammar

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-15.1 | exact | 斜杠/新增/功能块三类菜单计算 `font-size` 相等 | 1 | #897 优化10 / design D3 |
| A-15.2 | exact | 菜单宽度（px） | 176 | 设计决案 #497 / design D3 |
| A-15.3 | exact | 菜单行高（px） | 36 | E-11 / design D3 |

## R-16 D1 标题配色编辑态生效

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-16.1 | exact | 编辑态 h1 计算 `color` 等于配置/主题标题色 | 1 | #897 缺陷8 / editing E-8 |
| A-16.2 | exact | 编辑态正文计算 `color` 不受标题配色影响 | 1 | #897 缺陷8 / editing E-8 |

## R-17 D2 预览态标题折叠触发区

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-17.1 | exact | 预览态折叠按钮命中盒尺寸（px） | 20 | #897 缺陷9 / editing 标题折叠 |
| A-17.2 | exact | 预览态与编辑态折叠触发区尺寸偏差上限（px） | 2 | #897 缺陷9 / editing 标题折叠 |

## R-18 D3 逗号→/ 与撤销键

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-18.1 | state-machine | 行首输入「，」→ 文档出现「/」且菜单节点数 | 输入→1 | #897 缺陷14 / editing E-36 |
| A-18.2 | exact | 围栏代码块内输入「，」后斜杠菜单节点数 | 0 | editing E-36 |
| A-18.3 | exact | Mod-Z 一次撤销后内容变化次数 | 1 | #897 缺陷14 / editing 撤销与重做快捷键 |

## R-19 D4 横向工具条回滚

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-19.1 | exact | md 编辑态选区工具条按钮数（收敛目标量级） | 12 | #897 缺陷14 / editing 编辑态工具条归属 |
| A-19.2 | exact | 非 md 的 CSS 横条按钮集合不受影响 | 1 | #897 缺陷14 / design D4 |

## R-20 D5 嵌套录入手柄

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-20.1 | exact | 引用/单元格/分栏内可召唤转换手柄的容器数下限 | 3 | #897 优化6 / design D4 |
| A-20.2 | exact | 嵌套容器内可见源码标记（`**`/`##`）节点数 | 0 | #897 优化6 / design D4 |

## R-21 D6 Tab 缩进渲染与边框对齐

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-21.1 | state-machine | 引用块 Tab 缩进后装饰仍在位且可输入 | 缩进→可编辑 | #897 优化7 / design D4 |
| A-21.2 | exact | 引用块右边界 x 与正文右边界 x 之差（px） | 0 | #897 优化7 / design D4 |

## R-22 D7 分栏/表格编号位置

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-22.1 | exact | 表格读数右缘与网格最右边界线 x 之差（px） | ≤1 | #897 优化11 / design D4 |
| A-22.2 | exact | 分栏读数中心与第 5 栏中心偏差（px） | ≤2 | #897 优化11 / design D4 |
| A-22.3 | exact | 分栏子菜单垂直中心与触发行中心偏差（px） | ≤2 | #897 优化11 / design D4 |

## R-23 D8 文本显示格式统一

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-23.1 | exact | 行号文字右缘与正文左缘间距上限（px） | 12 | #897 优化13 / editing 文本与脚本文件行号 |
| A-23.2 | exact | 编辑态与预览态代码块计算 `font-family` 相等 | 1 | #897 优化13 / design D4 |
| A-23.3 | exact | 语法配色以 `.tok-*` 为唯一来源（新增色板数） | 0 | #897 优化13 / design D4 |

## R-24 D9 文本工具条只复制

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-24.1 | exact | 文本/脚本文件工具条按钮数（编辑态） | 1 | #897 优化14 / editing 编辑态工具条归属 |
| A-24.2 | exact | 文本/脚本文件工具条按钮数（预览态） | 1 | #897 优化14 / editing 编辑态工具条归属 |

## R-25 E1 页签空白拖动窗口

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-25.1 | exact | `.tab-strip` 空白计算 `cursor` 为抓取/移动语义 | 1 | #897 缺陷10 / design D5 |
| A-25.2 | exact | 空白拖动时栏目拖动浮层节点数 | 0 | #897 缺陷10 / design D5 |
| A-25.3 | exact | 空白拖动触发窗口拖动调用次数 | 1 | #897 缺陷10 / design D5 |

## R-26 E2 双击页签空白全屏

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-26.1 | state-machine | 双击页签空白 → `isFullscreen` 翻转 | 双击→true | #897 缺陷13 / application-shell |
| A-26.2 | exact | 全屏权限 `allow-set-fullscreen` 就位 | 1 | #897 缺陷13 / design D5 |

## R-27 E3 左边栏快捷键与网格预览冲突

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-27.1 | state-machine | 网格概览打开时按 `⌘⇧X` → `rail_pin_hidden` 翻转 | 按下→翻转 | #897 缺陷11 / navigation 左边栏展开与固定快捷键 |
| A-27.2 | exact | shortcuts 登记键位重复数 | 0 | #897 缺陷11 / src/lib/shortcuts.ts |

## R-28 E4 大纲按钮/等级/拖拽

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-28.1 | exact | 大纲按钮 `top` 相对现状增大（按条目高 ×2，px） | ≥48 | #897 优化9 / design D5 |
| A-28.2 | exact | 大纲条目前导竖线节点数 | 0 | #897 优化9 / editing E-10 |
| A-28.3 | state-machine | 拖动大纲条目 → 顺序变化并持久化 | 拖动→顺序变 | #897 优化9 / design D5 |

## R-29 F1 标题字体显示与预设

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-29.1 | exact | 未配置时字体输入显示当前默认字体值（非空） | 1 | #897 优化12 / configuration 标题字体逐级配置 |
| A-29.2 | exact | 预设列表中国家专有字体硬编码项数 | 0 | #897 优化12 / design D6 |
