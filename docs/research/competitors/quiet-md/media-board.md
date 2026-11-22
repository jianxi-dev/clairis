---
title: "media-board"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-11-22
---

# Quiet.md 源码级逆向分析：富媒体与画板

> 分析对象：`/Users/mason/ToHighs/quiet-md-main`（MIT，Rust + GPUI，约 9 万行，其中画板约 2.6 万行）。
> 架构总览见 `docs/ARCHITECTURE.md`：core crate（`crates/core`，`fdl_core`）管文档模型/DocxXML/编辑引擎；根 crate（`src/`）管视图与渲染。文档 = `model.rs` 里的块树 + 磁盘上的 DocxXML。
> 本报告覆盖四个域：高亮（§1）、嵌入文件（§2）、图片与裁剪（§3）、嵌套画板（§4），最后给「Clairis 对应差距与借鉴清单」（§5）。
> 所有结论附 quiet-md 文件路径:行号（行号为当前源码位置）。

---

## 1. 高亮（文字背景色 mark）

### 1.1 数据模型：高亮只是 Marks 的一个字段，不是一个独立实体

Quiet 的富文本模型里没有「highlight 注解」这类独立对象——高亮就是 run 样式之一：

- `crates/core/src/model.rs:40-50`：`Marks { bold, italic, underline, strike, code, link: Option<String>, text_color: Option<ColorName>, bg_color: Option<ColorName>, inline: Option<Inline> }`。高亮 = `bg_color`，文字颜色 = `text_color`，都是调色板色名（`ColorName(pub String)`，model.rs:35-37）。
- `RichText` 是 `text + Vec<Run { len, marks }>`（model.rs:205, 243），按 run 粒度存样式。run 切分由 `push`（model.rs:256）、`update_marks(range, f)`（model.rs:349）维护。
- 打字继承规则：`typing_marks`（model.rs:380-383）——新打出的字继承光标前的 bg_color（链接/代码/行内对象不继承）。

### 1.2 调色板：固定 7 色 × 2 行 16 档

- `crates/core/src/palette.rs:35-53`：`BG_COLORS: [Option<&str>; 16]`——两行 8 档。第 1 行 `None`（恢复默认）+ `light-{gray,red,orange,yellow,green,blue,purple}`；第 2 行 `medium-gray / gray / {gray,red,orange,yellow,green,blue,purple}`（7 色）。即「淡色行 + 标准行」的飞书式双档设计，共 14 种颜色 + 默认/无。
- 色值定义在 `palette.rs:79-102`：`bg_color(name) -> Option<Rgba>`。关键细节：**light 档很多带 alpha**（如 `light-blue => rgba(186,206,253,0.7)`、`light-yellow => rgba(255,246,122,0.8)`），medium 档是实色（如 `red => 0xf76964`）。旧版本写的 `medium-red` 读取时归一为 `red`（palette.rs:80-81 注释）。
- 面板显示名归一：`bg_canon`（palette.rs:104-108）把 `medium-{hue}` 换成 `{hue}`，所以第 2 行的按钮选中态判断用 canon 名。
- 命名来源注释（palette.rs:2-4）：这些是 DocxXML 的 `text-color`/`background-color` 属性值，对齐飞书 `--ccmtoken-doc-highlightcolor-*` token——Quiet 是「以飞书文档的颜色体系为基准」实现的高亮。

### 1.3 颜色怎么选：浮层工具条的「A▾」分体按钮 + 双面板

- 入口一：**选中文字 → 浮动工具条上的 A 按钮**（overlays.rs:1529-1590 `color_split`）。它是一个 24px 宽的「A」+ 20px 宽的「▾」分体按钮：
  - 左半（A）**单击直接套用上次颜色** `last_color`（默认文字色 None + 高亮黄，即默认一键 = 黄色高亮，overlays.rs:1533 `let (lt, lb) = self.last_color.clone()`，注释明确写 "The A applies the last used colors at once (by default the yellow highlight)"，view.rs 在 `apply_color` 时把用过的颜色记进 `last_color`，view.rs:1147-1151）。
  - 右半（▾）hover 或点击展开颜色面板。A 字样的小方块背景实时渲染上次的高亮色（overlays.rs:1553-1558），未设置时是裸 A。
- 入口二：**块手柄菜单 → 颜色** 子面板（overlays.rs:836-842 `Some(BlockSub::Color)`，位于主菜单右侧 offset `MENU_W + 4`）。
- 面板本体 `color_panel`（overlays.rs:886-960）：230×202，上排「字体颜色」8 个 swatch（`FONT_COLORS`，palette.rs:26-34），下排「背景颜色」16 个 swatch 换行排列（gap_y 4）。swatch 尺寸逻辑：第一格 `None` 画成 `none_swatch()`（带斜杠的空格），点击已是当前色 = **取消**（toggle 语义，overlays.rs:899-902 `let toggled = if sel && value.is_some() { None } else { value }`）。底部「恢复默认」按钮一次清掉文字色+背景色（overlays.rs:945-963）。
- 应用逻辑 `Editor::apply_color`（src/editor/view.rs:1143-1170）：`core.apply_marks(f)`（文字选区）或 `apply_marks_to_blocks`（块选中/表格单元格选中时整块套，view.rs:1161-1163 `whole_blocks()`）。`Markdown 文件编辑态禁用`（view.rs:1144 `if self.markdown { return; }`）。
- 当前色回显：`current_colors()`（view.rs:1199-1214）取选区起点的 run 样式，驱动面板 swatch 选中态。

