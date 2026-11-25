# data-surfaces Specification

## Purpose
TBD - created by archiving change data-surface-contract-v1. Update Purpose after archive.
## Requirements
### Requirement: DS-1 数据面默认源与有效集合

每个已登记数据面 SHALL 有唯一默认来源：仓库内 JSON 默认文件（构建内嵌，首次运行物化到 defaults 层）。面的有效集合 SHALL 为「默认 ← 用户覆盖」合并结果；用户覆盖中的未知 id SHALL 被过滤并聚合为一条告警；覆盖为空或全部非法 SHALL 回落默认。默认文件缺失或损坏时 SHALL 回落内嵌默认并 SHALL 能重建物化文件。本变更登记面为 `html-toolbar`（横向工具条按钮集合与顺序）、`menus`（六处菜单）、`icons`（UI 图标集合）、`capsules`（胶囊选区工具条）；各面默认集合内容与既有内置项一致。

#### Scenario: 默认文件物化

- **WHEN** 应用首次启动（defaults 层无该面文件）
- **THEN** `defaults/surfaces/<id>.json` SHALL 被写入，内容与内嵌默认逐值一致

#### Scenario: 覆盖合并与未知 id 过滤

- **WHEN** 用户覆盖含未知 id（如菜单面覆盖 `["new-file","nope","share"]`）
- **THEN** 有效集合 SHALL 过滤 `nope` 并产生一条含 `nope` 的聚合告警，默认剩余项不自动补回

#### Scenario: 空覆盖回落默认

- **WHEN** 用户覆盖为空或不合法
- **THEN** 有效集合 SHALL 等于默认集合，SHALL NOT 出现空菜单/空工具条

#### Scenario: 默认文件损坏回落内嵌

- **WHEN** 物化的默认文件被改坏（非法 JSON）
- **THEN** 有效集合 SHALL 回落内嵌默认，物化文件 SHALL 可重建

### Requirement: DS-2 面级加载与变更事件

应用 SHALL 提供 `load_surfaces` 命令，返回全部已登记面的有效集合与告警。已登记面的数据文件被外部修改后，应用 SHALL 在 1 秒内发出 `surfaces-changed(id)` 事件；该事件的消费端 SHALL 只重载对应面，SHALL NOT 触发全量配置重放（pane 布局、编辑器状态等 SHALL NOT 被触碰）。

#### Scenario: 外部修改即时生效

- **WHEN** 应用运行中外部进程修改已登记面文件
- **THEN** 前端 SHALL 在 1 秒内收到 `surfaces-changed`，对应面消费端 SHALL 呈现新有效集合

#### Scenario: 全量重放不被触发

- **WHEN** `surfaces-changed` 事件到达
- **THEN** pane 布局与编辑器 undo/选区状态 SHALL 保持不变（只重载对应面）

### Requirement: DS-3 面注册表驱动加载

Rust 端 SHALL 以一张面登记表（面 = `{id, 默认文件名, 项形状, 校验器}`）驱动全部已登记面的加载、物化与合并；新增面 SHALL 只追加登记项与默认文件，SHALL NOT 修改 `SurfaceId` 枚举或 `surfaces()` / `default_file_name()` / `user_override()` 三处 match。前端 loader 的已知面清单 SHALL 由同一份登记数据派生，并通过对账测试与 Rust 表锁定。

本变更登记面为 `html-toolbar`（既有）、`menus`、`icons`、`capsules`（新增）。

#### Scenario: 新增面不改样板

- **WHEN** 面登记表追加一个新面（默认文件 + 形状 + 校验器）
- **THEN** `load_all` SHALL 返回该面的有效集合与告警，SHALL NOT 需要修改枚举或三处 match

#### Scenario: 前后端面清单对账

- **WHEN** 前端 loader 的已知面清单与 Rust 面登记表比较
- **THEN** 两面 id 集合 SHALL 逐值一致（对账测试断言）

### Requirement: DS-4 面项形状校验

每个面 SHALL 声明自己的项形状；面加载时校验器 SHALL 拒绝非法项（缺字段、类型错、未知 action/id），非法项 SHALL 被过滤并聚合为一条告警，有效集合 SHALL NOT 因单个非法项而整体失败。

