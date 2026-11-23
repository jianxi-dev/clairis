# 验收锚点 — editor-batch3-lowcost

锚点来源：`quiet-md-逆向学习总报告.md` 批次 3（低成本新功能）+ 域报告 `media-board.md` §1/§2/§5.1/§5.2、`widgets-refs-math.md` §4/§5.4、`home-theme-menu.md` §1.1/§2.5/§6.1/§6.4/§6.5/§6.6 + 用户确认（见 `docs/requirements/editor-batch3-lowcost/input-alignment.md`）+ 本仓 HEAD `45b1661` 一手源码实读；design.md D1–D8 与「数据面」。R-1…R-6 对应 tasks.md 1.1–3.1。

## R-1 主题阴影 token

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | exact | 5 个 `--shadow-*` token 存在 | 5 个键严格存在：`--shadow-menu`/`--shadow-panel`/`--shadow-dialog`/`--shadow-card`/`--shadow-button` | 用户确认第 8 项 / 一手 tokens.css:83-84 |
| A-1.2 | exact | 菜单计算阴影等于 `--shadow-menu` | 探针元素设 `probe.style.boxShadow = 'var(--shadow-menu)'`，`getComputedStyle(probe).boxShadow === getComputedStyle(menu).boxShadow` | 一手 editor.css:3438-3446 / Quiet theme.rs:245-300 |
| A-1.3 | exact | 三主题 token 集合一致 | `:root` 键集合 → `.dark` 键集合 → `.warm` 键集合，三者相等 | Quiet theme.rs:11-110 / 一手 tokens.css:10-130 |
| A-1.4 | exact | 暗色 alpha 上限 | `.dark` 每个 `--shadow-*` 的 alpha 均 ≤ 0.6 | Quiet theme.rs:240-245 / 用户确认第 8 项 |

## R-2 高亮块三色

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | exact | 解析 `{bg=green border=red text=gray}` | 3 个属性（bg/border/text）均非空 | 用户确认第 1 项 / 一手 callout.ts:816 |
| A-2.2 | exact | 未知色名忽略 | `{bg=nope}` 时 `--callout-bg` 自定义属性为空，计算背景 → 回落 tone soft | 用户确认第 1 项 / Quiet docxml.rs:286-291 |
| A-2.3 | exact | 卡片计算色等于所选 token | `--callout-bg` = green 色板项，计算背景 = green 软色（`color-mix` ~10%）；`--callout-border` / `--callout-text` = red / gray 色板项，计算边框/文字等于 red / gray token | 一手 color-palette.ts:24-69 |
| A-2.4 | exact | 类型转换保留属性 | `{...}` 与 fold 仍在（差异字符数 0） | 用户确认第 1 项 |
| A-2.5 | exact | 重开持久 | 重载后属性仍在（差异字符数 0） | 一手 callout.ts:93-107 |
| A-2.6 | exact | 一次改色一步撤销 | 撤销后 → 回到改色前状态 | 一手 structure-history.ts:23-33 |
| A-2.7 | exact | 旧 `> [!NOTE]` 字符差异 | 0 | 用户确认第 3 项 |
| A-2.8 | exact | 纯高亮预设标签 | 标签数 1，严格等于 "纯高亮" | 用户确认第 1 项 |

## R-3 公式编辑

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 点击公式开浮层 | 浮层节点数 1 | 用户确认第 4 项 / Quiet overlays.rs:1157-1189 |
| A-3.2 | exact | display 多行/align 为块 | 块级节点数 1 | Quiet math.rs:20-38 / 一手 decorations/math.ts:158-206 |
| A-3.3 | exact | 无效公式占位文本数 | 1（「无效公式」） | Quiet text.rs:583-613 / 用户确认第 4 项 |

## R-4 附件卡与音频

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 附件卡节点数 | 1 | 用户确认第 5 项 / 一手 image.ts:963 |
| A-4.2 | exact | 图标按扩展名 | 11 类映射 | Quiet file.rs:32-68 |
| A-4.3 | exact | 大小文本非空 | 文本长度 ≥ 1 | 一手 mediaUrl.ts / 用户确认第 5 项 |
| A-4.4 | exact | 系统打开调用数 | 1 | 一手 commands/file.rs:196-247 |
| A-4.5 | exact | 音频 `<audio>` 节点数 | 1 | 一手 image.ts:1014 / 用户确认第 5 项 |

## R-5 菜单与浮窗统一

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | exact | 菜单面板圆角 | 12 | 用户确认第 6 项 / Quiet ui.rs:277 |
| A-5.2 | exact | 菜单行圆角 | 6 | Quiet ui.rs:278 |
| A-5.3 | exact | 菜单行高 | 32 | Quiet ui.rs:279 |
| A-5.4 | exact | 菜单阴影 | alpha 0.10，→ `--shadow-menu` | Quiet ui.rs:277 / 一手 editor.css:3438 |
| A-5.5 | exact | 浮动预览阴影 | alpha 0.12，→ `--shadow-panel` | Quiet theme.rs:245-300 |
| A-5.6 | exact | hover 中性 4.5% | `rgba(0,0,0,0.045)` | Quiet theme.rs:247 / 用户确认第 6 项 |
| A-5.7 | exact | 键盘/hover 同一高亮 | 2 种输入 → 同一 class | Quiet view.rs:773-855 |
| A-5.8 | exact | 右键菜单 transition | transition: none（0 动画） | Quiet 无动画 / 一手 editor.css:3438 |

## R-6 宫格响应式

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | 网格容器内容宽 1440 列数 | 5 | 用户确认第 7 项 / Quiet home.rs:902-915 |
| A-6.2 | exact | 网格容器内容宽 1024 列数 | 4 | 用户确认第 7 项 / Quiet home.rs:902-915 |
| A-6.3 | exact | 网格容器内容宽 800 列数 | 3 | 用户确认第 7 项 / Quiet home.rs:902-915 |
| A-6.4 | exact | gap | 16 | 用户确认第 7 项 |
| A-6.5 | exact | hover 环 | 3px | Quiet home.rs:1022-1025 |
| A-6.6 | exact | tile 跨度不变 | 1×1 / 2×1 / 2×2 | 一手 GridTile.tsx:249-252 |
