## Context

阅读配置三项已存在（`readerFontSize` / `readerWidth` / `readerSkin`），消费链成熟（设置页 + 阅读区）。缺的是「成套预设」这一层数据与一个应用入口。数据面机制（注册表 + 形状校验 + 用户覆盖 + 面级热应用 + 快照回滚）已在 P1 落地。

## Goals / Non-Goals

- Goals：三套默认预设；设置页一行点选应用；用户/AI 可改预设定义；非法值可解释地过滤。
- Non-Goals：阅读区内快捷切换；预设「当前选中」高亮（当前值可能与预设不一致）；键位/块菜单/编辑器图标/插件。

## Decisions

### D1 新形状 `ReaderPreset`

`{ id, label, fontSize, width, skin }`；list 型整体替换（与 capsules 一致）。理由：预设是「成套取值」，逐键合并无法表达删除/排序。

### D2 校验口径

`fontSize ∈ 8..=96`、`width ∈ 480..=1400`（步长 20，非步长值按最近步长归整后校验）、`skin ∈ {paper,indigo,moss,clay}`。非法项**过滤整条**并聚合一条告警（另一解：钳制到边界——被否：用户写错时钳制不可见，过滤能看见告警）。

### D3 应用语义

点选预设 → `setConfig({ readerFontSize, readerWidth, readerSkin })` + `saveAppConfig()`。不做选中态：当前值可能被单调整过，高亮会撒谎。

### D4 默认三套

紧凑 15/960/paper；标准 17/1080/paper；宽屏 19/1280/paper。取值均在既有边界内（`READER_WIDTH_MIN/MAX = 480/1400`）。

### D5 AI 通路

注册即进入 `find_surface` 白名单：`read_data_surface` / `patch_data_surface`（`{"items": null}` 恢复默认）/ `restore_surface_snapshot` 自动可用；`SKILL_MAP` 增补形状与示例一行。

## 数据面

| 落点 | 位置 | 载体/符号 | 判据 |
|---|---|---|---|
| 规格 | D1-D5 | — | 本变更 anchors 逐条断言 |
| 存储 | src-tauri/src/resources/reader-presets.default.json | SURFACES 登记 | 默认三套唯一来源（include_str 内嵌 + 物化 defaults 层） |
| 校验 | src-tauri/src/surfaces.rs | validate_reader_preset | 字号 8–96 / 宽度 480–1400 / 皮肤四值；非法项过滤并聚合告警 |
| 桥接 | src/lib/dataSurfaces/loader.ts | normalizeSurface | 默认←覆盖合并，未知 id 过滤+聚合告警，空回落默认 |
| 消费 | src/components/SettingsView.tsx | 阅读预设行 | 点选应用三项配置并落盘（`data-testid=reader-preset-<id>`） |
| 回滚 | snapshots/surfaces/reader-presets/ | restore_surface_snapshot | 写前快照（沿用 10 份），一步恢复 |

票面第 8 字段（数据面）：T1=`存储,校验,桥接,消费,回滚`；T2=`校验,规格`。

## Risks / Trade-offs

- 预设与当前值脱钩（无选中态）→ 用户可能疑惑「我现在是哪套」；接受：高亮会说谎，且三项可单独调整。
- 默认值品牌化（都是纸墨）→ 皮肤不进默认差异，避免预设一上手就改观感；用户可自建彩色预设。

## Open Questions

无（范围见 issue #1576 输入对账）。