### 1.4 渲染：整行高的矩形条，无圆角，深色模式有专门色彩变换

- run 构建：`src/editor/text.rs:816`——`background_color = m.bg_color → theme::bg_color(name)`；阅读态变暗用 `dim_marks` 时乘 `opacity(0.7)`。有背景时文字颜色走 `crate::theme::on_mark(color)`（text.rs:822）保证对比度。
- 绘制：GPUI 的 `TextRun.background_color` 交由 vendored 的 `paint_line_background`（`vendor/zed/crates/gpui/src/text_system/line.rs:886-1020`）画——**逐 run 合并连续同色段，`window.paint_quad(fill(...))` 画矩形**，高度 = 整个 `line_height`（line.rs:933-939, 995-1001），跨行折行时在新行重新起矩形（line.rs:926-957）。**没有任何圆角**（paint_quad 不带 corner radii）；相邻不同色高亮之间由"当前背景段"逻辑精确分界（line.rs:961-996）。入口是 `text.rs:1147` 的 `line.paint_background_rows(...)`（先画背景再画字）。
- **深色模式的关键处理**（src/theme.rs:96-113）：
  - `mark(c)`：dark 下把半透明的 light 高亮色「合成到白底后变实色」——`w(v) = v*a + 1 - a`，避免半透明色叠在暗页上发闷。
  - `on_mark(c)`（theme.rs:105-113）：dark 下把落在高亮上的文字色"还原成亮页的墨色"，OKLab 空间把 lightness 映到 `((1.137 - l) / 0.907).clamp(0., 0.55)`，彩字在彩底上仍可读。带 in-gamut 二分（theme.rs:115-125）。
- 搜索命中/选中文字的高亮（`highlight` 参数，text.rs:786-791）与用户 mark 是两套：前者覆盖 run 颜色，后者是持久 mark。

### 1.5 存储：DocxXML 的 span 属性；Markdown 导出**丢弃**颜色

- DocxXML 内联序列化：`crates/core/src/docxml.rs:1061-1067`——`if m.text_color.is_some() || m.bg_color.is_some() { open.push_str("<span") ... background-color="{}" }`。即高亮在磁盘上是 `<span background-color="light-yellow">…</span>`。
- 读取：`docxml.rs:683-684`——`m.bg_color = Some(ColorName(attr))`。往返测试样例见 docxml.rs:1150。
- **Markdown 导出不保留高亮**：`crates/core/src/markdown.rs:762-771` 的 `Md` 结构只有 bold/italic/strike/underline/code/link/math，没有颜色字段；`inline()`（markdown.rs:773-）注释明说 "Merge runs that only differ in marks Markdown can't express (colors)"——只差颜色的相邻 run 直接合并，高亮信息在导出/「编辑为 Markdown 文件」时消失（light 行的 alpha 色也没有对应的 MD 语法可承载）。
- 交互补充：没有独立的高亮快捷键（shortcuts.rs 中无 Highlight 绑定）；菜单里「高亮块」（menus.rs:129）是另一回事 = Callout 块，别混淆。

### 1.6 小结（Quiet 高亮的设计选择）

| 维度 | 做法 |
|---|---|
| 交互 | 选中→浮动工具条 A 一键（记忆上次色，默认黄）▾ 展开面板；块手柄菜单也有 |
| 色档 | 7 色相 × light/medium 双档 + 无/默认，共 16 格面板 |
| 视觉 | 整行高矩形、无圆角、light 档带 alpha；dark 模式专门 mark/on_mark 变换 |
| 存储 | DocxXML `<span background-color="名">`，色名字符串持久化 |
| MD 导出 | 丢弃（无可承载语法） |

---

## 2. 嵌入文件（file block）

### 2.1 数据结构与存储

- `crates/core/src/model.rs:837-851`：
  ```rust
  pub struct FileBlock { pub src_kind: String /* "path" | "token" */, pub src: String, pub name: String, pub view: FileView }
  pub enum FileView { Card, Preview }
  ```
- 两种形态：`BlockKind::File(FileBlock)` 整块附件卡（model.rs:761），以及段落内的行内 `<source>` 卡（`InlineKind::File`，model.rs:72-74）。
- **存储**：附件复制进库的 `assets/files/<uuid>/<name>`（src/editor/file.rs:283-299 `file_block_from_path`），`src` 存库内相对/绝对路径字符串，`src_kind="path"`；云 token 为 `"token"`。`local_path(f)`（file.rs:157-160）由 `image_path(&f.src)`（crates/core/src/store.rs）解析回本机路径。
- 新附件默认视图按类型+大小自动选：音频/视频 <100MB / Office·PDF <10MB → `Preview`，否则 `Card`（file.rs:288-294，阈值 `DOC_PREVIEW_MAX = 10 << 20`、`VIDEO_PREVIEW_MAX = 100 << 20`，file.rs:27-28）。
- Markdown 导出（`crates/core/src/markdown.rs:805` 附近 `inline()`）：`InlineKind::File` 输出文件名文本并经 `files` 回调把库内路径改写成相对路径；块级 File 同理，image/attachment 共用 `assets_dir` 搬运逻辑（markdown.rs:194-272）。

