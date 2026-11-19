---
title: 需求实现状态总览
type: delivery
status: accepted
last_updated: 2026-11-20
source_of_truth: supporting
---

# 需求台账（需求 × 实现状态总览）

> 本表是全项目**需求统一入口**：凡项目里出现过的需求（含未立项、历史遗留），都应收敛到本表登记，避免散落各处无法追踪。它不是独立真相源——
> - 逐功能可验收行为（怎么算对）以 `openspec/specs/<domain>/spec.md` 为准；
> - 进行中变更（正在改什么）以 `openspec/changes/` 活跃 change 为准；
> - 本表的状态列**必须**能从 openspec 归档记录推断，禁止脱离 openspec 自行标状态。

## 维护规则（硬约束）

1. **新增/变更需求**：先 `/opsx-propose` 建立 change 工作包（proposal + design + tasks），需求才算"进行中"。
2. **实现**：`/opsx-apply` 勾选任务、同步 delta specs。
3. **完成**：`/opsx-archive` 归档（delta 合入主规格、变更移入 `openspec/changes/archive/`）后，本表状态列更新为 ✅。
4. **新需求一律先登记到本表"未立项需求"节**，再走 propose 立项；禁止只在对话/其他文件里提需求不登记。
5. **状态口径**：
   - ✅ = 有归档 change 覆盖（实现 + 验收 + 规格折叠闭环完成）
   - 🟡 = 已实现/已完成设计，但**未走 openspec 变更登记**（多为 V3 沿用或早期实现，建议逐步补 change 记录）
   - ⬜ = 待开发（设计已定或未定，无实现）
   - 🗒 = 未立项（已登记、尚未建 change）
6. 每次归档后跑一次 `openspec list` 确认 active changes 归零；本表随最新归档同步。

## 快捷命令

```bash
openspec list              # 进行中变更（0 = 当前无在做的功能）
openspec list --specs      # 各域 + requirement 数
openspec view              # 交互式 dashboard（specs + changes 一屏总览）
openspec status --change <name>   # 单个变更工件完成度
```

## 总览统计（截至 2026-11-09）

- 规格：17 域 / 216 requirement（2026-11-13 归档 table-editing-polish 后；本次仅修订 E-6/E-7/E-14，无新增）
- ✅ 经 openspec 归档实现：56
- 🟡 已实现/设计完成（未走 openspec 变更）：24
- ⬜ 待开发：16
- 🗒 未立项（遗留散件登记）：约 16（展卷仪式 8 模块 + TODOS 安全/功能项）
- 布局域（`layout-portal`）：12 条构建验收（L-1…L-12，第 12 条 Out of Scope）已实现，16/16 票合并，已归档 `openspec/changes/archive/2026-11-05-layout-portal`
- 阅读/编辑表面域（`reading-surface-refine`）：+10 需求（G-6/G-7、A-13/A-14、E-17/E-18、N-1…N-3、CF-6）已实现，8/8 票合并（含 #224/#226/#231 三次缺陷修复），已归档 `openspec/changes/archive/2026-11-06-reading-surface-refine`
- 编辑域（`html-edit-toolbar`）：+1 需求（E-19 HTML 可视化编辑工具条），已归档 `openspec/changes/archive/2026-11-07-html-edit-toolbar`（PR #264）
- 编辑域（`html-visual-move-capture`）：+2 需求（E-20 拖拽移动节点、E-21 区域截图），已归档 `openspec/changes/archive/2026-11-07-html-visual-move-capture`（PR #266）
- 编辑域（`html-toolbar-by-node-type`）：+1 需求（E-22 工具条按节点类型分化），已归档 `openspec/changes/archive/2026-11-07-html-toolbar-by-node-type`（PR #269）
- 外壳/阅读域（`workspace-ux-batch4`）：+8 需求（G-8…G-12、A-15…A-17），5/5 票合并（PR #278–#282），已归档 `openspec/changes/archive/2026-11-07-workspace-ux-batch4`
- 外壳/编辑/阅读/文件域（`shell-editor-batch5`）：+9 需求（C-4、E-10/E-11/E-13/E-16、G-3/G-7/G-8/G-10），18/18 票合并（PR #331–#351，含 #343/#347 两个缺陷），已归档 `openspec/changes/archive/2026-11-08-shell-editor-batch5`
  - 附加入口批：PDF 卡片真首页缩略图（#317，pdfium 渲首页→dataURL，失败回退占位）、pin/pinOff 改标准图钉造型（#352，PR #353）
- 外壳/媒体/阅读域（`shell-media-batch7`）：11/11 票合并（PR #423–#436），净 +3 requirement（+5 新增、-2 被取代），已归档 `openspec/changes/archive/2026-11-08-shell-media-batch7`
- 外壳/页面/编辑/阅读/文件域（`ui-polish-batch15`）：11/11 票合并（PR #683–#693），净 +8 requirement（application-shell 1 / configuration 2 / editing 3 / reading 2）、2 条 requirement 修订（G-3 无品牌顶栏改为含窗口按钮落点；块对齐补编辑态隐藏围栏），已归档 `openspec/changes/archive/2026-11-12-ui-polish-batch15`
  - 视频默认档连播下一个视频（音频不静默起播）+ 竖拍适配回归、轮盘改显式快捷键召唤（默认圆心/双击切盘/中键拖动持久化）、轮盘搜索 9 行上限与固定快捷键列、历史组补剪切与透明项棋盘格、提示时长可配（含回滚）、对齐围栏编辑态隐藏、页签喇叭按文件隔离、音频静音即时暂停、PDF 按钮栏固定显隐、顶栏去品牌与窗口按钮按钉住落点、栏目菜单边界翻转
