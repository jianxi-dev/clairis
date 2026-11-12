# #666 轮盘召唤、默认形态、双击切换与中键拖动 — 验证记录

日期：2026-11-12（本地时间）

## 交付验收锚点（spec #660 / tasks 2.1，delta: 轮盘召唤与动作搜索 A-2.1）

| 锚点 | 断言 | 结果 |
|---|---|---|
| A-2.1a | 选中文字不自动弹轮盘（节点数 0） | PASS（e2e 选中→400ms→0 节点） |
| A-2.1b | 按开关快捷键节点数 1；默认 hub 形态可见扇区 0 | PASS（e2e：Meta+Shift+Space → 1 节点 + data-form=hub + 扇区:visible=0） |
| A-2.1c | 双击圆心切整盘 | PASS（e2e + cw-vision 复核 8 扇区环形布局） |
| A-2.1d | 中键拖动中心变化，重载后位置保持 | PASS（e2e：拖动后 root left/top 变化 + roulettePosition 落配置 + reload 后按快捷键回到同一位置逐字节相等） |
| A-2.1e | 关闭后无残留节点 | PASS（e2e：再按快捷键 → 0 节点） |

## 数据面（design.md §数据面 四落点全闭环）

- 存储：AppConfig 新增 roulette_hotkey / roulette_form / roulette_position + RoulettePosition 结构（serde camelCase + default + skip_serializing_if），cargo 测试含老配置缺省 None 回归。
- 校验：validate_config 拒绝非法形态（白名单 hub|disk）与非有限/越界位置（check_range -20000..20000，NaN/Inf 均拒）。
- 桥接：useConfig 三处一致补齐，非法形态/位置 normalize 回 null。
- 消费：floating-toolbar 读配置（hotkey/form/position），roulette-view 消费 form + onMove/onFormChange 回写。

## 语义边界（与规格逐条核对）

- 轮盘：只由显式入口召唤（delta「轮盘 SHALL 只由显式入口（开关快捷键 / 圆心等）召唤」）。
- 胶囊：**保留**「选中文字即现」——主规格两条 requirement（A-3.1–A-3.6、A-7.1–A-7.2）未被本 delta 修改，仍在生效。scheduleShow 恢复为 capsule-only。
- 快捷键只在编辑态生效，输入框/textarea/contenteditable（非编辑器）不触发；再按一次关闭（toggle）。

## 回归（全部亲测）

- `npx playwright test e2e/floating-toolbar e2e/selection-pill e2e/tooltip-pill`：28 passed
- `npx playwright test e2e/block-menu e2e/block-toolbar e2e/html-source-roulette e2e/html-text-roulette`：57 passed / 1 skipped
- `npx playwright test e2e/capsule- e2e/selection-capsule e2e/roulette-`：36 passed / 4 skipped（含 5 条新 #666 用例）
- `npx vitest run`：123 文件 / 1526 用例全过
- `npx tsc --noEmit` / `bash scripts/css-manifest-check.sh` / `npx eslint`（改动文件 0 error）通过
- `cargo test`：126 passed（含 2 条新配置测试）；`cargo check` 通过

## 实现要点

- 配置：roulette_hotkey（缺省 "Mod+Shift+Space"，shortcuts.ts 已核无冲突）/ roulette_form（hub|disk，缺省 hub）/ roulette_position（屏内像素）。
- floating-toolbar：删除轮盘自动弹出；document keydown 匹配配置快捷键 → show()（位置 = 配置 clamp 到视口，缺省 = 选区锚点）；再按 = 关闭；onMove/onFormChange 写回配置。
- roulette-view：form 状态 + applyForm（data-form + form-hub 类隐藏 sr-root-layer/sr-labels）；hub click 的 detail>=2 判双击（先回退误触的格式刷再切形态并写回）；中键（button===1）document 级拖动 → setCenter → 松手 onMove；destroy 全部监听清理。
- 既有 e2e 对齐：9 个 spec 的「选中即弹」断言改为「快捷键召唤 + hub 双击切盘」，旧 90ms 时序断言改写为三段新事实断言，无断言削弱。
