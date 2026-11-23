# Design — editor-batch3-lowcost：Quiet.md 学习报告 批次 3：低成本新功能

## Context

批次 1（`editor-foundation-batch1`，已归档）落地了同步/历史/键位地基。批次 2（`editor-interaction-batch2`）的手柄/图标/裁剪已并入（#1355–#1359），列表（#1350/#1351）与分栏（#1352）仍在开发中，且当前工作区 `src/styles/editor.css`、`src/editors/smart-input.ts` 有未提交改动。本批六项不依赖批次 2 的结构手术，前提是批次 1 的 `structureTransaction`（`src/editors/structure-history.ts:23-33`）可复用；但 T1/T4 与 `editor.css` 文件重叠，必须按 D8 的并行约束开工。

现状缺口有一手证据：阴影字面量散在 `editor.css` 10 处；高亮块解析 `CALLOUT_OPEN_RE`（`callout.ts:816`）只认 `[!TYPE][+-]`；公式装饰（`decorations/math.ts`）无点击浮层；媒体 file 分支（`image.ts:997-1024`）只有裸 `<a>`；宫格（`GridView.tsx:594-600`）写死 4 列。设计系统 §5 已登记阴影缺口，并写「新代码一律用 `--app-shadow`」，本批把它替换为 5 档 token。

## Goals / Non-Goals

**Goals:**

- 菜单、浮窗、右键菜单共用一套圆角/阴影语法，观感统一。
- 高亮块可改边框、背景、文字三色，颜色是块自身属性。
- 公式点击可编辑、闭合自动渲染、display 判定与错误占位完整。
- 非图片附件有类型/大小/系统打开，音频可内嵌播放。
- 首页宫格随宽度重排。

**Non-Goals:**

- 5:6 宽高比、字符级 `==text==`、附件复制入库、用户 CSS 主题、文件夹实体卡（见 proposal）。

## D1 高亮块三色模型与存储（T1）

- **语法**：块首行在折叠标记之后、标题之前加可选属性块，形如 `> [!NOTE]{bg=green border=red text=gray} 标题`。属性顺序无关；未知色名忽略并回落类型 tone；未提供任何颜色时完全回落该类型 tone。
- **解析**：把 `CALLOUT_OPEN_RE` 扩成 `^>\s*\[!([A-Za-z]+)\]([+-]?)(\{[^}]*\})?\s*(.*)$`，属性块单独解析成 `{ name: value }`；标题捕获顺移。`{...}` 与 fold 在类型转换、折叠切换时原样保留。
- **存储**：属性写回首行同一位置。旧 `> [!NOTE]` 文档不产生任何字符变化。`text` 只作用于标题与正文，不作用于链接、行内代码与 emoji；填充走软色（与现有 tone soft 同量级 ~8% tint），不是实块。
- **预设**：新增第 14 类型 `HIGHLIGHT`，标签「纯高亮」，emoji 🖍️，默认 `bg=yellow border=yellow text=none`；13 个语义类型标签不变。斜杠根「标注」改为「高亮」，块族名统一为「高亮」。
- **渲染**：装饰与预览都读 `--callout-bg` / `--callout-border` / `--callout-text`，回落 `--callout-soft` / `--callout-color` / 继承文字色。预览侧在 `convertCallouts`（`markdown.ts:603-651`）解析同一属性块并输出对应 CSS 变量。
- **理由**：Quiet 的 `Callout { emoji, bg, border, text_color }`（`model.rs:732-737`）与 `<callout background-color=… border-color=… text-color=…>`（`docxml.rs:286-291,880-895`）证明三字段是块级属性；本仓是 Markdown 真相源，用 Pandoc 风格属性块承载最省，且不发明新块类型。

## D2 颜色面板与历史（T1）

