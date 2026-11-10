# editing（delta）— ui-toolbar-slots

## ADDED Requirements

### Requirement: 横向工具条按钮集合与顺序由配置驱动

系统 SHALL 按 `user/settings.json` 的 `htmlToolbarItems` 决定横向工具条动作按钮的集合与顺序；字段缺省或为 `null` 时使用 12 项默认顺序；未知标识忽略、重复去重、空数组拒绝写入；颜色下拉与「清除格式」为固定控件，不参与槽位配置。

#### Scenario: 删除、重排与坏输入

- **WHEN** 用户把 `htmlToolbarItems` 改为不含 `format-bold` 的数组并重新选中文字，或把 `format-italic` 排到首位，或提交空数组
- **THEN** 工具条分别渲染 12 个动作且无 `format-bold`、首个动作为 `format-italic`、保存被拒且磁盘内容不变（A-1.1–A-1.4）

### Requirement: 设置面可编辑工具条槽位并恢复默认

系统 SHALL 在设置·编辑器提供文字工具条槽位的勾选与排序，改动即时生效并持久化；「恢复默认」写回空值以继承未来默认顺序。

#### Scenario: 取消勾选、重启与恢复默认

- **WHEN** 用户在设置中取消勾选「粗体」、上移一项、重启应用，随后点击「恢复默认」
- **THEN** 工具条依次为 12 个动作、顺序变化、重启后仍为 12 个动作、恢复后为默认 13 个可点控件（A-2.1–A-2.4）
