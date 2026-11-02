# Design: 扩展点（P0）

> 三条决定都服从同一个前提：**扩展点 = 数据文件，不执行用户代码**（研究文档建议 2；doctrine D6「扩展点 = 数据文件」）。代码级插件（Pi 形态 + Obsidian 安全门）留到 P1，先有真实需求再上。

## D1 目录与优先级

沿用已落地的三层配置：

| 层 | 路径 | 行为 |
|---|---|---|
| 内置默认 | 应用资源内 `defaults/` | 升级整体覆盖，用户不可改 |
| 用户覆盖 | `~/.config/clairis/{snippets,templates}/`、`theme.toml` | 升级永不触碰；同名覆盖内置 |
| 运行时生成 | `~/Library/Application Support/clairis/` | 缓存/索引，可随时重建 |

扫描只读用户层；内置层随包发布。两层合并时**用户优先**，冲突按 `id`（snippets）或文件名（templates）判定。

## D2 snippets 格式

```markdown
---
id: weekly-review
label: 周报模板
keywords: [zhoubao, weekly]
icon: DocTextOutlined
---
## 本周

- 完成：
- 阻塞：
```

- `id` 必填、`[a-z0-9-]+`，全局唯一；缺 `id` 或格式非法 → 该文件跳过并在设置里列出原因，不影响其它文件。
- `label` 缺省用 `id`；`keywords` 用于斜杠过滤（与现有拼音过滤叠加）。
- 正文原样插入光标处；插入走现有 `insertCommandTextAt`，保证单事务、可撤销。
- 扫描失败（目录不存在/权限）不是错误，返回空列表。

## D3 templates 格式

- `~/.config/clairis/templates/*.md`，文件名（去扩展名）即模板名。
- 占位符仅两个：`{{date}}` → `YYYY-MM-DD`，`{{title}}` → 新文件名（不含扩展名）。未知占位符原样保留（不报错，避免吞掉用户内容）。
- 新建页选择模板后写入内容；不做变量对话框（P0 零门槛）。

## D4 theme token 覆盖

- 文件 `~/.config/clairis/theme.toml`，形如 `[tokens]` + `accent = "#c2410c"`。
- **白名单**：只接受 `src/styles/tokens.css` 已声明的 `--app-*` 名；未知键忽略并聚合一条告警（不逐个弹窗）。
- 值只允许 `#rgb`/`#rrggbb`/`rgb()/rgba()`/`hsl()` 与具名色；其它值忽略。防止把 `url()` 之类塞进 CSS 变量。
- 应用方式：在 `:root` 后追加一段 `<style>`（或同等机制）覆盖变量，不修改内置 CSS 文件；删除文件后刷新即恢复默认。

## D5 核心能力开关

- 每个内置能力（数学渲染、代码高亮、图表水合、图片缩放…）实现 `{ id, enable(), disable() }`，默认全开。
- `enable/disable` 必须幂等：重复调用不重复注册监听、不重复挂 DOM。
- 入口：设置 → 高级 → 能力，无常驻 UI、无弹窗、无红点（服从 D3「最少干扰」）。
- 关闭某能力 = 移除其扩展/监听，**不删用户数据**。

## D6 明确不做

代码插件、manifest、信任门、市场、远程分发、热重载。理由：P0 没有真实需求；引入代码执行会把「零门槛 + 离线单文件」的信条打穿。
