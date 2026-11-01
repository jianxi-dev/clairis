# Design: 全库改名 标月 / Biaoyue

## 决策

### D1 名称映射（唯一转换表）

| 旧 | 新 | 位置 |
|---|---|---|
| 渐晰 | 标月 | 中文显示名、窗口标题、UI 文案 |
| Clairis / `clairis` | Biaoyue / `biaoyue` | 英文名、包名、crate、日志、调试桥前缀 |
| `com.clairis.app` | `dev.biaoyue.app` | bundle identifier、配置目录 |
| `__clairis_*` | `__biaoyue_*` | e2e 调试桥 |
| `clairis_capture_fallback` | `biaoyue_capture_fallback` | 快速捕获本地暂存键 |

### D2 历史不追溯

`docs/archive/`、`docs/design/explorations/`、`docs/MIGRATION-*.md`、`.omo/` 证据、`docs/research/competitors/渐晰-vs-*` 保留旧名。原因：它们是历史记录；且文档治理 allowlist 把 `docs/CORE-REQUIREMENTS-clairis.md` 等旧路径登记为 intentional-history token，改名会打穿 `npm run docs:check`。

### D3 配置目录迁移

bundle ID 变化会让 `app.path().app_config_dir()` 从 `com.clairis.app` 变为 `dev.biaoyue.app`。迁移只在新目录缺少 `app_config.json`、旧文件可读且可解析时执行：复制到新目录并沿用；旧文件保留以便回滚；新目录已有配置时不覆盖。迁移函数接受显式路径，便于单测。

### D4 调试桥同步改名

`__clairis_store__` / `__clairis_openFile__` / `__clairis_toggle_capture__` / `__CLAIRIS_MAIN_STORE__` / `__clairis_log__` 与 e2e mock、软著截图脚本一次改齐，不留两套名字。

### D5 不在本 change 内的改动

GitHub 仓库名与 git remote（仍 `jianxi-dev/clairis`）、域名注册与商标申请、界面布局与交互（C8）、文档体系重构（C10）。

### D6 软著材料

软件全称 `标月阅读编辑软件`，简称 `标月`；与代码内品牌一致。

## 风险与回滚

- 配置目录变化影响既有本地数据 → 迁移 + 保留旧目录；失败时回退默认配置而非崩溃。
- 桥接名变化同时影响 e2e 与软著截图脚本 → 同批改动并由两套 e2e 验证。
- 文档大面积替换可能触发治理门禁 → 历史路径 token 用占位符保护，改完跑 `npm run docs:check`。