- 编辑域（`image-block-editing`）：9/9 票合并（PR #659–#664、#677–#679、#680、#681），+2 requirement（+3 新增、-1 编号让位：E-24 改授图片块编辑）、3 条 requirement 修订（E-11 块菜单、转换菜单图标与二级面板、高亮块图标间距），已归档 `openspec/changes/archive/2026-11-12-image-block-editing`
  - 图片块选中态/工具条/双击最大化、属性语法（width/height/align/crop）与括号路径保护、四边四角缩放、无损裁剪（裁剪浮层 + 裁剪矩形写回）、描述行（占位/提交/收起）、剪贴板粘贴图片、块菜单图标补齐与二级面板互斥、高亮块图标间距归零
- 编辑/阅读/导出域（`editor-surface-batch16`）：19/19 票合并（PR #716–#734），+12 requirement（editing 9：E-23 块宽度、E-24 编辑态公式与代码高亮、E-25 手柄菜单稳定与拖块、E-26 插入菜单表格与分栏、E-27 图片描述、E-28 图片裁剪、E-29 图片对齐与缩放锚点、E-30 图片预览浮层、E-31 块菜单与任务图标；reading 2：A-18 预览宽度与字体、A-19 预览图片圆角；export 1：EX-7 Markdown 打印），已归档 `openspec/changes/archive/2026-11-13-editor-surface-batch16`
  - 视频测试基线（逆时针断言、播放列表事件驱动）、手柄菜单回移不拆且图片/表格菜单贴手柄、拖块插入指示线与 Esc 取消、全屏按钮栏自动浮现、两态块宽度对齐、编辑态等宽统一、编辑态 KaTeX 公式与围栏代码高亮、Pele 两态字体同源、表格网格增量高亮保留选中、分栏 5 横向栏目、A4 打印、图片描述/裁剪/对齐/缩放锚点/预览浮层/圆角/块菜单/任务图标
- 编辑域（`table-editing-polish`）：6/6 票合并（PR #746–#751），3 条 requirement 修订（editing：E-6 斜杠菜单内容输入上下文与单元格手柄、E-7 行列插入圆点与上下文命令安全集、E-14 上下文菜单以控件矩形定位），无新增 requirement，已归档 `openspec/changes/archive/2026-11-13-table-editing-polish`
- 编辑/阅读/导航/配置域（`editor-surface-batch17`）：21/21 票合并（PR #772–#797），+15 requirement / ~12 修订（editing 新增 E-32..E-39 并修订 E-11/E-19/E-20/E-22/E-24/E-26/E-27/E-28/E-29/E-30；reading 新增预览分栏与嵌入视频、修订 PDF 按钮栏；navigation 新增页签菜单关闭/左边栏快捷键/页签文件动作；application-shell 新增页签空白全屏与更多菜单；configuration 修订提示信息显示时长），已归档 `openspec/changes/archive/2026-11-14-editor-surface-batch17`
- 编辑/阅读/导出域（`editor-surface-batch18`）：3/3 票合并（PR #810–#812），文件动作迁到页签右键菜单（导出就地 6 项子菜单、打印独立项）、打印按 Markdown 预览态输出（mermaid 成图、打印后恢复现场）、裁剪图显示盒受容器约束并按比例（修复图片文档滚动异常），已归档 `openspec/changes/archive/2026-11-14-editor-surface-batch18`
  - 单元格手柄统一图标/垂直居中/表头无手柄/圆角 3px、行列插入圆点（上/左外缘、悬停变 +、点击插入删除）、斜杠菜单内容输入上下文（单元格/分栏/高亮块就地打开、焦点保持、Esc 回滚、死代码清理）、分栏与高亮块「+」手柄、上下文命令安全集（单元格=行内+单行片段，容器=全量）

- 外壳/导航/搜索域（`editor-surface-batch22`）：2/2 票合并（PR #1086/#1087），3 条 requirement 修订，无新增 requirement（application-shell G-6 页签标题单行全显 + 页签间距 16px→32px；navigation 页签条与格头同步单行全显/间距口径；search-replace-float S-3 选中行徽标改键帽式回车图标 + 悬停更新 `activeIndex`），已归档 `openspec/changes/archive/2026-11-18-editor-surface-batch22`
- 外壳/导航域（`tab-title-info-surface`）：3/3 票合并（PR #1108–#1110），4 条 requirement 修订、1 条删除（application-shell G-6 页签标题固定 120px + 省略号、信息窗外壳与间距口径；navigation 页签条与格头同步、信息窗改 8px 圆角固定 320px + 换行 + 复制路径/复制文件；editing E-22 为信息窗开矩形豁免；删除互斥的「页签栏空白双击新建文档」并把全屏断言改为 `isFullscreen()`），已归档 `openspec/changes/archive/2026-11-18-tab-title-info-surface`

- 编辑/阅读/搜索/属性域（`editor-surface-batch23`）：4/4 票合并（PR #1094/#1095/#1096/#1097），5 条 requirement 修订，无新增 requirement（search-replace-float S-1 顶栏标题 / 关闭钮位次 / 输入框一键清空、S-3 结果区与快捷键字号 +1 档、S-6 状态栏文案去「（局部 · 浮窗内）」；editing E-10 层级标识仅悬停显示且更浅 + 拖动插入位置指示条 + 正文顺序同步；reading 预览态选区工具条拖选完成后再显示；doc-property-panel P-3 日期时间改单一面板选择器），已归档 `openspec/changes/archive/2026-11-18-editor-surface-batch23`

