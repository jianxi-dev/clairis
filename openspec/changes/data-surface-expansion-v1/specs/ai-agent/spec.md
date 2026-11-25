## MODIFIED Requirements

### Requirement: AI-5 数据面读写工具

agent SHALL 提供 `read_data_surface(id)`（返回 `{effective, defaults, warnings}`）与 `patch_data_surface(id, patch)`（面白名单、写边界校验、写前快照、原子写，返回新有效值）。`id` 未登记 SHALL 返回结构化错误。本变更登记面为 `html-toolbar` / `menus` / `icons` / `capsules`。`patch_data_surface` 的补丁形状 SHALL 按面 shape 分派：`html-toolbar` / `menus` / `capsules` 为 `{"items":[...]}`（完整项 id 或项对象数组，整体替换语义），`icons` 为 `{"items":[...]}`（概念键定义对象数组，逐键合并语义）。对任一面的补丁 SHALL 只作用于用户覆盖层，SHALL NOT 修改 defaults 物化文件。

#### Scenario: 读面返回三段

- **WHEN** 模型调用 `read_data_surface("menus")`
- **THEN** SHALL 返回有效集合、默认集合与告警列表

#### Scenario: 改面生效可回滚

- **WHEN** 模型调用 `patch_data_surface("capsules", {"items":[...]})`
- **THEN** 用户覆盖 SHALL 更新、有效集合 SHALL 变化、写前 SHALL 产生快照

#### Scenario: 未登记 id 被拒

- **WHEN** 模型调用 `read_data_surface("keybindings")`
- **THEN** SHALL 返回结构化错误（面未登记），SHALL NOT 产生任何写入
