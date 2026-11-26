# #1559 QG-5 证据纪要（editor-surface-batch23/1.1）

验证基于 HEAD: `feat/b1-crop-cleanup-sync`（工作区未提交改动；源基线 origin/main 46541863）
采集时间: 2026-11-26

## 自动化验证原始输出

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 退出 0，无输出 |
| `npm test` | Test Files 180 passed (180) / Tests 2250 passed (2250) / Duration 31.58s |
| `npx playwright test e2e/editors/crop-cleanup-sync.spec.ts --timeout=60000` | 3 passed (16.2s) |

## 多态证据（.artifacts/1559/state-coverage.json，4 态全 passed）

| 态 | 截图 | 机检断言（原始值） |
|---|---|---|
| crop-open | state-1-crop-open.png | handles=8, shades=4（探针 `expect({handles,shades})` 通过） |
| crop-saved | state-2-crop-saved.png | 文档 content 中 `crop=l,t,w,h` 计数 = 1 |
| multi-round-clean | state-3-multi-round-clean.png | 5 轮裁剪后 frames=0, handles=0, shades=0, active=0 |
| loaded-immediate | state-4-loaded-immediate.png | 已加载图片点裁剪后 frame 计数 = 1（无等待） |

## 视觉探针复核（cw-vision.sh describe，原始输出摘录）

态 1 截图核验：
- 四角直角括号形角标：**有**
- 四边短条手柄：**有**
- 裁剪框覆盖在图片上：**是**
- 工具条：**可见**（AI / 裁剪 / 旋转 / 设置 / 对齐 / 删除）
- 蒙层：视觉模型判「无压暗」——符合预期：初始裁剪框贴合整图边界，无框外区域可压暗；4 块 shade 节点存在但尺寸为 0（DOM 断言 shades=4）

## 未能自动化的项（显式声明，不冒充已验证）

- **WKWebView 合成层残影**（用户 #3 反馈的 4 条深灰短横线）：headless Chromium 无该合成缓存问题，自动化测不出。本票给了真机生效机制（filter blur(0px) 在 frame.remove() 之前 + 1px 回弹保留），**需真机 `npm run tauri dev` 连续裁剪 5 次确认残影消失**。此项待用户点验。