- **三行映射**：字体颜色 9 格（默认 + 8，来自 `FONT_COLORS`）；边框颜色 16 格（无 + 15，来自 `BORDER_COLORS`）；填充颜色 16 格（无 + 15，来自 `BACKGROUND_COLORS`）；底部「恢复默认」一次清空三色。点击已选颜色即清除该项（toggle）。复用 `createColorRow`（`color-palette.ts:88-130`），不新写渲染。
- **历史**：一次改色是一个撤销步，走 `structureTransaction`（`userEvent: "app.structure"` + `isolateHistory.of("full")`）。
- **入口**：挂在高亮块卡片菜单（与 `block-color.ts` 的块菜单元数据同构），不新开浮层体系。
- **理由**：本仓色板已是块菜单/文字工具条的共同数据源，复用比抄 Quiet 的 8/8/16 格更省且避免两套色值；`structureTransaction` 已在批次 1 验证过「一个意图一步撤销」。

## D3 主题阴影 token 与暗色镜像（T0）

- **5 档亮值**（抄 Quiet `theme.rs:245-300` 阶梯）：
  - `--shadow-menu`：`0 1px 3px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.10)`
  - `--shadow-panel`：`0 1px 4px rgba(0,0,0,.05), 0 12px 32px rgba(0,0,0,.12)`
  - `--shadow-dialog`：`0 2px 8px rgba(0,0,0,.06), 0 24px 64px rgba(0,0,0,.16)`
  - `--shadow-card`：`0 8px 22px -2px rgba(0,0,0,.035)`
  - `--shadow-button`：`0 1px 1.5px rgba(0,0,0,.05)`
- **暗色规则**：`.dark` 取同一几何、alpha ×3，上限 0.6。
- **镜像脚本**：新增 `scripts/theme-mirror.mjs`，对亮色做 OKLab 亮度镜像 `1.137 − 0.907·L`，chroma ≥ 0.14 的鲜艳色保持自身亮度在 0.62 到 0.86；脚本从 `tokens.css` 生成 `.dark` 草稿，人只校对。
- **防漂移测试**：新增 vitest，断言 `:root` / `.dark` / `.warm` 暴露的 token 键集合一致，堵住「新增 token 只写一处」。
- **圆角 token**：本批同时新增 `--radius-6`（菜单行）与 `--radius-12`（菜单/浮窗面板），把 §5 的「菜单行 4 / 浮层 8」改为「行 6 / 面板 12」；`--radius-4` / `--radius-8` 保留给控件与卡片。
- **设计系统 supersede（不在本规划任务改）**：票 1.1 把 `docs/design/system/spec.md` §5 的阴影段替换为 5 档 token 表、在圆角表补 `--radius-6` / `--radius-12` 并改写菜单/浮层基准，同时把「新代码一律用 `--app-shadow`」改为「新代码一律用 5 档 `--shadow-*`，存量字面量下次触及该组件时改引」；`decisions.md` 追加一行「菜单/浮窗阴影 token 化 + 两级圆角（editor-batch3-lowcost D3/D4）」。
- **理由**：Quiet 的阴影库是层级化的，层级比数值更重要；先立 5 档再收编字面量，比逐个改 rgba 更不容易漏。

## D4 菜单与浮窗两级阶梯（T4）

- **菜单级**（右键菜单、下拉菜单、块/斜杠菜单、类型浮层）：面板 `--radius-12`、行 `--radius-6`、行高 32、面板内距 6、行左右 inset 5、阴影 `--shadow-menu`、hover 中性黑 4.5%、快捷键列 12px 灰、键盘 ↑↓ 与 hover 共用同一高亮、右键菜单出现无动画。
- **浮层级**（浮动预览、浮动工具条、popovers）：面板 `--radius-12`、阴影 `--shadow-panel`；卡片 `--shadow-card`；按钮 `--shadow-button`。
- **6 组件范围**（全覆盖，不是单点）：`src/components/ContextMenu.tsx`、`src/editors/slash.ts`、`src/editors/orchestration/block-menu.ts`、`floating-toolbar.ts`、`horizontal-toolbar.ts`、`roulette-view.ts`。所有临时 rgba 阴影改走 5 档 token。
- **理由**：Quiet 的菜单外壳（`ui.rs:44-52,277-290`）与编辑器内菜单（`editor_ui.rs:25-26`）本就是两级；本仓散在 6 个组件的字面量先收敛到同一梯，避免「改一个漏五个」。

