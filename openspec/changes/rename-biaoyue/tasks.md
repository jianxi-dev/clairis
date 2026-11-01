# Tasks: 全库改名 标月 / Biaoyue

> 本 change 只有一个交付任务（1 change = 1 issue = 1 PR，见 `.omo/wayfinder/HANDOFF.md` §10）。下面是一个任务内的执行清单，不拆子票。

- [x] 1.1 全库改名：应用标识、配置目录迁移、前端桥接与本地状态、e2e、文档与脚本、软著材料全部换成 标月 / Biaoyue，并以 `git grep` 断言现存代码与现行文档零旧标识残留（历史归档与 allowlist token 除外）

  执行步骤：

  1. 应用标识：`package.json` / `package-lock.json` 名称、`src-tauri/Cargo.toml` 包名与 lib 名、`main.rs`、`tauri.conf.json` 的 productName / identifier / 窗口标题、`index.html` 标题。
  2. 配置目录迁移：`config.rs` 新增旧目录读取与复制，附两条单测（迁移 / 不覆盖）。
  3. 前端桥接与本地状态：`__biaoyue_*`、`__BIAOYUE_MAIN_STORE__`、`__biaoyue_log__`、`biaoyue_capture_fallback`（含旧键迁移）、PDF 打印标记、日志前缀、图标组件名。
  4. e2e 与夹具：mock 桥与两套 spec 同步改名；`e2e/fixtures/mini.pdf` 同长字节替换；新增页面标题断言。
  5. 文档与脚本：根文档、`docs/` 现行域、`openspec/specs/`、`openspec/config.yaml`、`scripts/`、软著材料；命名登记档案重写并保留商标驳回史；历史归档不动。
  6. 仓库卫生：`.gitignore` 补 `.lavish/` 与 gbrain 本地目录。
  7. 验证：`npx tsc --noEmit`、`npx eslint src/`、`npm test`、CSS manifest、`cargo test`、`npm run docs:check`、两套 Playwright；`npm run tauri dev` 手动确认窗口标题与配置沿用。