- 搜索/替换域（`search-replace-refine`）：5/5 票合并（PR #1120–#1125），+1 requirement / 2 条修订（search-replace-float 新增「结果摘要文本化」——表格命中摘要转可读文本与序位下标映射；S-3 行尾快捷键随滚动重绑可视前 9 行、选中行显示 `↵` 字符；S-4 重开浮窗重置悬停残留、替换输入框一键清空），密度 token `--sf-ctrl-height: 27px`（design-system §7.1），已归档 `openspec/changes/archive/2026-11-18-search-replace-refine`
- 编辑/属性域（`document-properties-inline`）：2/2 票合并（PR #1131/#1132），+2 requirement / 2 条修订（doc-property-panel 新增「托管日期只读展示」——`created`/`updated` 排除字段行、A 模式底部 footer 左 / B 模式备注行右；新增「AB 形态切换入口与窄窗自适应」——标题栏 AB 图标 + 全局偏好 `docPropertyVariant` 持久化 + 窄窗 <720px 自动胶囊且手动优先；P-2/P-4 修订：选择模式字段名+标签行可选、值不参与、全选/反选二态与反选反转），已归档 `openspec/changes/archive/2026-11-18-document-properties-inline`
- 外壳/阅读/配置域（`shell-preview-refine`）：4/4 票合并（PR #1140–#1143），5 条 requirement 修订（application-shell 状态栏默认隐藏 + 底边 8px 热区滑入滑出 + 钉住保留、禅模式文案保留 ⌘⇧F；navigation 页签内标题↔关闭间距 ≤6px（相邻页签 32px 不变）、信息窗 `--tab-info-width` 320→256px + 复制图标移至文件名后弱化档；reading 整文件预览语法着色预算上调至 200k 字符；configuration 标题字体枚举本机字体族 + 失败降级手输），已归档 `openspec/changes/archive/2026-11-19-shell-preview-refine`
- 编辑/属性域（`doc-property-restore`）：5/5 票合并（PR #1167/#1169/#1171/#1189 + 收口），2 条 requirement 修订 + 7 个新增场景（doc-property-panel P-4 新增「选中整块高亮含值」「选中集复制不含值」「粘贴重建空值字段」「单击字段名进入改名」「已选中后点击其他字段切换选中」「行手柄点击选中」；P-2 新增「L/T 图标语义与存储兼容」；P-2/P-4 正文改为 L/T 展示语义 + 三元组交互 + 复制不含值语义），设计系统 §2.3 `docPropertyVariant` 改 L/T + 图形规范、decisions.md 台账行；存储值仍 `A`/`B`、`displayStyle` 仍 list/dual 不迁移，已归档 `openspec/changes/archive/2026-11-19-doc-property-restore`
- 搜索/替换域（`search-replace-interaction`）：4/4 票合并（PR #1198/#1200/#1201/#1202），2 条 requirement 修订、无新增 requirement（search-replace-float S-3：悬停全文预览放开 `replaceMode` gate——普通搜索态与替换模式均可唤出、结果行斑马纹（奇偶行取 surface/sunken 交替，悬停与当前命中覆盖交替底色）；S-4：预览态 ⇄ 按钮可见但灰置禁用（title「预览态不可替换」）、移除结果行 inline diff），已归档 `openspec/changes/archive/2026-11-19-search-replace-interaction`
- 配置域（`settings-font-picker`）：3/3 票合并（PR #1204/#1205/#1206），1 条 requirement 修订 + 5 个新增场景（configuration「标题字体逐级配置」新增「默认占位显示」「清空回落默认」「值来源区分」「自绘候选列表主题与键盘导航」「候选名本地化与中文优先排序」；headingFonts 改部分映射、Rust 枚举返回 `FontFamily { family, localized }` 且中文优先排序、datalist 换自绘 `HeadingFontField`），已归档 `openspec/changes/archive/2026-11-19-settings-font-picker`
- 外壳/导航域（`shell-tabs-surface`）：2/2 票合并（PR #1208/#1209），2 条 requirement 修订（navigation 页签弹性等比伸缩 + `--tab-min-width: 96px`（design-system §7.5）、信息窗复制图标区分（copyPath/copyFile）与锚定 toast；application-shell 同步页签等比收缩与 `--tab-strip-tail: 24px` 尾部空白），已归档 `openspec/changes/archive/2026-11-19-shell-tabs-surface`
- 文件管理/视频域（`video-playback-refine`）：3/3 票（#1183 首帧 + #1185 PiP 语义 + #1149 已交付的手势迁移），2 条 requirement 修订（file-management C-6：打开显示首帧、不显示加载指示；画中画单文档单例、**切换即替换**（验证发现原实现只退出不替换，已修）；B9 嵌入视频条款补手势与单例语义），已归档 `openspec/changes/archive/2026-11-19-video-playback-refine`

- 编辑域（`table-editing-polish`）：6/6 票合并（PR #746–#751），3 条 requirement 修订（E-6 编辑内核与插入入口补上下文触发、手柄统一与表头无手柄；E-7 编排层补行列插入圆点与上下文命令集；E-14 浮层定位补触发控件矩形锚定），已归档 `openspec/changes/archive/2026-11-13-table-editing-polish`
  - 单元格手柄统一图标/垂直居中左边框线外/表头无手柄/圆角 3px、行列插入圆点上/左外缘悬停变 + 点击插入删除、斜杠菜单内容输入上下文（单元格/分栏/高亮块就地打开、焦点保持、Esc 回滚、定位与裁剪修正、死代码清理）、分栏与高亮块接入统一菜单 + 「+」手柄、上下文命令安全集（cell=行内+单行片段，container=全量）