### 2.2 类型识别与图标

- `Kind` 枚举 11 类（file.rs:32-45）+ `kind_of` 按扩展名表分类（file.rs:51-68，覆盖 doc/xls/ppt/视频 16 种/音频 21 种/压缩/文本/代码 25 种）。
- 图标是**三层 SVG 叠画**：彩色纸页 + 白色折角 + 类型 glyph（file.rs:118-131 `type_icon`）；每类一个色（file.rs:87-99 `kind_color`：PDF 红、Word/Code 蓝 `0x2b7fff`、Excel 绿 `0x00bc7d`、PPT 橙、Video 紫、Audio 青、Zip 橙、文本/未知灰）。

### 2.3 显示格式（两种视图）

**Card 卡片视图**（file.rs:521-611 默认分支）：
- 400px 宽（min 200，max 全宽）、圆角 5、1px hairline、按钮投影；左侧 48px 类型图标 + 中间两行文件名（15px、`line-clamp(2)`）+ 12px 大小行（`format_size`，file.rs:137-148：`512 B / 1.50KB / 12.30MB`，文件不存在时红色「文件不存在」）+ 右侧 34px 预览/播放按钮（file.rs:545-556）。选中态 accent 描边（file.rs:335-344 border 逻辑），手柄菜单打开时外圈 ring（file.rs:345-347）。

**Preview 预览视图**（file.rs:421-519）：
- PDF/Word/Excel/PPT：macOS `qlmanage -t -s 1200` 生成 Quick Look 缩略图，缓存到 `assets/thumbs/<hash>`（hash = path+size+mtime，file.rs:241-253），后台队列生成（`start_thumbs` file.rs:731）。缩略图高度 clamp 120–600px，底部 42px footer（小图标+文件名）。
- 视频：内嵌 `<视频帧>`（Contain）+ 56px 半透明圆形播放键（file.rs:452-478）。
- 音频：**自制播放器**（file.rs:349-419）——标题行 + AVAudioPlayer 播放/暂停/进度条（点击 seek，`seek_audio` file.rs:686）/静音，播放时间 `mm:ss`。Player 用 objc 直接调 AVFoundation（file.rs:978-1057）。

### 2.4 交互行为

- **点击打开**：选中态（或阅读态）单击卡片 → `open_file`（file.rs:301-307 open_listener、634-640）→ macOS Quick Look `qlmanage -p`（file.rs:270-281 `quick_look`，独立线程）。视频的播放键直接内嵌播放。
- **下载/另存**：`download_file`（file.rs:642）。
- **拖放创建**：外部文件拖进编辑器 → `drop_files`（src/editor/image.rs:2100-2148）显示落点线（`file_drop_line` image.rs:2093、`file_drag_move` image.rs:2084 记录 `(BlockId, DropPlace)`）→ `import_files`（file.rs:930-976）：后台线程复制入库 → `insert_blocks_at`/`insert_blocks` 插入，光标落到最后一块后的新段落。
- **菜单选择插入**：`pick_files`（file.rs:914-928）系统文件选择器，同走 `import_files`。
- 附件工具条（选中卡时）：file.rs:751-851 `file_toolbar`，含 Card/Preview 视图切换等。
- 图片也复用这条 drop 管线（image.rs:2100 分流：图片扩展名 → Image 块，其余 → File 块）。

---

## 3. 图片与裁剪

### 3.1 块模型

- `BlockKind::Image`（crates/core/src/model.rs:739-753）：
  ```rust
  { src_kind, src, width: Option<f32>, height: Option<f32>, caption: Option<String>, crop: Option<[f32; 4]> }
  ```
  - `width/height` 是**可见（裁剪后）部分的显示 px**；`crop` 是 `[left, top, right, bottom]` **分数**（0..1，相对整图），不是像素。注释（model.rs:751-752）明说 "Visible part as [left, top, right, bottom] fractions of the full image (the `image.crop` attribute)"。
- 约束函数 `valid_crop`（src/editor/image.rs:664-668）：全部 ∈ 0..=1、`l < r`、`t < b`、且 ≠ 整图 `[0,0,1,1]`，否则视为未裁剪。
- DocxXML：读取 `crop` 属性 `parse_crop`（docxml.rs:280, 987-993），写出 `crop="l,t,r,b"`（docxml.rs:920-934，4 位小数）。Markdown 导出不带 crop（markdown.rs 图片分支只写 `![caption](src)`，markdown.rs:396）。

### 3.2 插入路径

- 粘贴/拖放/选择文件统一走 image.rs 的 drop 管线（image.rs:2100-2148 `drop_files`）与 `adopt_pasted`（image.rs:2185）。约束：格式 `jpeg,jpg,png,gif,webp,bmp`（image.rs:31）、单文件 ≤20MB（image.rs:32，超限 toast「上传图片大小不能超过 20 MB」）。
- 下载远程图：`adopt_remote`（image.rs:2202）把网络图落到库 assets（`remote_dir`，image.rs:599-601）。

### 3.3 渲染时怎么应用裁剪（关键设计）

