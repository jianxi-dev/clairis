# Proposal: 扩展点（数据文件优先，P0）

## Why

`docs/research/technical/plugin-management-benchmark.md` 对标了 DeepSeek Harness（Cordis 时空可组合性）、Pi（TS 进程内扩展、无沙箱）、Obsidian（核心/社区双轨 + Restricted Mode）、Omarchy（扩展点 = 数据文件），结论是：**Clairis 不需要插件市场式的管理界面，需要的是数据文件扩展点 + 双轨与安全门 + 卸载回滚纪律**，且 P0 阶段完全不引入代码级插件 API。

现状：`text-config-layer` 已落地三层配置与「内置 / 用户覆盖 / 运行时生成」目录三分的前提，但没有任何用户可扩展的数据文件入口——斜杠命令写死在代码里、新建页只有空文档、主题只能改内置 token。

## What Changes

P0 只做三件「放一个文件到某个目录」就能生效的事：

1. **snippets**：`~/.config/clairis/snippets/*.md` → 斜杠菜单的额外命令（frontmatter 声明 id/label/keywords/icon，正文即插入文本）。
2. **templates**：`~/.config/clairis/templates/*.md` → 新建页模板（文件名即模板名，`{{date}}` / `{{title}}` 占位）。
3. **theme tokens**：`~/.config/clairis/theme.toml` → 覆盖内置 token（白名单校验，非法键忽略并告警）。
4. **核心能力开关**：统一 `enable()/disable()` 幂等接口，默认全开，入口放在设置深处，无常驻 UI。

明确不做（P1/P2，等真实需求）：代码级插件、manifest 安装、信任门、市场、远程分发。

## Capabilities

### New Capabilities

- `extensions`：数据文件扩展点（snippets / templates / theme tokens）与核心能力开关。

### Modified Capabilities

<!-- 无 -->

## Impact

- Rust：`src-tauri/src/config.rs` 增目录扫描与文件读取（复用现有 config 目录解析），`commands/config_cmd.rs` 暴露 list/read。
- 前端：`src/editors/slash.ts` 注入用户命令；新建页流程读模板；`src/styles/tokens.css` 合并用户 token。
- 测试：目录扫描/格式校验/占位替换/白名单/开关幂等的单测；模板与 snippet 的 e2e。
- 风险：中低。数据文件不执行代码，最坏情况是「命令没出现」或「token 被忽略」。