- 规格对齐（`rail-thumb-spec-sync`）：阅读空间卡片缩略图 72×54 → 64×48（`navigation` 1 条 requirement 修订，总数不变），已归档 `openspec/changes/archive/2026-11-08-rail-thumb-spec-sync`
  - 主题弹层生命周期 + 单击循环切主题、图片右键应用内菜单、chrome 前景色统一、关闭其他图标、视频容器自适应与画面变换、沉浸态隐藏状态栏/未钉住左栏与每栏独立页签条、悬浮窗图片按宽可滚 + HTML 本地直载、一键自动布局
- 外壳/页面/编辑/阅读/文件域（`ui-polish-batch6`）：25/25 票合并（PR #394–#408），净 +5 requirement（+8 新增、-3 被取代），已归档 `openspec/changes/archive/2026-11-08-ui-polish-batch6`
- 外壳/页面/编辑/阅读/文件域（`ui-polish-batch8`）：11/11 票合并（PR #461–#471），+1 requirement（E-23 选中块尺寸拖拽），14 条 requirement 修订（状态栏/分栏/页签/悬浮预览/AI/PDF/编辑/视频），已归档 `openspec/changes/archive/2026-11-08-ui-polish-batch8`
- 外壳/页面/编辑/阅读/文件域（`ui-polish-batch9`）：9/9 票合并（PR #489），7 条 requirement 修订（状态栏/栏目头/悬浮预览/大纲/视频/标题折叠），已归档 `openspec/changes/archive/2026-11-09-ui-polish-batch9`
- 外壳/页面/编辑/阅读/文件域（`ui-polish-batch10`）：9/9 票合并（PR #500），9 条 requirement 修订（工具条归属/全角标点/块手柄/折叠/打开文件/视频多栏/页签/栏目），已归档 `openspec/changes/archive/2026-11-09-ui-polish-batch10`
- 外壳/页面/编辑/阅读/文件域（`ui-polish-batch13`）：11/11 票合并（PR #576–#586），+13 requirement（editing 6 / reading 4 / application-shell 2 / file-management 1），已归档 `openspec/changes/archive/2026-11-10-ui-polish-batch13`
- 编辑域（`selection-roulette`）：4/4 票合并（PR #473–#474），2 条 requirement 修订（选区浮动工具条改径向轮盘、E-19 HTML 源码编辑态接入轮盘；可视化块工具条保持），已归档 `openspec/changes/archive/2026-11-08-selection-roulette`
  - 顶栏取消（G-3 改为无品牌顶栏）、状态栏五入口 + 紧凑高度 + 宽度/主题面板、页签与状态栏视觉、视频倍速、选区工具条归属与 AI 三键、placeMenu 统一落位、空行手柄悬停即开、块菜单对齐与缩进合并、色板二级保持、PDF 悬浮预览隐藏缩放条、卡片缩略图高度收窄
- 文档治理域（`design-system-governance`）：+4 requirement（DG-2…DG-5），纯文档与流程改动，无运行时变更，已归档 `openspec/changes/archive/2026-11-08-design-system-governance`（PR #442）
  - 视觉数值唯一来源 `docs/design/system/spec.md`、append-only 决案台账 `decisions.md`、GOVERNANCE 台账例外与矩阵解释条款、ui-surface 票面视觉锚点、非功能视觉缺陷通道与四要素反馈模板；C9 机检 / tokens 扩容 / e2e 锚定留后续 change

## 逐域状态

### reading（15）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| A-1 | 冷启动秒开 | 🟡 | V3 沿用 |
| A-2 | GFM 完整渲染 | 🟡 | V3 沿用（marked） |
| A-3 | HTML 预览 | ✅ | change `html-css-view-support` / `html-preview-rework` |
| A-5 | 沉浸阅读模式 | 🟡 | 设计已批 `docs/design/approved/immersive-reading/` |
| A-6 | 全局字号缩放 | 🟡 | 设计已批 `docs/design/approved/font-size-scaling/` |
| A-7 | Dark/Light 主题 | 🟡 | V3 沿用 |
| A-8 | 滚动顺滑 | 🟡 | V3 沿用 |
| A-9 | 阅读进度与位置恢复 | ✅ | change `reading-view-implementation` |
| A-10 | 阅读宽度与标题配色 | ✅ | change `html-preview-rework` |
| A-11 | 预览表格宽度与自动换行 | ✅ | change `preview-table-width` |
| A-12 | 图表渲染（Pele，同步出图 / 主题变量 / 导出带图） | ✅ | change `diagram-engine-pele` |
| A-13 | 悬浮预览的离开关闭与媒体渲染（图片按宽可滚 / HTML 本地直载） | ✅ | `reading-surface-refine`（2026-11-06）；`shell-media-batch7`（归档 2026-11-08） |
| A-14 | HTML 摘要文本化 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| A-15 | 阅读空间宽度可调（钉住/悬浮两态） | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #279） |
| A-16 | 正文行宽连续可调（480–2400px 滑块） | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #279） |
| A-17 | HTML 预览首屏不阻塞（不预热编辑器 + 骨架） | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #280） |

