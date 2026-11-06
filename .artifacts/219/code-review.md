# Code Review — #219（reading-surface-refine 6.1）

- 审查者：Atlas（写者 = Sisyphus-Junior/LongCat-2.5，跨模型验证分离）
- 基于 HEAD：origin/main = cf159f5 + 工作区改动（分支 feat/reading-surface-refine-6.1）
- 验证原始输出：tsc exit 0；eslint 0 errors（39 既有 warnings）；vitest 100 files/1293 tests 全过；e2e quick-open+shortcuts 13 passed（本会话亲跑）；QG-5 探针五断言+四截图全过；cw-vision describe 视觉复核四态全确认
- 语义变化：⌘P/Ctrl+P 由「直接开网格」改为「打开快速打开」（票面要求）；网格保留 ⌘⇧\ 与顶栏入口（回归断言）

## Standards 轴

| 检查项 | 结论 |
| --- | --- |
| 逻辑逐行复核 | ✓ App.tsx 拦截段（meta+!shift+KeyP+!isComposing → preventDefault+toggle）、quickOpenOpen 让位守卫、⌘⇧\ 保留段逐行读过 |
| 闭包时效 | ✓ 全局 keydown effect 依赖数组含 quickOpenOpen（App.tsx:602），无过期闭包 |
| 分层防抢键 | ✓ QuickOpen 键盘在 window capture 阶段拦截并 stopPropagation（ShortcutOverlay 同范式）；仅 Esc/↑↓/Enter，字母键直落输入框 |
| 输入法安全 | ✓ App 层 isComposing 守卫 + QuickOpen 层 isComposing 守卫双保险，有单测 |
| 反模式扫描 | ✓ 无 as any/@ts-ignore/console.log/TODO/死代码 |
| token 体系 | ✓ --app-* token、z-[70] 与现有浮层层级一致、rounded-lg |
| 范围纪律 | ✓ diff 限于 App.tsx + 新组件 + 测试 + e2e；未触碰 #215-#218 域；无新增依赖 |

## Spec 轴（逐条对照票面 AC）

| AC | 实现 | 证据 |
| --- | --- | --- |
| Ctrl+P 打开 quick-open | App 全局层接管 | vitest 5 例（真实 App 渲染 + KeyboardEvent）+ e2e 用例 1/2 + 探针态 01 |
| 原生打印不触发 | preventDefault；window.print/beforeprint spy | e2e 计数 0 + 探针态 01（print 调用 0） |
| 页签/最近/命令三类 | buildQuickItems 纯函数（title+path 大小写不敏感子串、recent 与 tab 同路径去重） | vitest 12 例 + 探针态 01（三组齐） |
| 命令：网格、设置 | commands 数组 + Enter/点击执行 | e2e 用例 4 + 探针态 03（设置界面打开） |
| 输入过滤+高亮 | 过滤 + <mark> 高亮 | e2e 用例 3 + 探针态 02（q219 → 单行） |
| 网格入口可见 | ⌘⇧\ 与顶栏按钮未动 | e2e 用例 7（回归）+ 探针态 04 |

## 结构审查（risk-medium pre-landing）

- SQL：无 — 不适用
- LLM 信任边界：无新增注入面 — 不适用
- 条件副作用：toggle 语义（已开再按关闭）；面板打开期间其余全局快捷键让位，关闭即恢复 — 通过
- scope drift：e2e/shortcuts.spec.ts 的 ⌘P 断言更新是被改行为的既有用例跟随 — 通过

## 测试真实链路复核（QG-4）

vitest 渲染真实 App 并派发真实 KeyboardEvent（断言 preventDefault 调用与 print/beforeprint 计数）；e2e 真实按键+计算样式；未发现「元素存在」级断言。✓

## 未决项

无（0 未决）。

留痕：mock 的 `__biaoyue_openFile__` 不把 title 传给 tab（tab 标题由文件名派生），同路径 recent 项被去重——探针初版按 H1 词过滤落空属种子设计问题，非实现缺陷；已在探针中改用文件名子串并留此记录。

## 验证原始输出（2026-11-06 补齐）

- `npx tsc --noEmit` → exit 0，无输出
- `npx eslint src/` → 0 errors，39 warnings（均为既有，非本次引入）
- `npm test` → Test Files 101 passed (101)，Tests 1301 passed (1301)
- `npx playwright test e2e/quick-open.spec.ts` → 11 passed
- `npx playwright test e2e/quick-open.spec.ts e2e/shortcuts.spec.ts e2e/app.spec.ts e2e/portal.spec.ts` → 35 passed，1 skipped（app.spec 的 tab 右键菜单在 web 模式无页签，既有 skip）
