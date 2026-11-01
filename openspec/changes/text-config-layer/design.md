# Design: 配置三层与快照回滚

## D1 目录布局（`app_config_dir()` 下）

```
defaults/settings.json              # 随包默认，缺失时由代码写入，之后只读
user/settings.json                  # 用户 / AI 写入口
state/state.json                    # 派生：recentFiles、scrollPositions
snapshots/settings-<RFC3339>.json   # 最近 10 份 user 快照
```

## D2 合并规则

`AppConfig` 是**有效配置**（前端唯一看到的结构，保持现状）。加载时：

1. `defaults` 缺失 → 用 `AppConfig::default()` 的序列化结果写入（只写一次）。
2. `user` 缺失 → 视作空对象。
3. 有效 = `serde_json::Value` 深合并（defaults ← user），再反序列化为 `AppConfig`。
4. `state.json` 存在则覆盖 `recent_files` / `scroll_positions` 两个字段；缺失用默认空值。

## D3 写入顺序（`save_config`）

校验 → 辉照当前 user（若存在）→ 原子写 user → 原子写 state → 返回有效配置。

任一步失败：返回错误，磁盘保持进入前的状态（原子写保证）；快照允许比实际多一份，不影响正确性。

## D4 快照

- 文件名 `settings-<UTC RFC3339，去冒号>.json`，按文件名升序即时间序。
- 写入前复制当前 `user/settings.json`；若不存在则跳过。
- 写完后清理，仅保留最新 10 份。
- `restore_config_snapshot(name)`：校验 name 只含安全字符 → 先快照当前 → 用快照内容原子覆盖 user → 返回新的有效配置。

## D5 校验规则

| 字段 | 规则 | 失败 |
|---|---|---|
| `fontSize` / `readerFontSize` | None 或 8.0–96.0 | 拒绝 |
| `readerWidth` | None 或 480.0–2400.0 | 拒绝 |
| `sidebar_*_width` | None 或 0.0–800.0 | 拒绝 |
| `horizontal_split_ratio` / `vertical_split_ratio` | None 或 0.0–1.0 | 拒绝 |
| `theme` | None 或 `light` / `dark` / `warm` / `system` | 拒绝 |
| `readerSkin` | None 或 `paper` / `plain` | 拒绝 |

校验失败返回 `AppError::Validation`，磁盘不变。

## D6 热应用

启动时 spawn 一个 tokio task：每 500 ms `metadata()` 目标 `user/settings.json`，比较 `(mtime, len)`；变化即 `app.emit("config-changed", ())`。首次 tick 只记录基线，不发事件。

取舍：`notify` 不在现有依赖树，为一个文件加新依赖不划算；轮询按**路径**取状态，文件被别人 rename 替换也能发现，符合「父目录监听」要解决的丢 watch 问题。

## D7 迁移

`load_config` 发现 `user/settings.json` 不存在且旧 `app_config.json` 存在时：

1. 读旧文件，拆成 settings（设置字段）与 state（recentFiles/scrollPositions）。
2. 写 `user/settings.json` 与 `state/state.json`（原子写）。
3. 旧文件保留，改名 `.migrated` 只用于避免二次判断？不——保留原名不动，靠 `user/settings.json` 是否存在判断，天然幂等。

## D8 不变量

- `AppConfig` 的 JSON 结构对外不变（前端零改动）。
- 任何失败路径都不产生部分写入。
- 快照目录的读取只接受 `settings-*.json`，拒绝路径穿越。