### capture（15）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| D-1 | 大纲侧栏 | ⬜ | 设计已批 `docs/design/approved/outline-quick-capture/` |
| D-2 | Headings Palette | ⬜ | 设计已批同上 |
| D-3 | Quick Capture 全局浮窗 | 🟡 | 已实现（`src/components/CaptureOverlay.tsx`） |
| D-4 | prefix 粘滞输入 | 🟡 | 已实现 |
| D-5 | inbox daily file 保存 | 🟡 | 已实现 |
| D-6 | 文件面板 QC 条目接入 | ⬜ | 依赖 B-3 |
| D-7 | QC 转正 | ⬜ | — |
| D-8 | Cmd+Shift+, Inspector | ⬜ | — |
| D-9 | QC filter 与 batch | ⬜ | — |
| D-10 | 窗口宽高可调 | 🟡 | v5.4 已实现 |
| D-11 | 面板拖拽分隔条 | 🟡 | v5.4 已实现 |
| D-12 | X 按钮保存关闭 | 🟡 | v5.4 已实现 |
| D-13 | Escape 关闭语义 | 🟡 | v5.4 已实现 |
| D-14 | Capsule tooltip 移除 | 🟡 | v5.4 已实现 |
| D-15 | 一次批量混合 prefix 录入 | ✅ | change `capture-mixed-prefix-input` |

### application-shell（13）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| G-1 | 移除左侧栏逻辑 | ⬜ | 设计已批 `docs/design/approved/shell-ui/` |
| G-2 | 无右侧边栏 | ⬜ | 设计已批同上 |
| G-3 | 无品牌顶栏（内容贴顶；原「单一顶栏」已由本变更取代）；窗口按钮按左栏钉住落点、首标签避让 | ✅ | `ui-polish-batch6`（归档 2026-11-08）；`ui-polish-batch15`（归档 2026-11-12，PR #692） |
| N-9 | 栏目更多操作菜单按视口边界翻转 | ✅ | change `ui-polish-batch15`（归档 2026-11-12，PR #693） |
| 状态栏 | 六入口（含自动布局）/ ≤26px / 双击显隐 / 宽度面板 / 主题悬停面板 + 单击循环 | ✅ | `ui-polish-batch6`（归档 2026-11-08）；`shell-media-batch7`（归档 2026-11-08） |
| G-5 | 正文分栏（可选） | ⬜ | 设计已批同上 |
| B-2 | 空状态继续区分块 | 🟡 | 设计已批 `docs/design/approved/empty-state/` |
| B-4 | 内置示例文件释放 | 🟡 | `src-tauri/samples/` 已就位 |
| B-5 | 空状态设计规则 | 🟡 | 设计已批 `docs/design/approved/empty-state/` |
| G-6 | 顶栏职责与页签身份（页签标题固定 120px + 省略号、页签间距 32px；完整名在信息窗） | ✅ | change `reading-surface-refine`（归档 2026-11-06）；`editor-surface-batch22`（归档 2026-11-18，PR #1086）；`tab-title-info-surface`（归档 2026-11-18，PR #1108/#1109/#1110） |
| G-7 | 图标语义与全屏可用性 | ✅ | change `reading-surface-refine`（归档 2026-11-06）；`shell-editor-batch5`（2026-11-08） |
| G-8 | 页签拖拽轨迹与落点反馈 | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #278）；`shell-editor-batch5`（2026-11-08） |
| G-9 | 页签与栏目视觉贴合主题 | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #281） |
| G-10 | 沉浸模式 chrome 收纳（状态栏 / 未钉住左栏）与每栏独立页签条 | ✅ | `workspace-ux-batch4`（2026-11-07）；`shell-editor-batch5`（2026-11-08）；`shell-media-batch7`（归档 2026-11-08） |
| G-11 | 文件卡片工具条按类型收敛 | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #282） |
| G-12 | 分栏语义与分隔线独立性 | ✅ | change `workspace-ux-batch4`（归档 2026-11-07，PR #278） |

### navigation（5）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| B-1 | 启动面板（欢迎页） | 🟡 | 设计已批 `docs/design/approved/empty-state/` + `0-welcome.md` 就位 |
| B-3 | 统一文件面板（Cmd+P） | ⬜ | 无实现 |
| B-6 | 三视图切换 | ⬜ | 无实现 |
| B-7 | Ctrl+1~9 直开条目 | ⬜ | 无实现 |
| B-8 | 后退/前进历史导航 | ⬜ | 无实现 |
| N-1 | 本机最近文件自动发现 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| N-2 | 阅读空间预览触发区与列表回顶 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| N-3 | 本机标题与正文检索 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| N-4 | 悬浮预览窗缩略图宽度模型 | ✅ | `ui-polish-batch6`（归档 2026-11-08） |
| N-5 | PDF 悬浮预览隐藏缩放工具条 | ✅ | `ui-polish-batch6`（归档 2026-11-08） |
| N-6 | 卡片缩略图高度 48（与文字不重叠） | ✅ | `ui-polish-batch6`（归档 2026-11-08） |
| N-7 | 视频默认档连播下一个视频 + 竖拍适配 | ✅ | change `ui-polish-batch15`（归档 2026-11-12，PR #683） |
| N-8 | PDF 按钮栏固定显示 / 隐藏与快捷键（视图级） | ✅ | change `ui-polish-batch15`（归档 2026-11-12，PR #691） |

### configuration（3）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| CF-1…CF-5 | 配置三层/原子写/快照回滚/校验/热应用 | ✅ | 既有实现（V3 沿用） |
| CF-6 | 阅读设置归属与设置窗自适应 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| CF-7 | 提示信息显示时长可配置（0.1–10 秒 / 1 位小数 / 校验回落 / 快照回滚） | ✅ | change `ui-polish-batch15`（归档 2026-11-12，PR #687） |
| CF-8 | 轮盘开关快捷键与默认形态配置 | ✅ | change `ui-polish-batch15`（归档 2026-11-12，PR #684） |

### layout（12）

