# Tasks: 配置三层与快照回滚

> 本 change 只有一个交付任务（1 change = 1 issue = 1 PR）。

- [x] 1.1 配置三层 + 原子写 + 快照回滚 + 校验 + 热应用：把 `config.rs` 改成 defaults/user/state 三层，写入走临时文件 + rename，每次写前快照并只留 10 份，非法值拒写，外部改动 1 秒内热应用；旧 `app_config.json` 自动拆分迁移

  执行步骤：

  1. `config.rs`：`defaults_path` / `user_path` / `state_path` / `snapshots_dir`；`merge_json(defaults, user)`；`load_config` 走合并 + state 覆盖 + 迁移；`save_config` 走校验 → 快照 → 原子写 user/state。
  2. 校验：`validate_config(&AppConfig) -> Result<(), AppError>`，规则见 design §D5。
  3. 快照：`snapshot_user()`、`prune_snapshots(10)`、`list_snapshots()`、`restore_snapshot(name)`。
  4. 命令：`commands/config_cmd.rs` 暴露 `list_config_snapshots` / `restore_config_snapshot`；`lib.rs` 注册。
  5. 热应用：`lib.rs` 启动后 spawn 轮询任务，变化时 `emit("config-changed")`。
  6. 前端：`src/hooks/useConfig.ts` 监听 `config-changed` 并重载（不弹窗、不打断编辑）。
  7. 测试：Rust 单测覆盖合并优先级 / 原子写失败不变 / 校验拒写 / 快照保留 10 / 恢复先快照 / 迁移拆分；`npm test` + `tsc` 保持绿。
  8. 验证：`cargo test`、`tsc`、`npm test`、`verify.sh`；`npm run tauri dev` 手改 `user/settings.json` 的主题观察 1 秒内生效。
