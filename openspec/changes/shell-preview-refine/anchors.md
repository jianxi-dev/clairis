# 验收锚点 — shell-preview-refine

锚点来源：issue #1134 的五处需求与方案、主规格 `application-shell`（G-6「页签间距」与「状态栏（含主页入口 / 自动布局入口 / 宽度面板 / 主题面板）」）、`navigation`「页签条与格头」、`reading`「文本与脚本预览语法」、`configuration`「标题字体逐级配置」，以及 `design.md` D1–D5。R-1…R-4 对应 tasks.md 1.1–4.1；A-1.x 归 1.1，A-2.x 归 2.1（含禅模式文案），A-3.x 归 3.1，A-4.x 归 4.1。

断言值全部取自用户明示数值（8px 热区、页签内 ≤6px 间距、256px 信息窗宽度）、主规格条款或设计系统既有 token（`--tab-info-width`、`--app-text-3`、LANGUAGES 表）；不引入未定义像素值。

> DQ-9（真机偏差类验收分级）：A-1.1–A-1.4、A-2.5–A-2.8 属布局测量类，A-4.2 属系统能力类——headless 绿单独不构成关闭条件；实现票须附真机清单项（见 tasks.md 各票 AC 的「真机清单」）。

## R-1 状态栏默认隐藏与底边热区滑入滑出

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 应用启动且未钉住、指针未入热区时状态栏渲染可见性的布尔 | 0 | application-shell「状态栏（含主页入口 / 自动布局入口 / 宽度面板 / 主题面板）」默认隐藏条款 / design D1 |
| A-1.2 | exact | 指针进入窗口底部 8px 热区后状态栏渲染可见性的布尔 | 1 | application-shell 同上 / design D1 |
| A-1.3 | exact | 指针移出底边热区后状态栏渲染可见性的布尔 | 0 | application-shell 同上 / design D1 |
| A-1.4 | exact | 用户显式钉住状态栏后状态栏渲染可见性的布尔 | 1 | application-shell 同上（钉住开关语义不变） / design D1 / #1134 |

## R-2 禅模式文案 + 页签收紧（2.1）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 禅模式入口按钮 `title` 属性字符串 | "禅模式（⌘⇧F）" | application-shell「状态栏（含主页入口 / 自动布局入口 / 宽度面板 / 主题面板）」禅模式入口条款 / design D2 / #1134 |
| A-2.2 | exact | 禅模式入口按钮 `aria-label` 属性字符串 | "禅模式" | application-shell 同上 / design D2 / #1134 |
| A-2.3 | exact | 禅模式入口图标 label 字符串 | "禅模式" | application-shell 同上 / design D2 / #1134 |
| A-2.4 | exact | 禅模式入口 `aria-keyshortcuts` 含 ⌘⇧F 的布尔 | 1 | application-shell 同上（快捷键保留） / design D2 / #1134 |
| A-2.5 | exact | 单个页签内标题右缘到关闭按钮左缘的距离（px） | 6 | #1134「文件名和关闭图标的间距」/ design D3（相邻页签 column-gap 保持 32px，不改） |
| A-2.6 | exact | 页签名信息窗的计算宽度（px），取 token `--tab-info-width` | 256 | navigation「页签条与格头」信息窗条款 / design-system §7.4 / design D3 / #1134 |
| A-2.7 | exact | 文件名节点之后复制图标按钮数 | 2 | navigation「页签条与格头」复制动作条款 / design D3 / #1134 |
| A-2.8 | exact | 复制图标计算颜色等于 `--app-text-3` 的布尔 | 1 | navigation 同上 / design-system §6 `--app-text-3` / design D3 / #1134 |

## R-3 脚本文件整文件预览高亮

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 预览态打开 `.js` 文件的 `.tok-*` 节点数 | ≥1 | reading「文本与脚本预览语法」整文件预览条款 / design D4 / #1134 |
| A-3.2 | exact | 预览态打开 `.ts` 文件的 `.tok-*` 节点数 | ≥1 | reading 同上 / highlight.ts LANGUAGES 表 / design D4 |
| A-3.3 | exact | 预览态打开 `.py` 文件的 `.tok-*` 节点数 | ≥1 | reading 同上 / highlight.ts LANGUAGES 表 / design D4 |
| A-3.4 | exact | 预览态打开未知扩展名文件的 `.tok-*` 节点数 | 0 | reading 同上回退条款 / design D4 |

## R-4 标题字体本机枚举

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | `list_fonts` 命令注册进 `invoke_handler` 的布尔 | 1 | configuration「标题字体逐级配置」候选来源条款 / design D5 / #1134 |
| A-4.2 | exact | 设置面板标题字体 `datalist` 候选节点数 | ≥1 | configuration 同上 / design D5 |
| A-4.3 | state-machine | 用户从候选中选择字体 → `heading_fonts` 配置持久化（含所选级别键且值为该字体） | 选择→配置落盘 | configuration 同上「逐级配置持久化」 / design D5 |
| A-4.4 | state-machine | 枚举命令失败 → 输入框可手输且枚举失败提示可见 | 失败→降级可手输 | configuration 同上「枚举失败降级手输」 / design D5 |