> change `layout-portal`（spec issue #170 / 收尾票 #186）：16/16 票已实现并合并（含收尾阶段的 #204–#209），已归档 `openspec/changes/archive/2026-11-05-layout-portal`。逐条证据见 [layout-portal-acceptance.md](./layout-portal-acceptance.md)。

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| L-1 | 门户四块齐全，无「来源」 | ✅ | [e2e/portal.spec.ts](../../e2e/portal.spec.ts) |
| L-2 | 工作区 pane 递归树（N 栏/多页签/全屏/拖拽换位/四向落区/240px/持久化） | ✅ | [e2e/pane-tree.spec.ts](../../e2e/pane-tree.spec.ts)、[e2e/pane-drag.spec.ts](../../e2e/pane-drag.spec.ts) |
| L-3 | 阅读空间三态/双布局/三密度/卡片规格/滑杆下拉「设为默认」 | ✅ | [e2e/reading-rail.spec.ts](../../e2e/reading-rail.spec.ts)、[e2e/rail-cards.spec.ts](../../e2e/rail-cards.spec.ts) |
| L-4 | 网格下拉/bento 三型/缩略图优先/首卡选中/键盘行切换/动态编号 | ✅ | [e2e/grid-overview.spec.ts](../../e2e/grid-overview.spec.ts)、[e2e/grid-keyboard.spec.ts](../../e2e/grid-keyboard.spec.ts) |
| L-5 | 悬浮预览窗真内容/四边四角缩放/贴栏锚定/拖动保持/hover 动作区/双开关独立 | ✅ | [e2e/floating-preview.spec.ts](../../e2e/floating-preview.spec.ts) |
| L-6 | AI 唯一入口/小窗 285×260/停靠脱离/人话确认卡/撤销+快照/视图改写 | ✅ | [e2e/ai-forms.spec.ts](../../e2e/ai-forms.spec.ts) |
| L-7 | 设置左导航 10 区/跟随系统外观 | ✅ | [e2e/settings-scene.spec.ts](../../e2e/settings-scene.spec.ts)、[e2e/settings-content.spec.ts](../../e2e/settings-content.spec.ts) |
| L-8 | 扩展拖入即用/导出/AI 生成 | ✅ | [e2e/extensions-manage.spec.ts](../../e2e/extensions-manage.spec.ts) |
| L-9 | 图标 universe-icon/标签三级/类型色/无 emoji | ✅ | [e2e/icon-system.spec.ts](../../e2e/icon-system.spec.ts) |
| L-10 | 快捷键完整表可执行/tooltip 显示/`?` 总览 | ✅ | [e2e/shortcuts.spec.ts](../../e2e/shortcuts.spec.ts) |
| L-11 | 哲学 12 红线全过 | ✅ | [layout-portal-acceptance.md](./layout-portal-acceptance.md) §二 |
| L-12 | 生成物离线单文件（contentweave 部分） | ⬜ Out of Scope | 批准设计 §14 第 12 条 + §15；contentweave 单文件生成不属于本 change，显式记录不阻塞 |

### file-management（6）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| C-1 | 打开文件 | ✅ | change `file-format-support` / `pdf-viewer-text-selection` |
| C-2 | 拖拽打开 | 🟡 | V3 沿用 |
| C-3 | 自动保存 | 🟡 | V3 沿用（2s debounce） |
| C-4 | 新建文档 | ✅ | change `shell-editor-batch5`（归档 2026-11-08） |
| C-5 | 全部文件视图 | ⬜ | 依赖 B-3 |
| C-6 | 视频预览播放器（六档倍速 / 上下集 / 截图 / 旋转缩放亮度 / 容器自适应） | ✅ | `video-preview-player`；`ui-polish-batch6`；`shell-media-batch7`（归档 2026-11-08） |