三种形状：`menu-item`（`id`/`label`/`icon`/`action`/`enabled`/`order`）、`icon`（概念键/`label`/`d?`/`s?`/`dash?`/`parts?`）、`capsule`（`id`/`label`/`icon`/`order`）。

#### Scenario: 非法菜单项被过滤

- **WHEN** 菜单面用户覆盖含一个缺 `action` 的项
- **THEN** 该项 SHALL 被过滤并产生一条聚合告警，其余合法项 SHALL 正常生效

#### Scenario: 图标面 path 组校验

- **WHEN** 图标面用户覆盖某概念键的定义缺 `d`/`s`/`parts` 全部 path 字段
- **THEN** 该定义 SHALL 被拒绝（回落默认 path），并产生一条聚合告警

### Requirement: DS-5 菜单面

菜单面 `menus` SHALL 覆盖六处消费端：格头 ⋯ 菜单、AI 窗格 ⋯ 菜单、导出子菜单、页签右键菜单、预览右键菜单、AI 浮窗（AI 对话预设菜单）。项 SHALL 可增删、排序、启停（`enabled`）、改名（`label`）。默认集合内容与既有六处内置项一致。

#### Scenario: 菜单改名生效

- **WHEN** 用户覆盖把格头菜单某项 `label` 从「源码模式」改为「查看源码」
- **THEN** 格头 ⋯ 菜单该项显示「查看源码」，SHALL NOT 出现「源码模式」

#### Scenario: 菜单排序与启停生效

- **WHEN** 用户覆盖调整页签右键菜单项顺序并停用某项
- **THEN** 页签右键菜单 SHALL 按新顺序渲染，被停用项 SHALL NOT 出现

#### Scenario: 六处消费端同源

- **WHEN** 菜单面被外部修改
- **THEN** 六处消费端 SHALL 在 1 秒内呈现新有效集合，SHALL NOT 需要分别配置

### Requirement: DS-6 图标面

图标面 `icons` SHALL 覆盖 `src/ui/icons.ts` 的 UI 图标集合（不含 `src/editors/icons.ts`）。用户覆盖 SHALL 可换路径（`d`/`s`/`parts`）、改名称（`label`）、新增概念键。`Icon` 组件按概念键查图标面：`label` 与 path 组来自面数据，缺失 SHALL 回落 `ICONS` 默认。

#### Scenario: 图标改名生效

- **WHEN** 用户覆盖把某概念键 `label` 改为新名称
- **THEN** 依赖该 label 的界面 SHALL 显示新名称

#### Scenario: 图标换路径生效

- **WHEN** 用户覆盖替换某概念键的 `s` 路径
- **THEN** 该概念键渲染 SHALL 使用新路径

#### Scenario: 新增概念键

- **WHEN** 用户覆盖新增一个概念键并定义 path 与 label
- **THEN** 该概念键 SHALL 可被菜单项 `icon` 字段引用并正常渲染

### Requirement: DS-7 胶囊面

胶囊面 `capsules` SHALL 覆盖胶囊选区工具条的按钮集。项 SHALL 可增删、排序、改名（`label`）。默认集合内容与既有 12 项一致。

#### Scenario: 胶囊按钮集可配置

- **WHEN** 用户覆盖把胶囊面改为只留三个按钮
- **THEN** 选区工具条 SHALL 只渲染这三个按钮，顺序与面数据一致

#### Scenario: 胶囊改名生效

- **WHEN** 用户覆盖把某胶囊项 `label` 改名
- **THEN** 该按钮的 `title` 与 `aria-label` SHALL 显示新名称

### Requirement: DS-8 面级热应用到新面

已登记面（含 `menus` / `icons` / `capsules`）的数据文件被外部修改后，应用 SHALL 在 1 秒内发出 `surfaces-changed(id)` 事件；该事件的消费端 SHALL 只重载对应面，SHALL NOT 触发全量配置重放。

#### Scenario: 新面外部修改即时生效

- **WHEN** 应用运行中外部进程修改 `user/menus.json`
- **THEN** 前端 SHALL 在 1 秒内收到 `surfaces-changed("menus")`，菜单消费端 SHALL 呈现新有效集合

#### Scenario: 新面事件不触发全量重放

- **WHEN** `surfaces-changed("icons")` 事件到达
- **THEN** pane 布局与编辑器 undo/选区状态 SHALL 保持不变

