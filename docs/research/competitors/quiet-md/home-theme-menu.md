---
title: "home-theme-menu"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-22
---

# Quiet.md 源码级逆向分析：首页宫格视图 + 主题/菜单系统

> 分析对象：`/Users/mason/ToHighs/quiet-md-main`（MIT 开源，Rust + GPUI 原生应用，约 9 万行）。
> 服务于 Clairis（标月）的两个改进方向：**#14 首页宫格视图**、**#15 主题/菜单视觉**。
> 本文所有结论附 quiet-md 文件路径:行号；视觉规格均为实测源码数值。
> 生成日期：2026-11-24（按 quiet-md 当前 main 分支源码）。

---

## 目录

1. [首页宫格视图](#1-首页宫格视图)
   - 1.1 宫格布局算法（列数/间距/卡片尺寸）
   - 1.2 笔记卡（文档卡）
   - 1.3 文件夹卡：一叠纸的视觉实现
   - 1.4 缩略图（卡片预览）生成管线
   - 1.5 交互：hover / 点击 / 右键 / 拖拽
   - 1.6 进入文件夹的过渡
   - 1.7 自绘滚动条
2. [主题系统](#2-主题系统)
   - 2.1 双层结构：界面主题 vs 文档主题
   - 2.2 色板与 token 组织（craft / 飞书 UD）
   - 2.3 暗色模式：OKLab 亮度镜像（无第二套色板）
   - 2.4 文档主题 = CSS 文件
   - 2.5 排版刻度与阴影规格
3. [菜单系统](#3-菜单系统)
4. [动画基础设施：弹簧系统](#4-动画基础设施弹簧系统)
5. [设置面（settings.rs）](#5-设置面)
6. [Clairis 对应差距与借鉴清单](#6-clairis-对应差距与借鉴清单)

---

## 1. 首页宫格视图

Quiet 的首页（`src/home.rs`，1073 行）本质是**库顶层的文件管理器**：文档卡是"一张白纸"的隐喻，文件夹卡是"一叠纸塞进毛玻璃文件夹"。列表视图与宫格共享同一套数据与菜单，宫格是默认视图。

### 1.1 宫格布局算法（列数 / 间距 / 卡片尺寸）

核心函数 `Workspace::render_home_grid`（`src/home.rs:900-945`），**列数按可用宽度动态计算，不是固定 4 列**：

```rust
// src/home.rs:902-915
let main_w = viewport宽 - sidebar展开时的侧栏宽;
let avail = (main_w - 48.).max(1.);              // 左右各 24px 留白（px(24)，home.rs:921）
let mixed = 本级同时有文件夹和文档;
let gap = if mixed { 24. } else { 16. };          // 混合级间距更大：文件夹卡会溢出格子（阴影/舌片/张口）
let wide_cols = ((avail + gap) / (200. + gap)).floor().max(1);
let n = if wide_cols >= 4 {
    ((avail + gap) / (240. + gap)).floor().max(4)          // 宽屏：目标列宽 240
} else {
    ((avail + gap) / (160. + gap)).floor().clamp(1, 3)     // 窄屏：目标列宽 160，至少 1 列至多 3 列
};
let col_w = (avail - gap * (n - 1) as f32) / n as f32;
let doc_h = col_w * (6. / 5.);                            // 文档卡固定 5:6 宽高比
let card_h = if mixed { doc_h / (1. - TAB) } else { doc_h };  // TAB = 0.06
```

要点：

| 参数 | 值 | 出处 |
|---|---|---|
| 页面左右留白 | 24px（行容器 `px(px(24.))`） | home.rs:921 |
| 纯文档级 gap | 16px | home.rs:908 |
| 混合级（含文件夹）gap | 24px | home.rs:906-908 |
| 目标列宽（宽屏 ≥4 列） | 240px | home.rs:910 |
| 目标列宽（窄屏 ≤3 列） | 160px | home.rs:910 |
| 卡片宽高比 | 5:6（固定） | home.rs:914 |
| 文件夹卡额外高度 | ÷(1−0.06)，舌片占 6% | home.rs:915 + home_folder.rs:15 |
| 虚拟化 | `uniform_list` 按行渲染，行高 = card_h + gap | home.rs:917-930 |
| 底部收尾留白 | 最后一行 16 + 32（GPUI uniform_list padding 双计的历史补偿） | home.rs:931-940 注释 |

**排序**：`HomeSort::{Manual, Visited, Modified, Created, Title}`，默认 Manual（与侧栏顺序一致，`Meta::place`），可选"文件夹优先"开关（home.rs:292-323, 764-768）。全部持久化到 settings.json（home.rs:664-677）。

**列表视图对照**（home.rs:799-898）：行高 56px（home.rs:864）、表头 33px（home.rs:809）、标题列 `flex_grow=3` + min_w 200（home.rs:804 + weight3 home.rs:560）、普通列 min_w 120 / max_w 240（home.rs:805）、行间发丝线 black 4.5%（`list_line()`，ui.rs:96-99）、标题 15/22、列文本 13pt、hover 时行圆角化并隐藏上方发丝线（`row_hover`，ui.rs:102-107）。

### 1.2 笔记卡（文档卡）

`render_home_card`（home.rs:983-1033）——**"一张散放的纸"**：

| 元素 | 实现 | 出处 |
|---|---|---|
| 圆角 | **radius 32 的连续圆角（squircle/超椭圆）**，非普通圆角 | home.rs:989 + ui.rs `squircle_surface`/`squircle_outline`（ui.rs:571-613） |
| 投影 | `shadow_sheet()`：black α0.035，offset (0,8)，blur 22，spread −2，绘制在 inset 盒（left/right 6px，top 10px）内，与文件夹卡底边对齐 | home.rs:1010-1011 + theme.rs `shadow_sheet` |
| 描边 | 0.5px 发丝线，black 14%（`line_sheet`） | home.rs:1021 + theme.rs:529 |
| hover 光环 | 外扩 3px 的 0.5px 描边环（black 7%），opacity 0→1（`group_hover`） | home.rs:1022-1025（RING=3, home.rs:984） |
| 卡面 | `thumb_page`：pad 18px，首行 emoji(14px)+标题(14px bold)，下方真实块渲染 | home.rs:954-981 |
| hover 右上角 | `…` 菜单钮 24px 圆形（bg_overlay），opacity 0→1 | home.rs:1027-1031 |
| 空文档 | 64px blank-doc.svg + "空白文档" 14px | home.rs:955-963 |

拖拽被拿走时，原位留一个**同形状空槽**（squircle 填 fill_hover，无内容），避免底下内容半露（home.rs:993-1000）。

### 1.3 文件夹卡：一叠纸的视觉实现（本工程最精彩的部分）

`src/home_folder.rs`（852 行）。模块注释（home_folder.rs:1-5）说明了核心决策：

> **文件夹是"画出来的"，不是"布局出来的"**。纸张需要倾斜/展开，GPUI 的 flex 元素做不到，于是底板、纸张、毛玻璃前片全部是**两个 canvas 里的 Path**（纸在下、玻璃在上），标签是夹在中间的普通元素。

**结构**（`render_folder_card`，home_folder.rs:227-460）：

```
div(folder-card)
├── back canvas   → back_plate()（带舌片的底板）+ 逐张 Paper::paint()
├── title 元素    → 最前面那张纸的真实内容（thumb_page）或 drawn 标题
├── front canvas  → glass()（毛玻璃前片）
└── label 元素    → 文件夹名 + "N 项" + hover 按钮组
```

**纸张数量与选材**（home_folder.rs:190-220）：
- 常量 `PAPERS = 3`（home_folder.rs:18）——**画 3 张预览纸**。
- 纸张来源：`folder_papers()` 递归取文件夹下**所有层级的文档**（`documents_below`，深度上限 32，home_folder.rs:210-220），按「最近放入的（front）→ 最近打开/修改」排序取前 3。注释解释了为什么递归到底：文件夹常常先装着子文件夹，只看第一层会画出文件夹图标纸，观感差（#123）。
- 纸的三种脸：`Face::Sketch`（画出来的假文字行）/ `Face::Titled`（假行 + 真标题）/ `Face::Content`（真实内容缩略图，只给最前那张）。

**纸张姿态**（`pose_of`，home_folder.rs:388-400）——每张纸是 `{中心x, 中心y, 宽, 高, 旋转角}`：

```rust
let (pw, ph) = (0.80 * w, 0.64 * h);   // 纸 = 卡片的 80% 宽 × 64% 高
// (dx, top, tilt°) @rest | hover 位移 rise | 拖卡悬停时张口 part
[
  (( 0.000, 0.160,  0.0), ( 0.00, -0.070,  0.0), ( 0.00, -0.03,  0.0)),   // 第 1 张（最前）
  (( 0.030, 0.135,  2.5), ( 0.03, -0.055,  2.0), ( 0.01, -0.02,  1.5)),   // 第 2 张
  ((-0.035, 0.115, -3.0), (-0.03, -0.050, -2.5), (-0.01, -0.02, -1.5)),   // 第 3 张
]
// dx/top 是相对卡宽/高的比例；tilt 单位为度
```

即：**3 张纸，最前张正放，后两张分别右倾 +2.5°、左倾 −3°，向右上/左上错位约 3% 卡宽、层高差约 2.5% 卡高**。hover 时三张纸依次上浮（rise 各异），拖卡悬停时再向两侧"分开口"（part）。

**动画参数**（`FolderFx::new`，home_folder.rs:60-71）——全部是欠阻尼弹簧 `Fade::new(初值, k劲度, c阻尼)`：

| 效果 | 参数 (k, c) | 说明 |
|---|---|---|
| `open`（hover 整体） | (260, 21) | 纸张上浮 + 前片后仰 |
| `mouth`（拖卡悬于其上） | (300, 23) | 前片进一步下压、纸分开 |
| `papers[0..3]` 逐张上浮 | (320,21) / (230,18) / (170,15.5) | **后面的纸劲度更低 → 跟随前面的纸，产生"依次浮出"的错落感** |
| `dip`（按下/落纸时前片下沉回弹） | (520, 15) | 强劲快回弹 |

整体位移合成（home_folder.rs:374-385）：
- `lift = −5·open − 2·mouth + 3·dip`（整卡上下浮动 px）
- 前片顶边倾斜：`yl = 0.49h + lean`、`yr = 0.54h + lean`，`lean = 0.03h·open + 0.045h·mouth + 0.05h·dip` —— **前片顶边左右不等高（左高右低 5% 卡高），像被掀起的纸页**。
- 前片顶角外翻：`inset = −(3·open + 7·mouth)`（负值 = 角向观者外翻）。

**毛玻璃前片**（`glass()`，home_folder.rs:245-310）：
- 形状：顶边从左侧高处经一条 cubic bezier 阶梯到右侧低处的路径，圆角 18px。
- 填充：180° 线性渐变 `bg_body.opacity 0.78 → 0.97`（0%→42% 处），**上部乳白能透出后面的纸，名字区近乎不透明**；再叠一层 black 1.2%→3.5% 的微冷色渐变把玻璃和白纸区分开。
- 描边：1px black 7% 整圈发丝线；**顶边再加 1.5px 白色亮边**（α = 0.85 + 0.15·open；暗色模式 0.18）——"前片迎光时更亮"。
- 投影：black α0.06+0.04·lift（暗色 0.35），offset (0, 8+6·lift)，blur 22+10·lift，spread −2。

**底板**（`back_plate`）：舌片宽 = 0.40·w，180° 渐变 black 11%→7%（home_folder.rs:160-200）。

**纸张绘制**（`Paper::paint`，home_folder.rs:130-158）：圆角 10px，投影 black α0.07/暗 0.3 offset(0,3) blur 10；假文字行 = 宽 `full·(0.72+0.28·rand)` 3px 高圆角条，行距 8.5px，20% 概率短行（`full·(0.3+0.3·rand)`），随机种子 = entry id 的 FxHash（**同一张纸每次画出的"假文字"是确定的**）。

**标签区**（home_folder.rs:425-450）：left 16 / right 14 / bottom 14（−lift 跟随浮动），文件夹名 15px semibold + 计数 12px caption；hover 出现两个 28px 圆钮（+ 新建文档、…），`reveal = (open − mouth).clamp(0,1)`——**拖卡悬停时按钮反而藏起来**；+ 图标带 `scale(0.7 + 0.3·reveal)` 缩放出现。

### 1.4 缩略图（卡片预览）生成管线

Quiet 的卡片预览**不是截图，是把文档真块树裁剪后用编辑器同款渲染管线重画一遍**：

**数据层**（`thumb_blocks`，home.rs:170-235）：
- 每卡预算 `budget = 32` 个块（home.rs:562），深度上限 8 层（home.rs:171）。
- 每块文本截断 600 字符（home.rs:180）。
- 表格截 6×6（home.rs:187）、数据表取 9 行×5 列（home.rs:206-212）、公式保留并携带编号映射、图片按缺失尺寸读真实宽高并以 690px 宽度上限重算、Raw 块丢 XML 只留标签。
- 内联对象替换为文本标签（DocLink→标题、File→文件名、Reminder→标签），并保留加粗/链接样式（home.rs:196-215）。
- 子页面列表（SubPageList）用兄弟页面的真实标题填充（`subpages`，home.rs:540-548）。

**渲染层**（`thumb_block_in`，home.rs:245-410）：与编辑器共享 `home_preview_style.rs` 的排版常量，整体乘以缩放系数 **`SCALE = 0.28`**（home_preview_style.rs:9）——即 15pt 正文按 4.2pt 的字号值排版但布局完整。支持：标题/列表（3 级子弹样式：实心圆 5.5px/空心圆/方块 5px）/待办（16px 方框勾选）/引用（4px 竖条）/代码块（高亮 spans + 行号 + 36px 头部）/表格（真实 grid 布局 8px 单元格内距）/callout（22px emoji + 圆角 8）/倒计时（52px 数字格）/画板（GPU canvas 直接画）。

**公式**（`home_text.rs`）：自定义 GPUI Element `PreviewText`——KaTeX 布局按 `FONT_PX·SCALE` 排版，超宽则按 `(width−2pad)/(m.width+tag)` 比例二次缩小（home_text.rs:29-45），逐行把公式 advance 注入字形偏移再折行（`widen`，home_text.rs:53-77）。

**图片解码降采样**：`THUMB = 0.75`（home.rs:240-242）——卡片图片按绘制尺寸的 75% 解码（"卡片小、瞥一眼，柔一点不亏"），`thumb_long()` 按宽高比算长边。

**缓存**（`Home::thumb`，home.rs:523-590）：
- `HashMap<String, (stamp, Thumb, Instant)>`，**上限 128 条，按最近使用 LRU 驱逐**（home.rs:582-589）。
- 失效戳 = FxHash(modified 时间 + feishu 设置 + 表格文件 mtime + 同级子页 id/标题/图标)；有子页列表的页面用更重的 full_stamp。读盘失败（别进程写一半、iCloud 未下载）**不缓存**，卡面留空等下次（home.rs:579-581）。

### 1.5 交互：hover / 点击 / 右键 / 拖拽

| 交互 | 行为 | 出处 |
|---|---|---|
| 卡片点击 | 打开文档（批量管理模式下变勾选） | home.rs:509-516, 1012 |
| 卡片右键 | 光标处弹 `RowMenu`（Anchor::TopLeft） | home.rs:1013-1019 |
| 行/卡 `…` 钮 | 锚定按钮右下角 +2px 弹菜单 | home.rs:592-597 |
| 排序/视图切换 | mouse-down 切状态（防 popover 外压先清态导致点击丢失），菜单锚点用 `track()` canvas 每帧记录 bounds | home.rs:760-774, 113-120 |
| 拖拽阈值 | **按下后移动 ≥5px 才算开始拖**（`track_home_press`） | home_folder.rs:751-759 |
| 拖起 | 文档卡变成 110×123px 的"纸"（MINI_W=110, MINI_H=110·264/236≈123，与文件夹内纸张同比例），弹簧跟随指针 | home_folder.rs:21-24, 700-712 |
| 悬于文件夹 | 纸被吸向"张口"：`x += (fx−x)·0.45`，目标 = 文件夹中心 x、top+0.56h 处；文件夹 mouth 弹簧张开 + dip.v −= 1.6 | home_folder.rs:843-855, 646-656 |
| 落入 | 纸交接到文件夹的 `arrival` 弹簧，从当前位置**滑进玻璃后面第一张纸的位置**，`dip.v += 5.5` 前片下沉，并成为下次的 front 纸 | home_folder.rs:664-686 |
| 落空 | 纸飞回原卡片位置（`returning`），到位后恢复卡片 | home_folder.rs:668-675 |
| 拖拽覆盖层 | `deferred(...).with_priority(5)` 全屏 occlude 层，ClosedHand 光标 | home_folder.rs:858-880 |
| **宫格不重排** | 注释明说 "cards are not reordered by dragging"——拖拽只用于放入文件夹 | home_folder.rs:695-697 |
| 外部文件拖入 | 全页 veil（bg_body 86%）+ 中央玻璃文件夹托盘插画（196×168），呼吸动画周期 1.8s，虚线框 dash [6,5] 宽 2 圆角 88，指针 halo blur 120 spread 70，落点双涟漪（delay 0.18s，ease-out cubic `1−(1−q)³`） | home_folder.rs:560-720 |

### 1.6 进入文件夹的过渡

- 文件夹页 `View::Folder` **复用同一套 `render_home_grid / render_home_list`**（`in_folder: bool` 切换滚动 handle，home.rs:901, 800），页面结构、工具条、排序、视图模式完全一致——"文件夹就是另一层主页"。
- 新开页 `reset_folder_scroll()` 回到顶部（home.rs:658-662）。
- **没有 zoom / push 式转场**：进入是即时的；所有动效预算花在卡片本身（纸张浮动、落入滑入）。这是一个值得注意的取舍——动效服务于"物件的物理感"而非"导航的空间感"。

### 1.7 自绘滚动条（home_scrollbar.rs，121 行）

| 参数 | 值 | 出处 |
|---|---|---|
| 常态宽 | 4px | home_scrollbar.rs:10 |
| hover/拖拽宽 | 6px | home_scrollbar.rs:11 |
| 最小拇指高 | 32px | home_scrollbar.rs:13 |
| 命中区宽 | 12px（比拇指宽） | home_scrollbar.rs:14 |
| 颜色 | 常态 black 22% / hover 32% / 拖拽 40%，圆角 w/2 | home_scrollbar.rs:76-83 |

实现要点：在列表布局**之后**画（canvas 覆层），永不滞后一帧；拖拽期间冻结按下时的 content/thumb 高度，防止新块测量导致拇指跳动（home_scrollbar.rs:26-31）；滚到底用真实 max_offset 而非估算（home_scrollbar.rs:105-107）。

---

## 2. 主题系统

### 2.1 双层结构

Quiet 的"主题"分成两个独立体系，这一点对 Clairis 最有借鉴价值：

| 层 | 文件 | 管什么 |
|---|---|---|
| **界面主题**（app chrome） | `src/theme.rs`（626 行）+ `src/feishu_theme.rs`（294 行） | 侧栏、菜单、卡片、按钮——编译期 Rust 常量函数 |
| **文档主题**（document theme） | `src/themes.rs`（951 行）+ `assets/themes/*.css` | 页面排版：字号/行高/边距/颜色——**运行时解析的 CSS 文件** |

### 2.2 色板与 token 组织

**craft 色阶**（theme.rs:150-230）：语义化命名的中性 ramp + accent ramp，注释明确每个档位的用途：

```
N00 #ffffff（页面） N50 #fbfbfb（代码块底） N100 #f7f7f7（浮层底） N200 #f1f2f3（非激活 chrome）
N300 #eaebeb（发丝线） N350 #dedfe0（选中行） N400 #c9cacb  N500 #9c9fa0（四级文字）
N600 #737477（二级文字） N700 #3f4143（侧栏行） N800 #303335（工具条图标） N900 #1f2225（正文）
N1000 #000000（配 alpha 用）
B500 #3a85f7（accent：caret/主按钮/菜单高亮）B50..B900 完整蓝 ramp
R* 红 / O* 橙（Tailwind v4 ramp 抄来的数值）
```

**token 即函数**：`Theme` 是一个全关联函数的 struct（theme.rs:440-545），每个 token 一行、一个语义名、一个精确值。UI 层只调用 `Theme::text()` / `Theme::fill_hover()`，从不写 hex。关键语义 token：

```rust
fill_hover        = black 4.5%      // 一切 hover 底
fill_hover_strong = black 6%        // 打开的菜单/选中段
fill_pressed      = black 9%
line_border       = black 8%        // 发丝线
line_sheet        = black 14%       // 卡片 0.5px 边
selection         = accent 24%
caret             = accent（2pt 宽）
sidebar_selected  = black 7.2%（实测 #DEDEDF）
```

**editor_theme.rs（70 行）是两个体系的桥**：`tokens!` 宏声明 **60 个颜色 token 名**（editor_theme.rs:44-58），每个 token 的取值链 = 活动文档主题覆盖 → 对应 base（craft/feishu）的编译期默认（editor_theme.rs:32-42）。`base_color(i, feishu)` 用 `&[(fn, fn)]` 表按索引分发。

**feishu UD 色板**（feishu_theme.rs:20-60）：独立一整套（N900 #1f2329、B500 #336df4…），同一批 token 名换一套值——**一个 token 名、两个 base 实现**。

### 2.3 暗色模式：OKLab 亮度镜像（无第二套色板）

theme.rs:11-110。**Quiet 不维护暗色色板**，而是把每个亮色在 OKLab 空间做亮度镜像：

```rust
// theme.rs:88-103
mirror = (1.137 − 0.907·L).clamp(0,1)      // 白 → L 0.23（≈#1c1c1c 页面），黑 → 白
t = smoothstep((chroma − 0.04) / 0.10)     // 鲜艳色判定
L2 = mirror + (L.clamp(0.62, 0.86) − mirror)·t
// 色度 ≥0.14 的鲜艳色（accent、彩色文字）保持自身亮度在 0.62–0.86；浅色跟随镜像
```

配套：
- `mark()`/`on_mark()`（theme.rs:110-150）：文字高亮在暗色下保持亮色底（半透明叠暗页会发浑），其上文字"撤销镜像"恢复近黑，上限 L 0.55。
- `raised()`（theme.rs:190）：暗色下所有浮起表面统一 #2c2c2e。
- 阴影：`shadow()` helper 暗色 α×3 上限 0.6（theme.rs:240-245）。
- 适配结果按颜色位模式缓存在 thread_local HashMap（theme.rs:60-68）。
- 跟随系统：`settings.rs:256-264` `appearance: ""|light|dark`，空 = 读 `window_appearance()`；切换 `themes::touch()` 递增 generation 让编辑器重测行高。

**工程价值**：新增任何亮色 token，暗色"免费"获得且对比度可预期；主题作者也只需给一份亮色 CSS。

### 2.4 文档主题 = CSS 文件（themes.rs，951 行）

每个主题是一份完整样式表：`:root` 放元数据（`--theme-name/-en/-author/-description`）与 `--theme-base: craft|feishu`（决定块级绘制走哪套基础），`.page / h1..h9 / code / pre / blockquote / table / .callout / .task / hr / ::selection / .token.*` 规则设置其余（themes.rs:1-7, docs/THEMES.md）。

- **内置 4 主题**：craft / feishu / notion / obsidian，`include_str!` 编译进二进制（themes.rs:240-245）；用户主题放 `<library>/themes/*.css`，**与内置同名的文件替换内置**（themes.rs:540-560）；live reload 监听 mtime+size（`stamp()` themes.rs:580-590 + settings.rs:322-331 watch 线程）。
- **属性白名单表 `PROPS`**（themes.rs:60-190）：约 90 条 `Prop { sel, prop, key, kind, craft: Def, feishu: Def }`。**每条属性带两套基础默认值**，未设置的属性回退到当前 base 的默认（`Def::Tok(token名)` / `Def::N(数值)` / `Def::Unused`）。这就是"CSS 主题能覆盖什么"的完整契约。
- **自写 CSS 解析器**（themes.rs:400-470）：去注释、提取规则（跳过 @rules 与嵌套）、`var(--x, fallback)` 递归替换（深度 8）、**同义选择器归一**（`canon_sel`：body/.markdown/.editor→.page，b→strong，p code→code，.todo→.task，td→table 等，themes.rs:205-225）、border 简写拆解、`padding: 16px 16px 16px 12px` 展开、`px/pt/rem/em/%/单位数` 长度解析（em 相对元素自身字号，行高单位数相对 em，themes.rs:640-660）。
- 解析结果 `Style { feishu, tokens[60], values, palette }`；**未识别的规则进 warnings（显示但不报错），只有未知 `--theme-base` 才失败**（themes.rs:580）。
- **双重防漂移测试**（themes.rs:846-905）：① 内置主题必须覆盖 PROPS 里所有非 Unused 属性且无 warning；② craft.css/feishu.css 与 `base_css()` 生成的代码值**逐行比对**——"CSS 文件就是代码值誊写出来的"，保证"未改动的内置主题渲染结果与代码完全一致（无舍入差）"（`theme_of`，themes.rs:495-503）。
- `generation()` 原子计数（themes.rs:360-370）：任何影响绘制的主题变化 +1，编辑器据此重测量所有行。
- 文档字体（`doc_font`，themes.rs:335-370）：用户选的文档字体覆盖所有 prose 的 `font-family`，**代码块除外**（`pre.font` 保持主题的——"读得顺散文的字体很少也适合代码"）。

### 2.5 排版刻度与阴影规格

**排版**（theme.rs:600-645 craft base；feishu_theme.rs:215-232）：

| 项 | craft | 飞书 |
|---|---|---|
| 正文 | 15 / 22，段距 13 | 16 / 26，段距 8 |
| 标题 H1 | 21/27, mt48 mb16 | 26/36.4, mt26 mb10 |
| H2 | 19/25, mt36 mb16 | 22/30.8, mt22 mb8 |
| H3 | 18/24, mt28 mb12 | 20/28, mt20 mb8 |
| H4 | 16/25, mt16 mb16 | 18/25.2, mt18 mb8 |
| H5+ | 15/22, mt13 mb13 | 16/26, mt18 mb8 |
| 页标题 | 34 / 55.25 Bold | 同 |
| 字重 | H1-2 Bold(700)，H3+ Semibold(600) | 全部 Medium(500) |
| 页宽 | max-width 820px（themes.rs PROPS page.width） | 820 |

**阴影库**（theme.rs:245-300 craft；feishu_theme.rs:70-90 飞书）——每个 UI 层级一个具名函数，暗色自动加重：

| 名称 | craft（α, y, blur, spread） | 飞书 |
|---|---|---|
| `shadow_menu` | (0.05,1,3) + (0.10,8,24) | (0.1,4,8) |
| `shadow_panel` | (0.05,1,4) + (0.12,12,32) | (0.1,6,24) |
| `shadow_dialog` | (0.06,2,8) + (0.16,24,64) | (0.12,8,24,4) |
| `shadow_s4_down`（…菜单） | (0.05,1,3) + (0.11,10,28) | 三层 (0.04,8,24,8)+(0.04,6,12)+(0.06,4,8,−8) |
| `shadow_sheet`（主页卡） | (0.035,8,22,−2) | — |
| `shadow_button` | (0.05,1,1.5) | — |
| `shadow_note` | (0.035,0,1) + 左向 (0.045,−2,10) | — |

**圆角体系**（散布于 ui.rs / docmenu.rs）：菜单面板 12 / 菜单行 6 / 编辑器内菜单面板 6、行 4（editor_ui.rs:25-26）/ 对话框 16 / 主页卡 32 squircle / 文件夹纸 10 / 按钮 9 / tooltip 7。

---

## 3. 菜单系统

### 3.1 共享外壳（src/ui.rs）

所有菜单/浮层共享一个 `popover()` 外壳（ui.rs:44-52）：

```rust
bg = raised(popover_bg #fafafa)   // 暗色统一 #2c2c2e
border = 1px line_border（black 8%）
rounded = MENU_RADIUS = 12        // ui.rs:277
shadow = shadow_menu()
font = ui_family()，text_color = Theme::text()
```

菜单行常量（ui.rs:277-290）：

| 常量 | 值 |
|---|---|
| `MENU_RADIUS` | 12px（面板） |
| `ROW_RADIUS` | 6px（行） |
| `MENU_ROW_H` | 32px |
| `MENU_PAD_Y` | 6px（面板上下内距） |
| `MENU_INSET` | 5px（行距面板左右） |

`menu_row()`（ui.rs:292-310）：32 高、mx 5 / px 8、图标-文字 gap 8、13pt/20 行高、hover = `fill_hover`（**黑色 4.5% 中性 hover，不用 accent 高亮**——theme.rs 注释说 accent 高亮是旧方案已弃用）。分隔线：mx 13 / my 5 / 1px（docmenu.rs:57-59）。

**白 pill 按钮**（`pill()`，ui.rs:61-69）：r12 + 1px button_border（black 7.5%）+ shadow_button——工具条、视图切换器、头部按钮全部用它，视觉上是"白色小胶囊浮在页面上"。

### 3.2 「…」文档菜单（src/docmenu.rs，429 行）

- 宽度 `MENU_W = 200`，与触发钮间距 `MENU_GAP = 6`（docmenu.rs:14-17）。
- 用 `deferred(anchored().anchor(TopRight)...)` + priority 2 挂载；`on_mouse_down_out` 关闭（docmenu.rs:268-273）。
- **子菜单向左展开**：位置 = 父菜单左缘 −4px、垂直与父项对齐——对齐量用 `item_top(k, dividers) = 1 + PAD + 32·k + 11·dividers` 手工算（docmenu.rs:19-30）， submenu 宽度取上一帧 canvas 记录的实际渲染宽（跟随翻译后的最长文本，docmenu.rs:107-116 + #225）。
- 行结构：16px 图标 + 13pt 标签 +（子菜单 chevron 10px）；有子菜单打开的行保持 hover 底（docmenu.rs:39-48）。
- 页宽子面板是三张 56×66 示意卡（线宽 20/28/38 的迷你文档图，选中 = accent 边 + B100 底，docmenu.rs:370-410）。

### 3.3 编辑器菜单（src/editor/overlays.rs，2035 行 + menus.rs）

- **尺寸**：slash 菜单宽 `SLASH_W = 247`、最大高 `SLASH_MAX_H = 351`、滚动条槽 15（overlays.rs:14-16）；块菜单 `MENU_W = 247`；浮工具条 8 按钮 32px。
- **更紧凑的圆角**：编辑器内面板 `MENU_RADIUS = 6`、行 4（editor_ui.rs:25-26）——**编辑器内的菜单比 chrome 菜单小一号**（贴近内容）。
- 基础组渲染为 **6 列 icon 网格**：24px 格 / r4 / 行距 12 / 网格下 8px，短行补空格保持列对齐（overlays.rs:492-504, GRID_COLS=6 menus.rs:32）。
- 图标按块族着色（8 种语义色，menus.rs:36-45：BLUE #336df4、INDIGO #5b65f5、GREEN #35bd4b…）。
- **菜单数据与行为分离**（menus.rs）：`SLASH_ITEMS`（26 项，含中文/拼音/拼音缩写/英文关键词）、`TURN_ITEMS`（12 个转换目标 + 快捷键 + Markdown 语法提示）、`filter_slash()` 排序（条目前缀 > 组前缀 > 条目包含 > 组包含，稳定序）。
- **键盘导航**（`list_menu_key`，view.rs:773-855）：↑↓ 在列表走一行 / 在网格走一整行（6 格跳）；←→ 在网格内步进（无网格时直接关闭菜单）；Enter 执行；Esc 关闭并传透（CloseAndPass）；hover 移动同步 selected（`on_mouse_move` 改 `selected` + notify）；滚动用 `scroll_to_item` 跟随（子元素计数要把组标题和网格展开算进去，view.rs:786-800）。
- **弹出动画**：**没有**。菜单出现即完整显示（GPUI 无内建过渡，Quiet 也没加）。动效预算全部花在持续状态（卡片纸张、侧栏 drawer）而非出现/消失瞬间。hover 底色变化也是即时切换（无 transition）。

### 3.4 Tooltip（ui.rs:313-460）

深色气泡：bg #2a2c2f（暗色 #3a3b3d）、12pt 白字 / 18px 行高、r7、px 10 / py 6；锚定元素（不是鼠标）+ 带三角箭头（5px，canvas 画路径）；间距 8px；**方位策略**：chrome 下方 / 文档控件上方 / 菜单项右侧，放不下自动翻转并夹回窗口内（tip_x/y clamp 到离边 10px）。

### 3.5 Toast（ui.rs:24-60）

顶部 32px 居中白卡（r12 + panel 阴影 + 16px 状态圆标），**3s 生命周期、最后 0.3s 线性淡出**（每帧 `request_animation_frame`）。

---

## 4. 动画基础设施：弹簧系统（src/sidebar_drag.rs:24-69）

Quiet 全 app 只有一套手写弹簧原语，所有动效共用：

```rust
// 向量弹簧（拖拽位置/尺寸）：刚度 420、阻尼 31，4 子步积分保证 60/120Hz 一致
pub struct Spring<const N: usize = 3> { p, v, target }
step(): v += (420·(target−p) − 31·v)·dt/4;  p += v·dt/4   // ×4 子步
settle: |p−target| < 0.05 && |v| < 0.1

// 标量弹簧（透明度/比例）：参数化 (k, c)，c < 2√k 时欠阻尼 → "pop" 感
pub struct Fade { p, v, to, k, c }
settle: |p−to| < 0.002 && |v| < 0.02

// 常用预设（sidebar_drag.rs:63-69）
SHOW (1, 260, 30)   HOVER_IN (1100, 66)   HOVER_OUT (300, 35)
HOVER_SWITCH (2500, 100)   QUICK (520, 46)   VANISH (900, 60)
```

配套惯例：
- 每帧 `dt` 上限 0.032s（防卡帧跳变），无动画时**不请求帧**（`window.request_animation_frame()` 只在 `moving` 时调用，home_folder.rs:405）——静止零开销。
- 折叠抽屉用**时间化 ease-out cubic** 而非弹簧：时长随可见距离增长 `0.13 + 0.012·行数 clamp(0.15, 0.25)s`，关闭 ×0.8（sidebar_drag.rs:110-130）。
- 全局动效开关：`motion_high()`（外观 › 动画 › 丰富）gate 掉装饰性动画（sidebar_drag.rs:12-14）。

---

## 5. 设置面（src/settings.rs，2282 行）

`Preferences`（settings.rs:88-140）持久化为库内 settings.json。与本文相关的配置面：

| 字段 | 取值 | 效果 |
|---|---|---|
| `theme` | 主题 id | 文档主题选择（空则回退 `feishu` 布尔） |
| `appearance` | "" / light / dark | 空 = 跟随系统（settings.rs:256-264） |
| `motion` | 动画丰富度 | `motion_high()` gate 装饰动画 |
| `ui_font` | small / "" / large | 界面字号 12/13/15（theme.rs:555-560） |
| `ui_family` / `doc_family` | 字体族 | 界面字体 / 文档字体（代码块不受后者影响） |
| `opaque_window` | bool | 关掉毛玻璃窗口材质 |
| `home_list` / `home_sort` / `home_folders_first` | — | 主页视图/排序/文件夹优先（home.rs:664-677） |

主题文件目录：`<library>/themes/*.css`；编辑内置主题 = 写出完整副本到该目录（`editable_file`/`duplicate`/`remove`，themes.rs:600-650）；watch 线程 500ms 轮询 mtime 实现 live reload（settings.rs:322-331）。

---

## 6. Clairis 对应差距与借鉴清单

> Clairis 现状核对范围：`src/components/GridView.tsx`（611 行）、`src/components/Grid/GridTile.tsx`（386 行）、`Grid/GridToolbar.tsx`、`src/components/ContextMenu.tsx`（119 行）、`src/components/SettingsView.tsx`、`src/lib/gridView.ts`、`src/styles/tokens.css` + `editor.css`、`docs/design/system/spec.md`（271 行）。

### 6.1 宫格布局

**(a) Quiet 的做法**：列数按宽度动态算——`((avail+gap)/(240+gap)).floor()`，窄屏切 160px 目标、clamp 1–3 列（home.rs:909-910）；文档卡**固定 5:6 宽高比**；混合级 gap 24 / 纯文档级 16；虚拟化按行渲染；页面左右留白 24px。

**(b) Clairis 现状与差距**：`GridView.tsx:594-601` 写死 `gridTemplateColumns: repeat(4, minmax(0,1fr))` + `gridAutoRows: 168px` + gap 12px——**任何窗宽都是 4 列**，窄窗挤压、宽窗稀疏；tile 三型（1×1 / 2×1 / 2×2，`lib/gridView.ts` GridTileSize）但高度靠 168px auto-row 拼凑，没有 Quiet 那种"卡片形状即隐喻"（纸是 5:6）的确定性；无虚拟化（一次性渲染全部分组）。

**(c) 落地建议**：
1. 把 4 列常量改成容器查询/JS 计算：`n = clamp(floor((w+gap)/目标列宽), 1, 8)`，宽屏目标 240px、窄屏 160px、gap 按内容类型 12→16。纯 CSS 可用 `repeat(auto-fill, minmax(200px, 1fr))` 起步（代价是放弃 dense 拼格子，可二选一）。
2. 文档类 tile 采纳固定宽高比（`aspect-ratio: 5/6` 或维持 4:3 缩略图但卡片整体定比），让"一叠纸"的形状语言成立。
3. 大库（>500 文件）考虑虚拟化——Clairis 已有 `@tanstack` 类依赖可评估；若嫌重，先做分组折叠（Quiet 的分组是 sticky header，GridView.tsx:573-583 已有）。

### 6.2 文件夹实体卡（最大差距）

**(a) Quiet 的做法**：文件夹是一等公民卡片——3 张真实文档纸（递归取深层、按 front/最近排序）+ 底板舌片（0.40w）+ 毛玻璃前片（渐变 0.78→0.97 + 亮边 + 发丝线）+ hover 纸张错落浮出（三张纸弹簧 (320,21)/(230,18)/(170,15.5) 依次跟上）+ 拖入张口 + 落入滑进玻璃；文件夹页与主页共用渲染管线。

**(b) Clairis 现状与差距**：**没有文件夹卡片**。GridTile 的 meta 行只有父路径文本链接（GridTile.tsx:232-240 `data-tile-folder`）；文件夹不可在网格中打开/拖入；导航靠 rail 的分类 chip（App.tsx:483-485 setRailChip）。

**(c) 落地建议**（按投入排序）：
1. **最小版**：新增 FolderTile——div 叠三层，底层两张伪纸（`transform: rotate(±2.5deg) translate(±3%, −2.5%)`，白底 + `--app-border` 边 + 8px 圆角 + `box-shadow: 0 3px 10px rgba(0,0,0,0.07)`），顶层真卡显示"最近 1 个文档的 excerpt + 文件夹名 + N 项"。CSS transform 就能表达倾斜，无需 canvas。
2. **hover 动效**：三层各一个 `transition: transform 200ms cubic-bezier(0.34, 1.3, 0.64, 1)`（欠阻尼感），hover 时 translateY 递增（−4px / −2px / 0）制造依次浮出。若要 Quiet 级的"后面的纸更软"，用 `transition-delay: 0ms/40ms/80ms` 近似。
3. **拖入文件夹**：HTML5 drag + `dragover` 时前片 `translateY(+6px)` + 纸张 `rotate` 张开（对齐 Quiet 的 mouth），drop 后前片 dip 回弹。Clairis 已有 `fileDragHandlers` hook（GridTile.tsx:9）可扩展。
4. 拆票前按 AGENTS.md 走 OpenSpec + 数据面六栏表（文件夹卡是新的可配置面：显示几张纸、是否递归）。

### 6.3 文档卡缩略图

**(a) Quiet 的做法**：预览 = **真块树裁剪重渲染**（budget 32 块、600 字符/块、SCALE 0.28），保留标题层级/列表符号/代码高亮/表格/callout/公式排版；图片按 75% 尺寸解码；LRU 128 条缓存；空文档有专用空态插图。

**(b) Clairis 现状与差距**：ThumbBody（GridTile.tsx:64-140）分支：图片/封面 → `<img>`；视频 → poster 帧；音频 → 固定 7 根波形条（写死 `[8,16,24,14,20,10,18]`）；html/pdf → **假骨架条**（3 根色条）；否则 excerpt 纯文本 8px。**markdown 内容没有任何结构化渲染**——excerpt 是平文本，看不出标题/列表/代码块结构。

**(c) 落地建议**：
1. 中成本高收益：markdown 缩略图从"excerpt 平文本"升级为**结构感知的微缩渲染**——不需要 Quiet 的完整管线，只需把 excerpt 生成器（`lib/railCards`）改为输出带类型标记的行数组（heading/bullet/code/quote…），GridTile 用 3–4 行 CSS 类渲染：标题行加粗大一号、列表行加圆点、代码行灰底等。数据仍来自已有解析。
2. 图片解码：Tauri 后端已有缩略能力的话对齐"按显示尺寸解码"（Quiet 的 THUMB=0.75 思路），避免大图直出。
3. 缓存：`thumbDescriptorOf` 结果如含 IO，加一层 `Map<path, {stamp, descriptor}>`（stamp = mtime），上限 128。

### 6.4 卡片视觉（squircle / hairline / hover 环）

**(a) Quiet 的做法**：主卡 radius 32 **真 squircle**（超椭圆 path，ui.rs:571-613）；0.5px hairline（black 14%）；hover 外扩 3px 的 0.5px 环（black 7%）淡入；投影 `0 8px 22px −2px rgba(0,0,0,0.035)` 画在 inset 盒内与文件夹卡对齐。

**(b) Clairis 现状与差距**：GridTile 用 tailwind `rounded-lg`（8px）+ `hover:-translate-y-0.5 hover:shadow-md`（标准 shadow-md = `0 4px 6px −1px rgb(0 0 0/0.1), 0 2px 4px −2px rgb(0 0 0/0.1)`）；选中 = `outline: 2px solid accent` 内缩（GridTile.tsx:152-156）。视觉是"网页卡片"，不是"纸上之物"。

**(c) 落地建议**：
1. hover 反馈从"上浮 + 阴影加重"改为 Quiet 的**描边环淡入**：`box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-text) 7%, transparent)` 外扩环 + 原有 hairline 保持——更"轻"，符合 Quiet"hover darkens the hairline"的克制哲学。上浮 −0.5 可保留。
2. 选中态从实心 outline 改为 accent 色 0.5px 内描边 + 光环（对齐 spec §6 accent 语义）。
3. squircle 可用 CSS `corner-shape: squircle`（Chromium 139+ 已支持；Tauri WebView2/WebKit 跟进情况需验证）或 SVG mask；不追急件，先记入 decisions.md。

### 6.5 主题系统

**(a) Quiet 的做法**：① 界面/文档主题双层；② token = 语义函数 + 60 个具名色 token，UI 层零 hex；③ 暗色 = OKLab 亮度镜像，一份亮色两用；④ 文档主题 = 用户可写、可 live reload、可复制的 CSS 文件，属性白名单 ~90 条，带"CSS 与代码逐行一致"的防漂移测试；⑤ 阴影按层级命名成库。

**(b) Clairis 现状与差距**：tokens.css 三主题（:root/.dark/.warm）静态变量——**每加一个语义色要手写三份**（spec §6 已登记 accent-soft alpha 不一致等缺口）；无用户主题机制；阴影 20 处 box-shadow、10 处字面量待收敛（spec §5 自认）；圆角刻度 4/8/full 但 `--app-radius: 6px` 与实际使用矛盾（spec §5）；无文档级排版主题（正文字号由阅读设置控制，spec §4）。

**(c) 落地建议**：
1. **优先收敛阴影**（spec §5 已有计划）：学 Quiet 建立 5 档具名阴影 token——`--shadow-menu / --shadow-panel / --shadow-dialog / --shadow-card / --shadow-button`，每档亮暗两值（暗色不是 ×3 就够，Quiet 是 ×3 cap 0.6，可先照抄）。暗主题值不用逐个设计：把亮值过一遍"暗色加重"规则（α×3 上限 0.6）即可起步。
2. **暗色 token 镜像**：新增 token 时先只定亮值，暗值用 OKLab 镜像公式算出再微调（公式见本文 §2.3，`mirror = 1.137−0.907·L`，chroma≥0.14 保持 L 0.62–0.86）。可用一个小脚本从 tokens.css 生成 .dark 草稿，人只做校对——把"设计三主题"降为"设计一主题 + 校对两份"。
3. **用户主题 CSS**（远期）：Clairis 是 web 技术栈，天然适合 CSS 变量主题文件。最小版：`themes/<name>.css` 覆盖 `--app-*` 变量子集（约 spec §6 的 11 个语义色 + 阅读排版变量），`SettingsView` 加选择器 + 文件监听。属性白名单直接抄 Quiet 的 PROPS 表思路（只开放列出的变量）。
4. 防漂移测试：写一个 vitest 快照测试，断言 tokens.css 三主题变量集合一致（同一变量三处都有值），堵住 spec §6 已知的"缺 token 回退"类缺口。

### 6.6 菜单系统

**(a) Quiet 的做法**：面板 r12 / 行 r6 / 行高 32 / 面板内距 6 / 行左右 inset 5；hover = 黑 4.5% 中性底（非 accent）；编辑器内菜单更紧凑（r6/r4）；分隔线 mx13 my5；子菜单左开 −4px 对齐父项；tooltip 深色 #2a2c2f r7 带箭头自动翻转；键盘导航网格按行跳；菜单出现无动画。

**(b) Clairis 现状与差距**：ContextMenu.tsx 宽 180 / 行高 30（vs 32）/ 容器 r10 padding 4px（editor.css:3438-3446，接近 Quiet 的 inset 语义但行无圆角定义需查 `.context-menu-item`）；阴影 `0 8px 24px rgb(0 0 0/0.18)` 是 spec §5 登记的字面量之一；**无子菜单**；键盘只有 ↑↓/Tab/Esc（无 ←→、无 hover-selected 同步）；hover 高亮色需核对（`.context-menu-item:hover` editor.css:3459）；**菜单项无图标分组、无分隔线概念**（items 平铺）。

**(c) 落地建议**：
1. 行高 30→32、行加 6px 圆角、容器 padding 4px 保持、阴影换 `--shadow-menu` token（收敛 spec §5 的同时统一观感）。数值改动极小、观感提升明显。
2. ContextMenuItem 加 `divider?: boolean` 与 `shortcut?: string`（右侧 12px 灰字快捷键提示——Quiet 的菜单普遍带快捷键列，Clairis 的 ShortcutOverlay 有数据可接）。
3. 键盘导航补 hover 同步：ArrowDown/Up 移动时给目标项加 `.hovered` 类（或 focus 即 hover 样式）——Quiet 的"hover 与 selected 是同一个东西"让鼠标/键盘无缝混用。
4. 菜单**不加弹出动画**——Quiet 的实证选择：出现即显示，动效花在持续状态。Clairis 现有 `overlayIn 0.22s`（editor.css:1710）用于编辑器浮层可保留，但右键菜单建议即时出现（Native 菜单惯例）。

### 6.7 动效体系

**(a) Quiet 的做法**：一套弹簧原语（Spring 420/31、Fade 参数化）+ 每 token 一个具名参数组合 + `motion_high` 全局开关 + 静止零帧请求。

**(b) Clairis 现状与差距**：散落 CSS transition（0.12–0.3s ease）+ 两个 keyframes（overlayIn/capsuleIn，cubic-bezier(0.2,0.8,0.2,1)）；spec §8 明确"不做动效规范"（当前裁定）；无全局动效开关。

**(c) 落地建议**：
1. 尊重 spec §8 现状，不建"动效规范"——但可以在 decisions.md 记两条单点裁决：① hover/按压反馈统一时长档（120ms ease-out）与回弹档（200ms cubic-bezier(0.34,1.3,0.64,1)）；② 新动画一律走 `prefers-reduced-motion` + 设置开关 gate（Quiet 的 motion_high 语义）。
2. 若做 §6.2 的文件夹卡动效，弹簧参数直接抄：上浮 (320,21)、跟随 (230,18)/(170,15.5) 折算为 transition-delay 阶梯；按下 dip 用 `transform: translateY(3px)` + 200ms 回弹。

### 6.8 设置面

**(a) Quiet 的做法**：偏好极简（~18 个字段），全部语义化存 settings.json；视图/排序等"每页状态"也持久化；主题文件可编辑可复制可 live reload。

**(b) Clairis 现状与差距**：SettingsView.tsx 3024 行（远大于 Quiet 的设置页），config 存 Tauri 侧；主页网格的尺寸/分组/排序状态是否持久化需核对 `stores/index.ts`（gridView.ts 是纯逻辑层，排序/分组枚举已齐）。

**(c) 落地建议**：把 GridView 的 sort/group/filter 选择持久化到现有 config（对齐 Quiet `save_home` 的做法——视图状态是跨会话偏好，不是临时状态）。

### 6.9 借鉴优先级总表

| # | 项 | 成本 | 收益 | 建议批次 |
|---|---|---|---|---|
| 1 | 菜单规格对齐（32 行高/r6 行/阴影 token/快捷键列） | 低 | 中 | 近期，顺手票 |
| 2 | 卡片 hover 环替代上浮阴影 | 低 | 中 | 近期 |
| 3 | 宫格列数响应式 + 固定宽高比 | 低 | 中 | 近期 |
| 4 | 阴影 token 5 档收敛（spec §5 既定方向） | 中 | 高 | 已有计划的 token 扩容 change |
| 5 | FolderTile（静态三层纸）+ hover 浮出 + 拖入 | 中高 | 高 | 独立 change（走 OpenSpec + 数据面） |
| 6 | markdown 结构感知缩略图 | 中 | 中高 | 独立 change |
| 7 | 暗色 token OKLab 镜像生成脚本 | 低 | 中 | token 扩容 change 顺手 |
| 8 | 用户 CSS 主题 + live reload | 高 | 中（对目标用户） | 远期，先出设计探索 |
| 9 | 键盘导航 hover 同步 + ←→ 网格步进 | 低 | 低中 | 近期顺手 |

---

## 附：本文引用的 quiet-md 文件清单

| 文件 | 行数 | 角色 |
|---|---|---|
| src/home.rs | 1073 | 首页布局/卡片/列表/排序/缩略缓存 |
| src/home_folder.rs | 852 | 文件夹卡绘制/弹簧/拖拽/外部文件拖入 |
| src/home_preview_style.rs | 87 | 缩略图排版常量（SCALE 0.28 等） |
| src/home_text.rs | 156 | 惰性公式预览（KaTeX 缩放） |
| src/home_scrollbar.rs | 121 | 自绘滚动条 |
| src/theme.rs | 626 | 界面 token/craft 色板/暗色镜像/阴影/排版 |
| src/editor_theme.rs | 70 | 60 个文档色 token 桥 |
| src/themes.rs | 951 | CSS 主题解析/加载/live reload |
| src/feishu_theme.rs | 294 | 飞书 base 色板/排版/阴影 |
| src/ui.rs | 919 | 菜单外壳/tooltip/toast/squircle |
| src/docmenu.rs | 429 | 「…」菜单与子菜单定位 |
| src/editor/menus.rs | 396 | slash/转换菜单数据 |
| src/editor/overlays.rs | 2035 | slash/块菜单/工具条渲染 |
| src/editor/view.rs | 2935 | 菜单键盘导航（list_menu_key） |
| src/sidebar_drag.rs | 878 | Spring/Fade 弹簧原语与预设 |
| src/settings.rs | 2282 | 偏好/外观/主题监听 |
