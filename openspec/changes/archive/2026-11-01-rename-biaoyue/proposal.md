# Proposal: 全库改名 标月 / Biaoyue（C1）

## Why

旧名「渐晰 / Clairis」的商标路径已经走死：中文名「渐晰」与组合名「渐晰 Clairis」两件注册均被国家知识产权局驳回（依据《商标法》第十条第一款第（七）项、第三十条），复审无胜算。2026-10-31 维护者定名 **标月 / Biaoyue**（标识符 `biaoyue`，简写 BY，域名 `biaoyue.app` / `.dev` / `.me`，bundle ID `dev.biaoyue.app`）。

定名已锁，但仓库里旧名仍活在 100+ 个文件里：应用标识（`package.json` / `Cargo.toml` / `tauri.conf.json`）、运行时桥接（`__clairis_store__` 等）、配置目录（`com.clairis.app`）、测试夹具、CI/脚本、现行文档与软著材料。任何后续 change（C2 配置层、C3 AI、C8 布局…）都在这些标识上施工，改名越晚，返工面越大。这是路线图 M0 的第一件事。

## What Changes

- **应用标识**：npm 包名、Rust crate 与 lib 名、Tauri `productName`、bundle identifier、窗口标题、CI/构建输出名统一为 标月 / Biaoyue / `biaoyue` / `dev.biaoyue.app`。
- **配置目录迁移**：bundle ID 变化会让配置目录从 `com.clairis.app` 变为 `dev.biaoyue.app`。首次以新标识启动时，若新目录无 `app_config.json` 而旧目录有，自动复制一份过去并继续使用；旧目录保持原样，保留回滚路径。
- **前端桥接与本地状态**：e2e 调试桥（`__biaoyue_store__` / `__biaoyue_openFile__` / `__biaoyue_toggle_capture__`）、主窗口桥（`__BIAOYUE_MAIN_STORE__`）、日志器桥（`__biaoyue_log__`）、快速捕获本地暂存键（`biaoyue_capture_fallback`）、PDF 打印样式标记、日志前缀、图标组件名一并改名；暂存键保留读取旧键的迁移分支。
- **文档与脚本**：仓库根文档（README / AGENTS / CONTEXT / CHANGELOG）、`docs/` 现行域（product / architecture / design/approved / design/system / delivery / research / agents / governance）、`openspec/specs/` 与 `openspec/config.yaml`、`scripts/` 与软著材料改名；命名登记档案重写为标月版本并保留商标驳回史。
- **仓库卫生**：`.gitignore` 补 `.lavish/` 与 gbrain 自动生成的本地目录。

## Capabilities

### New Capabilities

- `app-identity`：应用名、标识符、配置目录与调试桥的命名契约，以及旧标识的零残留判据。

### Modified Capabilities

<!-- 无：本 change 不改任何界面行为规格。 -->

## Impact

- **代码**：`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/src/main.rs`、`src-tauri/src/config.rs`（迁移逻辑）、`src-tauri/src/commands/*`（测试临时目录名）、`index.html`、`src/main.tsx`、`src/App.tsx`、`src/stores/*`、`src/utils/log.ts`、`src/components/*`、`e2e/**`。
- **测试**：`src/__tests__/captureOverlay.store.test.ts` 跟随暂存键改名；e2e 桥名同步改；`config.rs` 新增旧目录迁移单测；新增一条「页面标题为 标月」的 e2e 断言。
- **文档**：约 100 个文件的品牌串替换；`docs/delivery/CLAIRIS-NAMING-REGISTRATION.md` → `docs/delivery/BIAOYUE-NAMING-REGISTRATION.md`。
- **风险**：中。bundle ID 与配置目录变化会影响已有本地数据（用迁移 + 保留旧目录兜底）；桥接名变化会同时影响 e2e mock 与软著截图脚本，需同步改；历史归档与迁移账本不动，避免破坏文档治理 allowlist。
- **非目标**：不改 GitHub 仓库名（仍 `jianxi-dev/clairis`）与 git remote；不做域名注册/商标申请；不改界面布局与交互（C8）；不重构文档体系（C10）；不替换历史归档、设计探索稿、迁移账本与 `.omo/` 证据里的旧名。