- 几何计算 `geometry()`（image.rs:670-687）：由 `(width, height, crop, natural, container)` 算出 `Geo { w, h }`（可见部分显示尺寸）、`fw, fh`（**同缩放下整图尺寸** = `dw / frw`）、`crop`。显示尺寸缺省时按 natural × crop 分数推；clamp 到容器宽，最小 32px（image.rs:28 `MIN`）。
- **应用方式（未在裁剪模式时）**（image.rs:789-808）：容器 `overflow_hidden` 尺寸 = `g.w × g.h`（裁剪后），里面放**整尺寸的图**：`picture(&p, iw.max(ih))` 绝对定位 `left(-crop[0]*fw) top(-crop[1]*fh)`、宽高 `fw × fh`——即「外盒裁剪 + 内图平移」，内图始终保持与外盒同一缩放，所以裁剪只是移动窗口，不改变缩放。圆角：裁剪态/已裁剪图圆角为 0，正常图 5px（image.rs:786-787）。
- 图片缓存：全局 `DocImages` 共享缓存（image.rs:150-180, 421-509），64MiB 屏外 LRU + 30s 过期 + 2 并发解码（ARCHITECTURE.md「Memory and caches」）。

### 3.4 裁剪功能完整实现（编辑态交互)

**进入**：选中图片 → 浮动工具条「裁剪」按钮（image.rs:1360-1510 `image_toolbar`，裁剪/保存裁剪二态 toggle）→ `start_crop`（image.rs:1184-1196）：若在裁另一张先自动 `save_crop`；图显示尺寸 < 32px 拒绝（按钮变灰、tip「图片过小，请放大后重试」，image.rs:1394-1403）。

**裁剪态 UI**（`crop_overlay`，image.rs:945-1041，即 `.image-cropper`，对齐 crop-spec §2）：
- **四块暗罩**（rgba(0,0,0,0.3)）盖住选区外（image.rs:974-979, 1031-1036）——这是「看得到在裁哪」的核心。
- 选区：1px 白色虚线框（`border_dashed` rgba(255,255,255,0.8)，image.rs:1013-1015）+ **括号把手**：四角+四边的 6px 短横条，白条内芯 + 深色 #2b2f36 外描边、位于框外 1px（image.rs:985-1006），选区宽 >52px 时上下边中点加长条、高 >52px 时左右加（image.rs:1007-1012）。
- **8 个 24px 角/边热区** + 2 个移动热区（整个框 `OpenHand` + 内缩 12px 的中央区，image.rs:1016-1029）；角/边 cursor 为对应 resize。**双击框内 = 保存裁剪**（image.rs:1018-1020 `if moving && ev.click_count == 2 { save_crop }`）。
- 暗罩点击吞事件（image.rs:967-971 prevent_default），框外不可点。

**拖拽**：
- `start_crop_drag`（image.rs:1267-1283）记录 `CropDrag { hx, hy: i8(-1/0/1), moving, from, start: [x,y,w,h] 显示px, size, cursor }`（结构体 image.rs:107-118）。
- `crop_drag_to`（image.rs:1291-1336）：按把手轴 clamp（单边最小 32px、不出图界）；**Shift 锁比例**——按 `w/h` 比例推导另一轴，缩放失败（越界）时该帧不动；移动模式 `moving` clamp 到图内。
- 拖拽期间一个全窗口 `image_drag_layer`（image.rs:1348-1358）捕获指针、保持 cursor，事件不漏。

**保存/取消/重置**：
- `save_crop`（image.rs:1198-1224）：矩形 4 位小数 round + clamp；仅当与原 crop 不同才 checkpoint（一步 undo）。**关键：同时改写 width/height**——`width = crop_display 时的 fw × (r-l)`，即「保存后显示尺寸 = 裁剪时整图的缩放 × 新可见分数」，保证保存后图片不跳变（注释：the shown size keeps the zoom the whole image had while cropping，image.rs:1196-1197）。保存后可选 `reselect` 把光标放回图块。
- `cancel_crop`（image.rs:1226-1231）：丢掉 `CropEdit`，不写文档。
- `reset_crop`（image.rs:1233-1249）：crop → None，width/height **除以**原分数（还原回整图同缩放），即「重置图片」按钮（工具条 image.rs:1405-1418，仅在已有 crop 或当前 rect ≠ 整图时出现）。
- **自动收尾**：`sync_crop`（image.rs:1250-1266）在选区移走（光标不在图上/块选不包含/caption 失焦）时自动 `save_crop`——不会出现「切走后裁剪还挂着」。
- 撤销：crop 写入走 `core.checkpoint(EditKind::Other)` + 直接改 `block_mut`（ARCHITECTURE.md「Direct property changes」列有 Image size/crop），整文档快照 undo，天然可撤销。

### 3.5 caption（图片描述）

- `src/editor/caption.rs`（130 行）：代码块名与图片描述共用一套 TextField 机制。图片 caption：13px、浅色 300、居中、可换行（caption.rs:70-73）；placeholder「输入图片描述」。
- 显示：图下 6px、与图同宽（image.rs:919-946）；未聚焦且非空时渲染为纯文本行。
- 键位（caption.rs:108-127）：Enter → 图下方新段落；Esc/↑/空描述退格 → 选回图片块。每次修改 checkpoint(Typing) + `Changed`。

### 3.6 Lightbox（点图放大，顺带）

单击已选中图片 → 全屏 lightbox（image.rs:127-148, 1544+）：左右切换文档内图片、⌘±/上下缩放、space fit、`r` 旋转（rotated 缓存按 `(rot, block)`）、双击 100%/适应切换、自动隐藏 chrome（3s 无操作）、下载。