## D5 公式编辑四件套（T2）

1. **点击公式 → 源码浮层**：锚定在公式下方，多行输入，实时 KaTeX 预览；打开时全选现有源码，Esc 或点击外部提交，光标落回公式后。复用现有 orchestration 锚定机制，不新造浮层体系。
2. **闭合自动渲染**：键入闭合 `$…$`（含 `$$…$$`）后立即转公式对象；保留现有货币守卫（`$5`、`US$6` 不转换）。先核实 `smart-input.ts` 现状，只补缺口。
3. **display 判定**：tex 含换行、含 `\tag`、或以 `\begin{equation|align|gather|split|alignat|CD}` 开头时按块级渲染；`\begin{align*}` 不算块级。判定加在 `decorations/math.ts` 的解析处与 `renderers/math.ts` 的 extension 处，两处一致。
4. **空/无效占位**：空 tex 显示「添加 LaTeX 公式」；KaTeX 抛错或返回空时显示「无效公式」+ 警告图标，且不残留 `.katex-error` 或半渲染 DOM。
- **理由**：渲染内核（官方 KaTeX）保真度已高于 Quiet 的自研 CSS 引擎，缺的只是编辑体验与语义层；四件都不动主链，风险低。

## D6 附件卡与音频（T3）

- **范围**：`MediaWidget` 的 file 分支（`image.ts:997-1024`）由裸 `<a>` 改为附件卡：类型图标（11 类，按扩展名映射，颜色走 `--type-*`）+ 文件名 + 大小（Tauri `fs::metadata`，格式 `512 B / 1.50KB / 12.30MB`）+ 点击系统打开。
- **系统打开能力**：现无此命令，`reveal_in_finder`（`file.rs:196-247`）是 `open -R`（仅揭示）。票 2.2 新增 `open_file_external`，与 `reveal_path` 同构（macOS `open`、Windows `explorer`、Linux `xdg-open`），并在 `lib.rs` 的 `generate_handler` 注册。
- **音频**：`MediaWidget` 已把非图片归为 `file`，`classifyFileEmbed` 对本地音频返回 null，所以音频现在落进裸链接卡；票 2.2 在 `MediaWidget` 增加音频分支（或 `classifyMedia` 增加 `"audio"`），渲染 `<audio controls>`（`media://` 已支持 Range），不改 `classifyFileEmbed` 的 http(s) 分支。
- **内嵌不变**：pdf/md/html/web 保持 `fileEmbed`。
- **不复制入库**：保持文档同目录相对路径，避免引入「文件缺失」类缺陷。
- **理由**：Quiet 的 Card/Preview（`file.rs:521-611`）与 11 类图标（`file.rs:32-68`）是现成参照；本仓是 WebView，`<audio controls>` 比 Quiet 的 AVFoundation 桥便宜得多。

## D7 宫格响应式（T5）

- **列数公式**（`avail` 为 `[data-grid-grid]` 容器内容宽，非视口宽；`gap = 16`）：`wide = floor((avail + gap) / (200 + gap))`；`wide >= 4` 时 `n = min(8, max(4, floor((avail + gap) / (240 + gap))))`，否则 `n = min(3, max(1, floor((avail + gap) / (160 + gap))))`。例：avail 1440 → 5；1024 → 4；800 → 3。
- **保持不变**：1×1 / 2×1 / 2×2 三种 tile 跨度（`GridTile.tsx:249-252`）与 `gridAutoRows: 168px`。
- **hover**：从 `−translate-y-0.5 + shadow-md` 改为 3px 中性 7% 外环（`color-mix(in srgb, var(--app-text) 7%, transparent)`），去掉上浮与重阴影。
- **5:6 宽高比不做**。
- **理由**：Quiet 的列数算法（`home.rs:900-945`）证明宽度驱动比定列更稳；本仓已有 dense flow 与 tile 跨度，改列数公式即可，不动卡片形状。

