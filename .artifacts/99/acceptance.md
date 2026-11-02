# E1b 1.5 全量验收记录（2026-11-03）

## 1. 自动化门禁

`bash scripts/verify.sh` → **ALL CHECKS PASSED**

| 步骤 | 结果 |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ |
| ESLint (`eslint src/ --max-warnings 50`) | ✅ |
| Unit tests (vitest) | ✅ 71 files / 897 tests |
| CSS manifest | ✅ 83 declared / 153 defined（扫描根已扩到 `src/editors/`） |
| Docs governance + `openspec validate --all` | ✅ 17 items |
| Playwright（`e2e/`） | ✅ 119 passed |
| Playwright（`playwright.tauri.config.ts`） | ✅ 51 passed |

## 2. 三入口（e2e 覆盖，Chromium 真实渲染）

| 入口 | spec | 结果 |
|---|---|---|
| 斜杠 `/` | `e2e/slash-menu.spec.ts`（6 条：打开/过滤/应用/Esc/退格） | ✅ |
| 空行「+」 | `e2e/block-handle.spec.ts`「空行「+」打开插入菜单」 | ✅ |
| 块菜单「在下方添加」 | `e2e/block-menu.spec.ts`（十项 + 在下方添加可见） | ✅ |

## 3. 红线

- **红线 1（源码无损）**：`e2e/block-menu.spec.ts`「点「一级标题」」断言转换后整篇内容严格等于
  `# 标题\n\n# 第一段正文\n\n第二段正文\n`——只有目标块首行前缀变化，其余字节逐一相同。
- **红线 5（显示=源码）**：同文件「红线 5」用例断言源码首行为 `# 第一段正文`，
  预览里对应 `h1` 的 `textContent` 为 `第一段正文`（标记不进入可见文本）。

## 4. `ui-gap-and-target.md` 对照

| 条目 | 状态 | 证据 |
|---|---|---|
| §2.2 手柄 42×26 两段药丸 | ✅ | `e2e/block-handle.spec.ts` 断言宽 ≥40 / 高 ≥24；`block-handle.ts` 定量 |
| §2.11 hover 召唤 | ✅ | `HoverGate` 300ms 延迟 + `block-menu` pointerenter 即 push |
| §2.11 离栈即收 | ✅ | `menuStack` 统一 pop；`scheduleBlockMenuClose` 150ms 宽限 |
| §2.11 视口夹取 / 翻转 | ✅ | `resolvePlacement`（7 条单测覆盖四象限 + 夹取 + 封顶） |
| §2.11 滚动消退 | ✅ | `scrollDismiss` 按作用域 `closeScope`；e2e「滚动即收」 |
| §2.11 展开缓冲 | ✅ | 菜单 `pointerenter` 取消待关闭定时器 |
| §4 块菜单 236px / 行高 32px | ✅ | `BLOCK_MENU_WIDTH=236`、`BLOCK_MENU_ROW_HEIGHT=32` |
| §4 按块型裁剪 | ✅ | `blockMenuItems`：代码块去掉「代码」，表格/分割线不给转换项 |
| §4 顶端对齐块顶 | ✅ | `positionPanel` 用行顶作为 `top` |
| §4 插入菜单三入口共用 | ✅ | 斜杠 / 「+」 / 「在下方添加」均走 `openInsertMenu` |
| §4 色板字体色 9 + 背景色 16 | ✅ | `FONT_COLORS`(9) / `BACKGROUND_COLORS`(16) + 默认格斜线 |
| §4 图标 `svg data-icon` | ✅ | `renderIcon` 统一出口 |

## 5. 未覆盖（需要人在场）

- `npm run tauri dev` 原生窗口的手动点击走查：agent 无法操作原生窗口，
  本轮以 Chromium 内同一套 DOM/事件路径 + 上述 e2e 代替。原生菜单项
  （「设置…」/「放大」等）仍建议维护者点一遍。