---

## 4. 嵌套画板（whiteboard）

### 4.1 总体形态：Excalidraw 场景的 Rust 移植，作为文档里的一种块

- 画板 = `BlockKind::Board(Arc<Board>)`（model.rs:764）。`Board`（crates/core/src/whiteboard.rs:28-36）：
  ```rust
  pub struct Board { pub elements: Vec<Element>, pub files: BTreeMap<String, FileData>, pub app: ExportedAppState, pub height: f32 }
  ```
  文档内只存 `elements + files`（height 是块在页面里的高度，默认 360px，whiteboard.rs:14）；独立 `.excalidraw` 文件另存 app 状态。**存储格式 = Excalidraw 紧凑场景 JSON**（`<whiteboard type="excalidraw" height="…">` 内嵌 JSON，whiteboard.rs:1-5），`.excalidraw` 文件用官方 JSON 读写（`from_file/file_json`，whiteboard.rs:39-45），设计文档 `docs/design/whiteboard-excalidraw.md`。
- `Element`（crates/core/src/board/types.rs:132-166）：单结构体承载共享字段（id/x/y/stroke_color/background_color/fill_style/stroke_width/stroke_style/roundness/roughness/opacity/width/height/angle/seed/version/version_nonce/**fractional index**/group_ids/frame_id/bound_elements/locked/custom_data…），类型特有字段在 `Kind`（types.rs:113-131）：Rectangle / StickyNote / Diamond / Ellipse / Embeddable / Iframe / Image(ImageData) / Frame / MagicFrame / Text(TextData) / Line / Arrow(含 elbow) / FreeDraw。未建模的 JSON 键保留在 `extra`（types.rs:165）写回不丢。
- 画板内图片：`FileData`（types.rs:298+）字节存库 assets，`data_url` 只在场景来自外部未落库时临时填。
- 删除元素被剔除（whiteboard.rs:30 `filter(|e| !e.is_deleted)`）；搜索文本 = 文本元素原文 + frame 名（`plain_text`，whiteboard.rs:71-80）。

### 4.2 页面内的画板块（缩略图 + 编辑入口）

- 渲染：`src/editor/board.rs:40-84` `board_block`——全宽、`height` 高、圆角 8、1px 边框的盒子，内部 canvas 用 `paint_fit`（场景 fit 进块，PAD 16）画**静态缩略图**；painter 按 block 缓存、以元素 version 失效。空板显示「空画板」。
- 入口：hover 右上浮出「编辑」按钮（board.rs:47-66，group_hover 才 visible）或**双击**（board.rs:78-81）。tooltip「双击打开画板」。
- 编辑态：`BoardView` **替换整个文档区**（在应用头下、面包屑返回，editor/board.rs:1-5 注释），不是浮层。
- 新建：slash 菜单「画板」（menus.rs:176）→ 插入空 Board 块 → **立即打开编辑**（src/editor/view.rs:986-994）。

### 4.3 编辑入口/退出与写回

- `open_board`（editor/board.rs:88-111）：从块克隆 Board 建 BoardView，订阅 `BoardEvent`；`Changed` → `core.set_board(id, board, saved_once)`（crates/core/src/editor/core.rs:1147-1162）——**同一会话内的多次保存合并为一个 undo 步**（`saved_once` 标记，第一次 checkpoint、之后只 `generation+=1`）；`Close` → `close_board`（editor/board.rs:113-127）写回并 focus 回文档。独立 `.excalidraw` 文件直接整窗打开、Esc 离开即退出文件（board.rs:32-38, 131-141）。
- 「边编辑边存」：BoardView 每次 commit 都 emit Changed（board/mod.rs:253-263），编辑器负责节流写盘（500ms flush，ARCHITECTURE.md）。

### 4.4 编辑器架构（src/board/mod.rs）

