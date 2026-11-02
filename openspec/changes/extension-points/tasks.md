# Tasks: 扩展点（P0）

> 1 change 分 4 批，每批一个 PR。数据文件不执行代码，任何一批失败都只影响该扩展点本身。

- [x] 1.1 目录约定与扫描：Rust 侧解析 `~/.config/clairis/{snippets,templates}`、读取 `theme.toml`，暴露 `list_extensions` 命令；目录缺失返回空列表；单测覆盖解析失败/缺字段/权限错误
- [ ] 1.2 snippets 接入斜杠菜单：frontmatter 解析（id/label/keywords/icon）、用户命令并入 `defaultCommands`、插入走单事务；单测 + e2e（放一个 snippet 后 `/` 能搜到并插入正文）
- [ ] 1.3 templates 与主题 token：新建页模板选择 + `{{date}}`/`{{title}}` 替换；`theme.toml` 白名单合并与非法值忽略；单测 + e2e（模板新建页、token 覆盖生效）
- [ ] 1.4 核心能力开关与验收：`enable/disable` 幂等接口 + 设置深处入口（无常驻 UI）；全量验收（单测 + `verify.sh` + 手动走查 + 文档更新）
