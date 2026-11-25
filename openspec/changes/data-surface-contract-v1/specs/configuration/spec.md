## ADDED Requirements

### Requirement: CF-7 补丁写边界校验

`patch_config` 补丁 SHALL 在写入边界做已知键校验：补丁中的键（顶层与已知嵌套层级）SHALL 属于应用配置的已知键集，未知键 SHALL 返回列出键路径的结构化校验错误且磁盘不变；state 层专属键（`recentFiles`、`scrollPositions`、`embedScrollPositions`）SHALL 一律拒绝。补丁写入 SHALL 只落「合并后的 user 层」，SHALL NOT 把代码默认值固化进 user 层，SHALL NOT 写 state 层。读取端 SHALL 保持宽松：配置文件含未知键时 SHALL 正常加载。补丁返回值 SHALL 为真实有效配置（含 state 层读取结果）。

#### Scenario: 未知顶层键被拒

- **WHEN** `patch_config` 传 `{"fontSizeX": 20}`
- **THEN** SHALL 返回校验错误并列出键路径，`user/settings.json` SHALL 逐字节不变

#### Scenario: 嵌套未知键被拒

- **WHEN** `patch_config` 传 `{"propertyBar": {"unknownField": 1}}`
- **THEN** SHALL 返回校验错误列出 `propertyBar.unknownField`，磁盘不变

#### Scenario: state 专属键被拒

- **WHEN** `patch_config` 传 `{"recentFiles": []}`
- **THEN** SHALL 返回校验错误，`state/state.json` SHALL 逐字节不变

#### Scenario: 补丁只写 diff 不固化默认

- **WHEN** user 层仅含 `theme`，补丁打 `fontSize`
- **THEN** 写后 user 层 SHALL 恰含原有键与 `fontSize`，SHALL NOT 出现其它默认键

#### Scenario: 补丁不再清空 state

- **WHEN** `state/state.json` 已含 `recentFiles`，随后打任意合法补丁
- **THEN** `state/state.json` SHALL 逐字节不变，且补丁返回值 SHALL 含这些 `recentFiles`

#### Scenario: 旧配置兼容加载

- **WHEN** `user/settings.json` 含历史遗留未知键
- **THEN** `load_config` SHALL 正常加载，SHALL NOT 报错