### editing（12）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| E-1 | 源码模式 | 🟡 | V3 沿用 |
| E-2 | GFM L2 编辑 | 🟡 | `src/editors/decorations/` 已实现 |
| E-3 | 保存文件与写入保护 | 🟡 | V3 沿用（原子写入） |
| E-4 | HTML 源码编辑 | ✅ | `@codemirror/lang-html` + `case "html"`；change `html-edit-loop`（归档 2026-11-04） |
| E-6 | 编辑内核与插入入口（块级装饰 / 斜杠菜单 / 智能输入） | ✅ | change `md-kernel-port` |
| E-7 | 编排层交互契约（块手柄 / 菜单栈 / 浮层裁剪 / 共享色板） | ✅ | change `md-orchestration`（归档 2026-11-03） |
| E-8 | 编辑态与预览态同貌（同一张纸 / 同一套排版 / 块级组合规则） | ✅ | change `editor-preview-parity`（归档 2026-11-02） |
| E-9 | 单元格工具条（已整体移除：无合并 / 无背景色） | ✅（移除） | change `editor-block-parity`（归档 2026-11-06；#140 实施移除） |
| E-10 | 编辑器大纲浮层（右上角入口 / 跳转 / 跳过代码块；层级标识仅悬停显示且更浅；拖动插入位置指示条 + 正文顺序同步） | ✅ | change `editor-outline`（归档 2026-11-03）；`shell-editor-batch5`（2026-11-08）；`editor-surface-batch23`（归档 2026-11-18，PR #1097） |
| E-7 修订 | 块菜单贴手柄居中、二级面板、hover 稳定性 | ✅ | change `editor-interaction-fixes`（归档 2026-11-03） |
| E-11 | 块菜单结构与图标体系 | ✅ | change `editor-block-parity`（归档 2026-11-06）；`shell-editor-batch5`（2026-11-08） |
| E-12 | 单元格富文本编辑 | ✅ | change `editor-block-parity`（归档 2026-11-06） |
| E-13 | 全角标点修正 | ✅ | `transactionFilter`（PR #121）；`shell-editor-batch5`（2026-11-08） |
| E-14 | 浮层定位优先级（不遮挡不越界 > 对齐 > 最近） | ✅ | PR #134 + `e2e/shortest-path.spec.ts` |
| E-15 | HTML 编辑闭环（iframe 预览 / 相对资源 / 编辑后可见） | ✅ | change `html-edit-loop`（归档 2026-11-04，PR #159） |
| E-16 | HTML 可视化编辑（点选 / 改字 / 拆块 / 保存零残留） | ✅ | change `html-visual-editing`（PR #168/#169/#188/#189）；ADR 0010；`shell-editor-batch5`（2026-11-08） |
| E-17 | 块手柄召唤区域与滑入菜单 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| E-18 | 正文选区胶囊 | ✅ | change `reading-surface-refine`（归档 2026-11-06） |
| E-19 | HTML 可视化编辑工具条（换标签 / 改样式 / 改属性） | ✅ | change `html-edit-toolbar`（归档 2026-11-07，PR #264） |
| E-20 | HTML 可视化编辑：拖拽移动节点 | ✅ | change `html-visual-move-capture`（归档 2026-11-07，PR #266） |
| E-21 | HTML 可视化编辑：区域截图 | ✅ | change `html-visual-move-capture`（归档 2026-11-07，PR #266） |
| E-22 | HTML 可视化编辑：工具条按节点类型分化 | ✅ | change `html-toolbar-by-node-type`（归档 2026-11-07，PR #269） |
| E-23 | 颜色面板二级保持 | ✅ | `ui-polish-batch6`（归档 2026-11-08） |
| — | 编辑态工具条归属（md 12 键 / html 只在 html 态；编号让位） | ✅ | `ui-polish-batch6`（归档 2026-11-08） |
| E-24 | 图片块编辑（选中态/属性语法/四边四角缩放/无损裁剪/描述行/粘贴） | ✅ | change `image-block-editing`（归档 2026-11-12，PR #680/#681） |
| E-25 | 撤销与重做同时响应 Ctrl 与 Cmd | ✅ | `ui-polish-batch6`（归档 2026-11-08） |
| E-26 | 轮盘召唤与动作搜索（显式入口 / 9 行上限 / 固定快捷键列） | ✅ | change `ui-polish-batch15`（归档 2026-11-12，PR #684/#685） |
| E-27 | 音视频静音与音频收尾（按文件隔离 / 音频即时暂停） | ✅ | change `ui-polish-batch15`（归档 2026-11-12，PR #689/#690） |
| E-28 | 轮盘历史剪切与颜色二级透明项可辨识 | ✅ | change `ui-polish-batch15`（归档 2026-11-12，PR #686） |

### doc-property-panel（10）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| P-1…P-10 | 文档属性面板（三模式只读渲染 / A·B 两态与显隐配置 / 八类类型与智能编辑 / 行操作与选择模式 / 标签彩色胶囊与建议输入 / 字段改名与别称识别 / 新建默认与属性模板 / 外部字段收编 / 写回与数据无损 / A·B 视觉锚点） | ✅ | change `doc-property-and-search-panel`（12/12 票合并，归档 2026-11-17，主规格已同步） |
| P-3 修订 | 日期时间字段改单一面板选择器（月历网格 + 时分步进，组合提交 `YYYY-MM-DDTHH:mm`）；YAML 校验补日期时间 | ✅ | change `editor-surface-batch23`（归档 2026-11-18，PR #1095） |
| P-R1…P-R5 | 属性面板验收修订（布尔值图形与提示分离 / 操作条图标注册表化 / 编辑态隐藏 frontmatter 源码块 / 模板字段类型 UI 与内置可编辑 / 别名映射表 propAliasMap 应用配置） | ✅ | change `doc-property-refine`（6/6 票，PR #1031/#1032/#1033/#1035/#1036；来源票 #1019/#1021/#1022/#1023/#1024） |
| P-D1…P-D5 | 属性面板同批缺陷修复（B 态托管日期只读 / 行尾删除按钮 / 溢出文档页边界 / 新增字段入口 / 拖拽光标） | ✅ | 缺陷批次 PR #1025/#1026/#1027/#1028/#1029（来源票 #1015/#1016/#1017/#1018/#1020） |

### search-replace-float（6）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| S-1…S-5 | 字面搜索/替换浮窗（⌘F 浮窗与默认位置 / 不分大小写子串扫描 / 双行结果与行尾快捷键 / 单事务替换与 diff 预览 / 局部快捷键 scope） | ✅ | change `doc-property-and-search-panel`（12/12 票合并，归档 2026-11-17，主规格已同步） |
| S-1/S-3 修订 | 浮窗壳复用悬浮预览窗视觉范式与 8 向缩放；选中行即显键帽式回车图标（↑↓ 换选/直达，悬停更新 `activeIndex`）；点击定位归属所属窗格；顶栏标题 / 关闭钮位次 / 输入框一键清空；结果区与快捷键字号 +1 档 | ✅ | change `search-float-refine`（PR #1010/#1011 合并，归档 2026-11-17，主规格已同步）；`editor-surface-batch22`（归档 2026-11-18，PR #1087）；`editor-surface-batch23`（归档 2026-11-18，PR #1096） |
| S-6 | 浮窗状态栏快捷键说明与自动显隐；结果行上下文片段预览态行内渲染（命中高亮保留）；状态栏文案去「（局部 · 浮窗内）」 | ✅ | change `search-float-refine`（PR #1013 合并，归档 2026-11-17，主规格已同步）；`editor-surface-batch23`（归档 2026-11-18，PR #1096） |

