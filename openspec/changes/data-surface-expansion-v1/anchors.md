# 验收锚点 — data-surface-expansion-v1

锚点来源：issue #1496（spec，含 `## 输入对账` 确认）、`docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §4 B2/B5/B6 与 §5.2、`01-plugin-capability-extraction.md` §5、归档 change `data-surface-contract-v1/design.md:99-101`（P1 留白）、一手实现观察（`src-tauri/src/surfaces.rs:29` 枚举+三处 match、`src/lib/paneHeaderMenu.ts:45/56/69` 三表、`src/ui/icons.ts` 的 `IconDef`、`src/editors/orchestration/floating-toolbar.ts:825-841` 胶囊 12 项、`src/components/ai/AiConversation.tsx:134-180` 预设菜单、`src-tauri/src/ai_agent.rs:278` 面白名单）。R-1…R-6 对应 spec delta 的 DS-3…DS-8 与 tasks.md 1.1–6.1。

断言值取自既有实现基准（html-toolbar 12 项、六处菜单项数、胶囊 12 项、图标概念键数）与 issue 明示形态（四面白名单、三种形状、整体替换/逐键合并语义）；不引入未定义数值。

## R-1 面注册表驱动加载（DS-3）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-1.1 | state-machine | 面登记表追加一个新面后 `load_all` 返回面数 | 4（html-toolbar + menus + icons + capsules），无需改枚举或三处 match | D1 / surfaces.rs:29 枚举+三处 match 一手证据 |
| A-1.2 | exact | 前端 `SUPPORTED_SURFACES` 与 Rust `SURFACES` 的 id 集合 | 逐值一致（对账测试断言，差 0 处） | D1 / loader.ts 面清单一手证据 |
| A-1.3 | state-machine | html-toolbar 默认集合内容与顺序 | 12 项 id 与顺序不变（回归红线） | D9 / resources/html-toolbar.default.json 现值 |

## R-2 面项形状校验（DS-4）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-2.1 | state-machine | 菜单面覆盖含缺 `action` 的项 → 有效集合 | 该项被过滤，告警恰 1 条含该项 id | D2 / DS-4 |
| A-2.2 | exact | 图标面覆盖某概念键缺 `d`/`s`/`parts` 全部 path 字段 → 该概念键 | 回落默认 path，告警恰 1 条 | D2 / IconDef 一手证据 |
| A-2.3 | state-machine | 形状非法项不影响其余合法项 | 其余合法项正常生效（有效集合非空） | D2 / DS-4 |

## R-3 菜单面（DS-5）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-3.1 | exact | 覆盖把格头菜单某项 label 改为「查看源码」→ 格头 ⋯ 菜单该项显示 | 「查看源码」，不含「源码模式」 | DS-5 / paneHeaderMenu.ts:45 现值基准 |
| A-3.2 | state-machine | 覆盖调整页签右键顺序并停用某项 → 页签右键菜单 | 按新顺序渲染，被停用项不出现 | DS-5 / TabBar.tsx:701 现行为基准 |
| A-3.3 | state-machine | 六处消费端同源：外部修改 menus.json → 六处 | 1 秒内全部呈现新有效集合 | DS-5 / DS-8 |
| A-3.4 | exact | 菜单默认集合项数 | 与既有六处内置项并集逐项一致（差 0 处） | D3 / 三表+右键+预设菜单一手证据 |

## R-4 图标面（DS-6）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-4.1 | exact | 覆盖某概念键 label → 依赖该 label 的界面显示 | 新名称，不含旧名称 | DS-6 / Icon.tsx 消费一手证据 |
| A-4.2 | state-machine | 覆盖替换某概念键 `s` 路径 → 该概念键渲染 | 使用新路径（SVG path `d` 属性变化） | DS-6 |
| A-4.3 | state-machine | 覆盖新增概念键并定义 path 与 label → 菜单项 icon 引用 | 正常渲染（不回落默认） | DS-6 / issue #1496 用户故事 9 |
| A-4.4 | exact | 图标默认集合概念键数 | 与 `src/ui/icons.ts` 的 `ICONS` 键集逐值一致（差 0 处） | D3 / icons.ts 一手证据 |

## R-5 胶囊面（DS-7）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-5.1 | state-machine | 覆盖把胶囊面改为三个按钮 → 选区工具条 | 只渲染这三个按钮，顺序与面数据一致 | DS-7 / floating-toolbar.ts:825-841 现 12 项基准 |
| A-5.2 | exact | 覆盖某胶囊项 label 改名 → 该按钮 | `title` 与 `aria-label` 均为新名称 | DS-7 / capsule-toolbar.ts:66-68 一手证据 |
| A-5.3 | exact | 胶囊默认集合项数与顺序 | 12 项 id 与顺序不变（回归红线） | D3 / floating-toolbar.ts:825-841 现值 |

## R-6 AI 工具白名单扩展（AI-5）

| id | kind | claim | assert | source |
|---|---|---|---|---|
| A-6.1 | exact | `parse_surface_id` 白名单 | 恰为 html-toolbar / menus / icons / capsules（1→4） | D6 / ai_agent.rs:278 现一面一手证据 |
| A-6.2 | state-machine | `patch_data_surface("capsules", {"items":[...]})` 改覆盖 → 有效集合 | 快照数 +1；有效集合 → 新值 | D6 + D4（复用校验快照链路） |
| A-6.3 | exact | `read_data_surface("keybindings")`（未登记 id）返回 | 结构化错误（面未登记）；写入数 0 | D6（面白名单） |
| A-6.4 | state-machine | `patch_data_surface` 执行后 defaults 物化文件 | 差 0 字节（AI 只写用户覆盖） | D6 / D3 |
