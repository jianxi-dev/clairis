## ADDED Requirements

### Requirement: A-1 应用名与标识符

应用 SHALL 使用中文名「标月」、英文名 Biaoyue、标识符 `biaoyue`；bundle identifier SHALL 为 `dev.biaoyue.app`；桌面主窗口标题 SHALL 为「标月」。

#### Scenario: 窗口标题

- **WHEN** 用户以 `npm run tauri dev` 启动应用
- **THEN** 主窗口标题栏 SHALL 显示「标月」

#### Scenario: 构建标识

- **WHEN** 检查 `src-tauri/tauri.conf.json`
- **THEN** `productName` SHALL 为 `Biaoyue`，`identifier` SHALL 为 `dev.biaoyue.app`

### Requirement: A-2 配置目录迁移

应用 SHALL 在首次以新标识启动时迁移旧配置：当新配置目录缺少 `app_config.json` 且旧目录（`com.clairis.app`）存在可解析配置时，SHALL 复制到新目录并沿用；旧目录 SHALL 保持原样以便回滚；新目录已有配置时 SHALL NOT 覆盖。

#### Scenario: 旧配置迁移

- **WHEN** 新配置目录为空、旧目录存在 `app_config.json`
- **THEN** 应用 SHALL 读取旧配置并把它复制到新配置目录，旧文件 SHALL 保留

#### Scenario: 新配置优先

- **WHEN** 新配置目录已有 `app_config.json`
- **THEN** 应用 SHALL NOT 用旧配置覆盖它

### Requirement: A-3 调试桥与本地暂存命名

页面暴露的 e2e 调试桥 SHALL 使用 `__biaoyue_` 前缀（`__biaoyue_store__`、`__biaoyue_openFile__`、`__biaoyue_toggle_capture__`、`__BIAOYUE_MAIN_STORE__`、`__biaoyue_log__`）；快速捕获的本地暂存键 SHALL 为 `biaoyue_capture_fallback`，并 SHALL 能迁移旧键 `clairis_capture_fallback` 的内容。

#### Scenario: e2e 桥名

- **WHEN** 应用在浏览器中加载完成
- **THEN** `window.__biaoyue_store__` SHALL 可用，`window.__clairis_store__` SHALL 不存在

#### Scenario: 旧暂存键迁移

- **WHEN** 本地只有 `clairis_capture_fallback` 且 `biaoyue_capture_fallback` 缺失
- **THEN** 首次读取后 SHALL 把内容写入 `biaoyue_capture_fallback`

### Requirement: A-4 旧标识零残留

现存活代码、现行文档、构建与校验脚本 SHALL NOT 含旧品牌标识（`Clairis`、`渐晰`、`com.clairis.app`）；历史归档（`docs/archive/`、`docs/design/explorations/`）、迁移账本（`docs/MIGRATION-*.md`）、文档治理 allowlist token、`.omo/` 证据与旧名竞品研究文件名除外。

#### Scenario: 残留断言

- **WHEN** 在排除历史目录后检索 `Clairis|渐晰|com\.clairis\.app`
- **THEN** 除白名单文件外 SHALL 无命中
