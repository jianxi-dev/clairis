## Problem Statement

阅读排版目前只有三个独立旋钮（字号、正文宽度、阅读皮肤），每次调整都要进设置逐项拨。用户想要的「一键切到某种阅读状态」不存在；同时 AI 也改不了「一套预设」——只能逐个改三个字段，且无法保存成可复用的一组。

## Solution

引入第五个数据面 `reader-presets`：

- 默认自带三套预设：**紧凑**（15px / 960px / 纸墨）、**标准**（17px / 1080px / 纸墨）、**宽屏**（19px / 1280px / 纸墨）。
- 设置 → 预览 → 新增「阅读预设」一行，点一下就把三项配置一起应用并落盘。
- `user/reader-presets.json` 可改/可增预设；AI 通过既有 `read_data_surface` / `patch_data_surface`（`{"items": null}` 恢复默认）/ `restore_surface_snapshot` 直接读写与回滚。

## User Stories

1. As a 用户, I want 一键切到「宽屏」, so that 不用每次进设置拨三次
2. As a 用户, I want 自己加一套「夜间大字」预设, so that 晚上阅读不用重复调整
3. As a 用户, I want 改预设的名字, so that 预设叫法符合我的习惯
4. As a 用户, I want 删掉不用的预设, so that 设置里只剩我会用的
5. As a 用户, I want 预设值被校验（越界回落默认）, so that 写错不会让阅读区排版坏掉
6. As a AI agent, I want 读取/修改/重置预设面, so that 用户说「把宽屏再放宽一点」我能改数据不改代码
7. As a 维护者, I want 预设面与其它面共用同一套加载/合并/回滚语义, so that 行为可预期

## Implementation Decisions

- 新形状 `ReaderPreset { id, label, fontSize, width, skin }`；list 型整体替换（同 capsules）。
- 校验：`fontSize` 8–96、`width` 480–1400（步长 20，按最近步长取值后校验范围）、`skin` ∈ `paper|indigo|moss|clay`；非法项过滤并聚合告警。
- 默认源：`resources/reader-presets.default.json`，三套预设；物化到 `defaults/surfaces/reader-presets.json`。
- 消费端：设置页「阅读预设」行（按钮组，`data-testid="reader-preset-<id>"`），点击 → `setConfig({ readerFontSize, readerWidth, readerSkin })` + `saveAppConfig()`；不做「当前选中」态（当前值可能与预设不一致，避免假选中）。
- AI 通路：注册即进入 `find_surface` 白名单，`read_data_surface` / `patch_data_surface` / `restore_surface_snapshot` 自动可用；`SKILL_MAP` 增补一行说明形状与示例。
- 兼容：既有 `readerFontSize` / `readerWidth` / `readerSkin` 字段与设置项行为不变。

## Testing Decisions

- Rust：默认三套逐值断言；覆盖改名/改值/删项/新增；越界值（fontSize 100、width 2000、skin 未知）过滤并聚合告警；空覆盖回落默认；reset/restore 与其他面同语义。
- 前端契约：预设面加载与 `applyPreset` 逻辑（应用三值并触发落盘）。
- e2e：设置页点「宽屏」→ 阅读区宽度与字号断言（计算样式），改 `user/reader-presets.json` 的 label → 按钮文案变化。
- 只锁外部行为；既有阅读设置测试保持通过。

## Out of Scope

- 阅读区内的预设快捷切换（只在设置页提供）
- 键位面、块菜单面、编辑器图标面、插件 P2
- 预设的「当前生效」高亮态（值可能与预设不一致）

## Further Notes

- 来源：`docs/design/pluginization-datafile-settings-rail/02-data-file-extraction.md` §4 B9 与 §6 第四批；本轮用户「按建议」确认（2026-11-26）。
- 数据面六栏表在 change design.md 落；本 spec 只定义行为。