### docs-governance（7）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| G-1 | 文档体系结构 | ✅ | change `docs-migration-governance` |
| G-2 | 引用与索引有效性门禁 | ✅ | 同上 |
| G-3 | 开发者上下文路由 | ✅ | 同上 |
| DG-2 | 设计系统为视觉数值唯一来源 | ✅ | change `design-system-governance`（归档 2026-11-08）；`docs/design/system/spec.md` |
| DG-3 | append-only 决案台账 | ✅ | 同上；`docs/design/system/decisions.md` |
| DG-4 | 票面视觉锚点 | ✅ | 同上；`AGENTS.md`、`docs/agents/defect-workflow.md`（C9 机检待后续） |
| DG-5 | 视觉偏差缺陷承接 | ✅ | 同上；`docs/agents/defect-workflow.md`、`docs/agents/ui-feedback.md` |

### extensions（3，2026-11-03 新增）

| 编号 | 需求 | 状态 | 证据 |
|---|---|---|---|
| X-1 | 数据文件扩展点（snippets / templates） | ✅ | change `extension-points`（归档 2026-11-03）；`src-tauri/src/extensions.rs`、`src/lib/extensions/` |
| X-2 | 主题 token 覆盖（`theme.toml` 白名单） | ✅ | 同上；`src/lib/extensions/theme-tokens.ts` |
| X-3 | 核心能力开关（幂等 enable/disable） | ✅ | 同上；`src/lib/capabilities.ts`、`src/components/SettingsDialog.tsx` |

---

## 下一步建议（待开发 16 项）

按依赖顺序：**B-3（统一文件面板）是当前最大缺口**——它同时阻塞 D-6、C-5，且是"无侧栏"导航体系的枢纽。建议从 `/opsx-propose` 建立 `unified-file-panel` change 开始，实现后 D-6/C-5 一并归入。

## 未立项需求（🗒 已登记，尚未建 change）

> 这些需求散落在历史/零散文件中，尚未进入 `openspec/` 闭环。**新建需求先登记到这里，再 `/opsx-propose` 立项。**

### 展卷仪式系统（来源：`docs/阅读写作软件「展卷仪式」功能需求清单.md`，P1 差异化）

| 编号 | 需求 | 状态 | 对应阶段 |
|---|---|---|---|
| I-1 | 展卷动画（三档速度、光影配套、避坑约束） | 🗒 | P1 |
| I-2 | 收卷仪式（写作/阅读专属配套） | 🗒 | P1 |
| I-3 | 自动专注联动 | 🗒 | P1 |
| I-4 | 启动开屏前置仪式（底色/动画/封面/音效） | 🗒 | P1 |
| I-5 | 沉浸式听觉氛围模块 | 🗒 | P1 |
| I-6 | 个性化设置开关（全部可独立开关） | 🗒 | P1 |

> 注：`docs/MVP-需求跟踪表.md` 原模块 I（I-1~I-3）与此同源，现已随该表 superseded。

### 安全与缺陷修复（来源：`TODOS.md`，评审遗留，本质是 bug 修复而非新功能）

| 编号 | 需求 | 状态 | 优先级 |
|---|---|---|---|
| S-1 | HTML 预览 iframe 隔离加固（asset 协议 scope 收紧） | 🗒 | P0 |
| S-2 | inbox 日期参数路径穿越校验 | 🗒 | P0 |
| S-3 | 翻译端点 SSRF 防护接线 | 🗒 | P0 |
| S-4 | capability 缺窗口权限（关闭/拖拽/缩放被 ACL 拒绝） | 🗒 | P0 |
| S-5 | archive/delete IPC 参数缺失致静默失效 | 🗒 | P0 |
| S-6 | 批量提交后第 2+ 条无法编辑/归档/删除 | 🗒 | P1 |
| S-7 | media:// 编码双斜杠致视频预览 404 | 🗒 | P1 |
| S-8 | media 协议无 Range 请求整文件读入内存 | 🗒 | P1 |
| S-9 | read_file_base64 / register_media_path 无来源校验 | 🗒 | P1 |
| S-10 | OpenAI 翻译路径不可用 + key 未走 keyring | 🗒 | P1 |
| S-11 | highlight.ts 源码含字面 NUL 字节 | 🗒 | P1 |
| S-12 | 其余 P2/P3 项（死代码/DRY/防抖/性能/文件大小来源） | 🗒 | P2/P3 |

> 建议：S-1~S-5 这类 P0 安全项修复是"修复既有实现"，不需要建独立需求 change，但修复完成后应**登记实现状态**；如需走 OpenSpec 记录，按 `docs-governance` 域的变更流程补 change。

## 遗留散件去向（历史文件，勿当活文档）

| 文件 | 性质 | 状态 | 去向 |
|---|---|---|---|
| `docs/CORE-REQUIREMENTS-clairis.md` | 全量需求旧稿 | ✅ 已 superseded + redirect | → `docs/product/` + `openspec/specs/`，仅历史存根 |
| `docs/MVP-需求跟踪表.md` | 人工跟踪表 | ✅ 已 superseded + redirect | → 本表，仅历史对照 |
| `docs/capture-overlay-SPEC.md` | Capture Overlay v5.5 实施规格 | ⏳ 待处理 | → 应 superseded + redirect 到 `openspec/specs/capture/spec.md`（2026-09-02 起） |
| `docs/阅读写作软件「展卷仪式」功能需求清单.md` | P1 展卷仪式需求稿 | 🗒 待立项 | 需求已登记本节，建 change 后该文件可 superseded |
| `TODOS.md` | 评审遗留缺陷清单 | 🗒 活（缺陷清单） | 缺陷已登记本节；修复后逐项勾销 |

> 历史：本表取代 `docs/MVP-需求跟踪表.md`（已 superseded，仅作历史对照）。