## D8 执行顺序与集成 checkpoint

- **顺序**：1.1（阴影）与 1.2（高亮）无相互依赖，可并行；2.1、2.2 无依赖；2.3 Blocked by 1.1、1.2（消费 5 token 与统一菜单）；3.1 Blocked by 1.1（hover 环走中性色，不依赖阴影 token，但同批视觉验收一起做）。
- **与批次 2 的文件重叠（硬约束）**：T1/T4 都会改 `src/styles/editor.css`；批次 2 的列表票 #1350/#1351 正在改 `editor.css` 与 `smart-input.ts`。T1/T4 不得在 #1350/#1351 合入前从脏工作区开工；实现必须从 `origin/main` 的独立 worktree/分支起步，禁止把批次 2 的未提交改动带入。T0/T2/T3/T5 与批次 2 无文件重叠，可先行。
- **QG-6 集成 checkpoint**：本 change 6 票（≥6），在 1.1/1.2/2.1/2.2 合并后插入一次集成 checkpoint：跑四门禁（tsc/eslint/vitest/两套 Playwright 或按当时配置）→ 打开应用一次 → 记录「现在用户能看到什么」。剩余 2.3、3.1 各自完成后再记一条。
- **理由**：多票并行 + 延迟集成是 barrel 冲突与「合并≠能跑」的高发区，checkpoint 把「能跑」提前到中途。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | design-system:§5 | — | 5 档 `--shadow-*` 与菜单两级圆角先入 spec §5（supersede），票 1.1/2.3 落地；未入 spec 不得拆票 |
| 存储 | src/styles/tokens.css | --shadow-menu | 三主题 `:root`/`.dark`/`.warm` 均有 5 个 `--shadow-*`，vitest 断言集合一致 |
| 校验 | src/styles/tokens.css | --shadow-panel | 未知/缺失阴影回落 `--shadow-menu` 或 `--app-shadow`，不静默失效 |
| 桥接 | src/editors/orchestration/menu-metrics.ts | MENU_SHADOW | `MENU_SHADOW` 指向 `var(--shadow-menu)`，TS 内不写死 rgba |
| 消费 | src/styles/editor.css | --shadow-menu | 菜单/浮窗/右键菜单规则消费 5 token，临时 rgba 阴影清零 |
| 回滚 | src/styles/tokens.css | 缺省 | 移除 5 token 即回退到既有 `--app-shadow` 与字面量（默认/回退/回落），行为不丢 |

## 风险与回滚

- **阴影 token 漏定义**：三主题漏写其一。缓解：vitest 断言键集合一致。回滚：移除 5 token，恢复既有 `--app-shadow` 与字面量（默认/回退）。
- **高亮属性破坏旧文档**：解析正则改宽后误吃标题里的 `{}`。缓解：属性块必须在折叠标记之后、标题之前，且旧 `> [!NOTE]` 字符差异数为 0。回滚：撤下属性解析，恢复原 `CALLOUT_OPEN_RE`。
- **颜色面板与 CM6 事务冲突**：改色 dispatch 触发装饰重建。缓解：走 `structureTransaction`，一次一改一步。回滚：撤下颜色入口。
- **公式浮层与 CM6 抢焦点**：浮层输入被编辑器 keymap 拦截。缓解：浮层内 `stopPropagation`，Esc/外点显式提交。回滚：回退到源码态直接编辑。
- **系统打开命令缺失平台**：非 macOS 无 `open`。缓解：与 `reveal_path` 同构的三平台分支。回滚：失败时回退 `reveal_in_finder`。
- **宫格重排挤压**：极窄窗列数算到 0。缓解：`clamp` 下限 1。回滚：恢复 `repeat(4, …)`。