- `BoardView`（mod.rs:66-100）持有：live `Scene`（含 deleted 元素，history 需要）、`AppState`（工具/选区/viewport/新元素默认值——Excalidraw appState 的移植）、`Store` + `History`（增量 undo）、`aabbs`/`hits` 命中缓存、tools 状态机、wysiwyg 文本编辑器等。
- **提交循环照抄上游**：改 scene/appState → `commit(CaptureUpdateAction)`（mod.rs:253-263）——记录增量进 History，元素变化才 emit Changed。手势中 `None`（Eventually），不产生 undo 步；滑杆拖动用 `begin_slider/end_slider` 合并为一步（mod.rs:176-190）。
- 工具集 `Tool`（action.rs:10-25）：Selection/Lasso/Hand/Rectangle/Diamond/Ellipse/Arrow/Line/FreeDraw/Text/Image/Eraser/Frame/StickyNote，快捷键照 Excalidraw（v/r/d/o/a/l/p/t/9/e/h/f/n，action.rs:31-48）。
- 指针派发：`canvas.rs` 的 `Gesture` 枚举（canvas.rs:25-34）把 down/move/up 分发给 tools/* 状态机（selection/shape/linear/freedraw/lasso/eraser/text/image/crop/flowchart）。
- 动作层 `BoardAction`（action.rs:56+）对应上游每个 `actions/*.ts`，core 的 `actions.rs` 每函数一个。

### 4.5 性能手段（render.rs 头注释，src/board/render.rs:1-22）

- **每元素双缓存**：display list（version/versionNonce 变才重建）+ 路径 tessellation 按 zoom 桶（quarter octaves）缓存，平移时 `Path::transformed` 重画。
- 双后端：主 GPUI painter（移植上游 `staticScene.ts` 绘制循环：只画可见元素、frame clip）+ **vello_cpu**（`render_vello.rs`）用于缩略图和高门槛元素，帧缓存复用。
- GPUI 不能旋转文本/图片、只能轴对齐裁剪 → 旋转文本画成字形轮廓 SVG sprite、旋转/镜像/帧内图片 **CPU 重采样**（render_geom.rs，按元素×分辨率 octave 缓存）。
- 命中测试用 version 化的 AABB 缓存 + 空间分桶（mod.rs:96-99 `aabbs`/`hits`）；`selected_elements` 用索引排序而非全场景扫描（mod.rs:118-127，注释点名大板 mid-drag 毫秒级差异）；大选择（>256）时面板放弃精确 scope（mod.rs:130-131）。

---

## 5. Clairis 对应差距与借鉴清单

> 核对范围：`/Users/mason/ToHighs/clairis/src/`。逐条 (a) Quiet 做法 (b) Clairis 现状与差距 (c) 建议。

### 5.1 高亮

**(a) Quiet**：见 §1——Marks.bg_color + 16 档面板 + A 一键记忆 + DocxXML span 属性 + 行高矩形渲染 + dark 模式专门色彩变换。

**(b) Clairis 现状**：
- `src/renderers/highlight.ts` 是**代码块**语法高亮（lezer），与文字高亮无关。
- 全仓 grep：文字高亮（`==mark==` 或 mark run）**不存在**。`src/renderers/markdown.ts`（marked 管线）没有 `==…==` 规则；`src/renderers/inline.ts:224-249` 的 `<mark>` 只用于**搜索命中预览**。
- 编辑器侧（CodeMirror）：`src/editors/` 无 mark/highlight 装饰；smart-input 只处理待办/列表类前缀。

差距：Clairis 完全没有文字高亮功能（标记、存储、渲染、面板都没有）。

**(c) 建议**（按 Quiet 模式裁剪落地）：
1. 语法层：marked `extensions.inline` 加 `==text==` → `<mark data-hl="色名">`；编辑态用 CM6 decoration（`class: cm-hl-<name>`）同步渲染。若要持久到磁盘，用 `==text==`（黄）或引入 `==text{color}==` 变体；不想发明语法则走「HTML 允许列表」路线（markdown.ts:40 的富文本安全子集已有 `<mark>` 空间——`<mark>` 加入 sanitize 白名单即可）。
2. 色板：抄 Quiet 的 7 色 × light/medium 16 格 + 「无」toggle 语义（取消 = 再点同色）；色值直接抄 `palette.rs:80-102`（含 alpha），CSS 变量落地。
3. 交互：Clairis 已有 floating-toolbar（`src/editors/orchestration/floating-toolbar.ts`），加一个 A▾ 分体按钮 + 面板即可，记住 `lastColor`。
4. 深色模式：直接抄 Quiet 的思路——light 高亮色在 dark 下「合成到白底变实色」（`mark()`，theme.rs:96-103），一行混合公式即可，比维护两套色板便宜。
5. 注意：Clairis 是 Markdown 文件为真相源，Quiet「MD 导出丢高亮」的取舍正适合 Clairis——用可承载的语法（`==` 或允许的 `<mark>`），避免 Quiet 那种「编辑为 MD 就丢」的裂缝。

### 5.2 嵌入文件

**(a) Quiet**：见 §2——附件复制入库 `assets/files/<uuid>/`、Card/Preview 双视图、Quick Look 缩略图缓存、内嵌音频播放器、拖放落点线。

**(b) Clairis 现状**：
- `src/editors/decorations/image.ts:644-707` `MediaWidget`：非图片媒体 = 视频 `<video controls>` 或**纯链接卡片**（`<a>` + 文件名），没有大小、类型图标、预览缩略图。
- `src/editors/decorations/fileEmbed.ts`：**另一种思路**——pdf/md/html/web 直接内嵌真实内容（iframe/renderMarkdown），与 Quiet 的 Card/Preview 正交。
- 存储：Clairis 无「复制入库」步骤（引用原路径），无大小显示，无音频播放器（audio 只在 `classifyFileEmbed` 里被排除出内嵌）。
- 拖放：`drop_files` 未见拖放创建 file block 的落点线机制。

差距：缺「附件卡」形态（图标/大小/预览/点击 Quick Look）；缺入库托管（相对路径引用外部文件，移动即失效——Clairis 目前以文档同目录相对路径为主，这是设计选择）。

**(c) 建议**：
1. 低成本高收益：给 `MediaWidget` 的 file 分支补 Quiet 式卡片——类型图标（按扩展名 11 类，抄 file.rs:51-68 的表 + kind_color 色）+ 文件大小（Tauri `fs.metadata`）+ 点击用系统打开（`tauri-plugin-opener` / `shell.open`，等价 Quick Look）。约 200 行。
2. 音频内嵌播放器：Clairis 是 WebView，`<audio controls>` 即可，比 Quiet 的 AVFoundation objc 桥便宜得多——值得做。
3. 缩略图（pdf/视频首帧）暂缓：WebView 里 pdf 已走 fileEmbed iframe，重复投入低。
4. 是否引入「复制入库」要慎重：Clairis 的文档-同目录相对路径是可移植性优势；可选做「打开时检测文件缺失 + 一次性导入」而不是 Quiet 的强制托管。

### 5.3 图片裁剪（重点：我们裁剪失败的病因定位）

**(a) Quiet**：见 §3——crop 存**分数**（0..1），渲染 = 外盒(可见部分) + 内图(整图同缩放) 平移，裁剪 UI 是「四暗罩 + 虚线框 + 括号把手 + 8 热区 + Shift 锁比 + 双击/自动保存」，保存时同时换算 width/height 保持缩放不变。

**(b) Clairis 现状与「显示随机、裁不成功」的病因**：

现状：`src/editors/decorations/image.ts:182-240` 属性块 `{crop=l,t,w,h}`（**原图像素坐标**）；渲染 image.ts:670-707：`object-fit:none; object-position:-l,-t; width/height=裁剪矩形`（无 width 属性时 rAF 量整图换算 scale）；裁剪 UI `src/editors/decorations/imageCrop.ts`：框覆盖在图片 widget 上，`scale = fullW / natW`（imageCrop.ts:147），`applyDisplay`（imageCrop.ts:181-190）设 `objectPosition = -rect.left*scale`、`width = rect.width*scale`。

**病因 1（根因，直接导致"显示随机"）：`object-fit: none` 不缩放内容。** CSS 的 `object-fit:none` 把图片内容按**原始像素尺寸**绘制进元素盒，元素盒缩小时只裁内容、不缩内容。而 imageCrop.ts 与 image.ts:672-676、预览 `src/renderers/markdown.ts:508-516` 都假设内容随 `scale` 缩放（`object-position:-l*scale`、盒宽 `w*scale`）。只要图片显示宽度 ≠ 原图宽（scale<1——手机照片几乎必然被 `max-width:100%` 夹住），`-l*scale` 的偏移落点就在**未缩放的内容坐标系**里，看到的区域既不是想要的矩形、也不是整图——看起来就是"随机"。正确写法二选一：
  - 保持 `object-fit:none` 时偏移用**自然像素**（`-l`）且盒尺寸也用自然像素（即放弃 scale，让裁剪框坐标与内容坐标一致）——这正是预览态 markdown.ts:510-511 的写法，所以预览"区域正确只是被放大"；裁剪 UI 用的 scale 版本才是随机来源。
  - 或改用 Quiet 的结构：外层 `overflow:hidden` 盒（= 可见部分显示尺寸）+ 内层 img 按整图缩放（`width = natW*scale; height = natH*scale; transform: translate(-l*scale, -t*scale)`）——内图是缩放过的元素，偏移在缩放坐标系里自洽。裁剪过程中把外盒临时换成整图盒（Quiet `crop_display`，image.rs:688-692）。

**病因 2（"开不出框/框错位"的随机性来源）：测量竞态。** imageCrop.ts:137-149 `mount()` 对页面里那个 `img` 清样式量 `getBoundingClientRect()`，但该 img 可能尚未完成 load（`ImageWidget.toDOM` 刚设置 src），量出的 fullW 为 0 或中间态 → `scale <= 0` 直接 return（静默不打开）或拿到错值。`openImageCrop` 的 probe `new Image()` 只保证 **natural 尺寸**就绪（imageCrop.ts:126-134），不保证页面 img 已 load。修复：等目标 img 的 `complete`/`load` 事件再 mount。

**病因 3（"裁不成功"的交互层）：保存条件过窄。** `finish()`（imageCrop.ts:226-247）要求 `drag.moved`（位移 ≥2px，imageCrop.ts:31）才写回；且没有任何「保存/完成」按钮（Quiet 是工具条按钮 toggle + 双击 + 自动收尾三通道，image.rs:1198, 1018, 1250）。用户拖动若被 widget 的 click 选中逻辑（image.ts:757-759 `container.addEventListener("click", selectImage)`）或装饰重建打断——**写回后 `writeImageAttributes` dispatch 会触发装饰重建，拖拽中的 frame 与旧 widget 一起被销毁，pointerup 落在新 DOM 上，frame 上的 pointerup 监听器收不到** → `finish` 永不触发 → 改动丢失。这是"不能裁剪成功"的第二条主链。修复：pointerdown 时把 pointerup/pointercancel 挂到 `window`（frame.setPointerCapture 已做，但装饰重建销毁 frame 元素后 capture 失效），或像 Quiet 一样引入显式「保存裁剪」按钮 + 选区移走自动保存，而不是依赖 frame 上的 pointerup。

**病因 4（显示态与数据态的坐标错位）**：image.ts:670-707 渲染已裁剪图时，`crop` 是原图像素、`width` 属性是"裁剪后显示宽"，二者单位不同且互不校验；无 width 属性时 `applyCropScale`（image.ts:681-703）每次 load 重算 scale——同样受 max-width 夹持影响，且 rAF + load 双触发可能互相覆盖。建议统一成 Quiet 的**分数存储**（0..1），显示尺寸永远单独算：分数与显示解耦后，"换算"只剩一处。

**(c) 落地建议（按性价比排序）**：
1. **先修渲染坐标**：三处（image.ts widget、imageCrop.ts applyDisplay、markdown.ts applyImageAttributes）统一改为「外盒 overflow:hidden + 内图整图缩放平移」结构，或全部改自然像素偏移。这是消除"显示随机"的根修。
2. **mount 前等 img.load**（imageCrop.ts:137 加 `if (!img.complete) await load`）。
3. **保存通道**：加工具条「保存裁剪/取消」按钮（复用现有 imageToolbar），pointerup 改挂 window + 装饰重建时用 rect 暂存补救；Esc 取消保留。
4. **数据格式向分数迁移**（可选）：`crop=0.25,0.1,0.75,0.9`，解析兼容旧像素格式（有 natural 尺寸可换算）。与 Quiet 的 DocxXML `crop` 分数语义一致，未来导出互换也容易。
5. 借鉴 Quiet 的暗罩 + 括号把手视觉（4 块 rgba(0,0,0,0.3) 罩 + 虚线框），纯 CSS，几十行，可用性提升明显；Shift 锁比与 32px 最小选区（Quiet MIN=32，image.rs:28；Clairis MIN_CROP_SIZE=8 偏小，拖歪很容易出细长条）。
6. 裁剪保存时同步写回显示宽高（Quiet save_crop 的 fw×分数 换算，image.rs:1213-1216）——避免保存后图片跳变。Clairis 现在只写 crop，显示尺寸继承旧 width，缩放会跳。

### 5.4 嵌套画板

**(a) Quiet**：见 §4——Excalidraw 全引擎 Rust 移植（元素模型/几何/编辑算法/undo/渲染三件套），画板作为 `BlockKind::Board` 嵌入文档，页面内静态缩略图 + 双击/编辑按钮整页接管，Excalidraw JSON 双向兼容。

**(b) Clairis 现状**：
- `src/renderers/diagram/`（engine.ts 151 行 + pele.ts 76 行）是 **mermaid 图渲染**（第三方 `pele` 包 mount），只读渲染、无画布交互、无对象模型、无编辑。
- 无任何 canvas/whiteboard 块类型；`src/editors/decorations/` 里没有对应 decoration。

差距：不是"功能弱"而是"域缺失"——Clairis 没有画板这一块类型。Quiet 的 2.6 万行（core 2 万 + view 6 千）不是一个可以直接抄体量的东西；它的价值在于**证明了一条路线**：把 Excalidraw 的 JSON/模型/算法移植成与 UI 无关的 core，编辑器只做视图。

**(c) 建议**（现实路线，不是抄引擎）：
1. **短期（几周量级）**：不引入画板块，先用「嵌入 .excalidraw 文件」：借助 fileEmbed 机制（fileEmbed.ts 已有 md/pdf/html 内嵌），对 `.excalidraw` 用离线渲染（excalidraw 的 `@excalidraw/utils` `exportToSvg` 在 WebView 里跑）出静态预览 + 点击用系统浏览器/官方编辑器打开。零引擎成本，拿到 80% 的"笔记里放图"需求。
2. **中期**：若确认要做可编辑画板，走 Quiet 的分层：模型+几何+undo 做成与渲染无关的模块（TS 里即纯函数模块），渲染用 canvas 2D 自绘 display list（Quiet 的 `display.rs` 思路——每元素缓存 display list + zoom 桶路径缓存，render.rs:7-11），UI 层只做指针派发（canvas.rs 的 Gesture 枚举模式）。不直接用官方 React 组件（Clairis 无 React in-editor）。
3. 无论哪条路，块模型照 Quiet：块内只存场景 JSON + height，渲染失败兜底静态缩略图；「边编辑边存 + 会话内合并 undo 步」（editor/board.rs:90-111）值得直接抄——这是画板 undo 体验的关键细节。
4. 性能红线照抄 Quiet 的两条：每元素 version 化缓存（version/versionNonce，types.rs:157-158）+ AABB 命中缓存；大板上这两个决定手感。

---

### 附：Quiet 关键文件速查

| 域 | 文件 |
|---|---|
| 高亮模型/色板 | `crates/core/src/model.rs:40-50`、`crates/core/src/palette.rs:26-108` |
| 高亮渲染 | `src/editor/text.rs:816-826`、`vendor/zed/crates/gpui/src/text_system/line.rs:886-1020`、`src/theme.rs:96-125` |
| 高亮 UI | `src/editor/overlays.rs:886-960`（面板）、`1529-1590`（A 分体）、`src/editor/view.rs:1143-1214` |
| 高亮存储 | `crates/core/src/docxml.rs:1061-1067`（写）、`683-684`（读）、`crates/core/src/markdown.rs:762-773`（MD 丢弃） |
| 文件块 | `src/editor/file.rs`（全）、`crates/core/src/model.rs:837-851` |
| 图片/裁剪 | `src/editor/image.rs`（模型 `crates/core/src/model.rs:739-753`、crop 序列化 `docxml.rs:920-934, 987-993`） |
| caption | `src/editor/caption.rs` |
| 画板模型 | `crates/core/src/whiteboard.rs`、`crates/core/src/board/types.rs:113-166` |
| 画板视图 | `src/board/mod.rs`、`src/board/canvas.rs`、`src/board/action.rs`、`src/board/render.rs:1-22` |
| 画板块接入 | `src/editor/board.rs`（缩略图/进出）、`src/editor/view.rs:986-994`（slash 新建）、`crates/core/src/editor/core.rs:1147-1162`（写回） |
