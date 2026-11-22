# editor-foundation-batch1 需求四要素与输入包

- spec issue: https://github.com/jianxi-dev/clairis/issues/1334（当前 `needs-info`：对账确认后加 `ready-for-agent` 并拆票）
- 输入源：`docs/research/competitors/quiet-md-逆向学习总报告.md` §3.1「批次 1：地基加固」（2026-11-22）+ 域报告 `docs/research/competitors/quiet-md/editor-core.md` §8.2/§8.3
- 一手证据（本仓 HEAD `aa07e0e` 实读，非报告转述）：

| 证据 | 位置 | 观察 |
|---|---|---|
| 每键全文同步 | `src/components/Content/ContentArea.tsx:600-609` | `docChanged` → `doc.toString()` → `updateTabContent(tabId, content)`，每键全量写 store |
| store 全量替换 | `src/stores/index.ts:673-684` | `{ ...tabs, [tabId]: { ...tab, content, dirty: true } }`，订阅 `tab.content` 的组件每键重渲染 |
| 回灌整篇替换 | `src/components/Content/ContentArea.tsx:729-758` | effect 依赖 `tab?.content`；不一致即 `{ from: 0, to: len, insert }` + `addToHistory.of(false)` |
| 切页签清历史 | `src/components/Content/ContentArea.tsx:718-727` | `historyCompartment.reconfigure([])` → 再装 `history()` |
| 键位误绑 | `src/editors/setup.ts:93-94` | `Mod-[`→undo、`Mod-]`→redo，排在 `defaultKeymap` 之前，覆盖其 `indentLess/indentMore` |
| 保存读快照 | `src/App.tsx:206-236` | `handleSaveFile` 直接读 `activeTab.content`（无 flush 步骤） |
| 历史注解稀缺 | `src/editors/smart-input.ts` 全文 | 仅 1 处 `userEvent`（:804），其余结构 dispatch（标题升降、智能回车、缩进）无注解 |
| 默认键位 | `node_modules/@codemirror/commands/dist/index.js:1792` | `defaultKeymap` 本身已有 `Mod-[`→`indentLess` |
| ADR 0003 已裁定 300ms 防抖 | `docs/architecture/decisions/0003-store-debounce-300ms.md` | 300ms 为固化决策值；当前代码每键直写，ADR 未落地 |
| ADR 0004 store 只存纯文本 | `docs/architecture/decisions/0004-store-plain-text-not-editor-objects.md` | 内容为字符串、实例留在模块级 Map；本批修订号/写入者为纯数据元信息 |

## What（做什么）

1. **回灌收口**：store→编辑器同步只在页签/可见性首次装载时整篇灌入；同一页签后续内容变化按「写入者归属 + 修订号」最小 diff 应用，校验视图归属，杜绝旧闭包全文覆盖。
2. **输入节流**：键入时 store 内容快照 300ms 防抖 + 2s 截止；`dirty` 首键即置；保存/另存为/导出/打印/切页签/进预览/卸载前强制 flush（以 live view 为准）。
3. **键位纠偏**：移除 `Mod-[`/`Mod-]` 的 undo/redo 误绑，恢复 `defaultKeymap` 的减少/增加缩进语义。
4. **历史边界**：用户可感知变更带 `userEvent`；程序回灌不进历史但切断分组；结构命令（标题升降、列表缩进、智能回车、块转换）每意图一个独立 undo 步；补编辑器层 undo 不变量测试。

## Why（为什么）

- 每键全量 store 写把 CM6 的增量渲染抹平，是输入卡顿的第一来源，也是手柄/分栏/裁剪所有「偏移失效」类缺陷的放大器。
- 全文替换 + `addToHistory.of(false)` 产生「历史之外的文档状态」，是「内容突然丢失且撤不回」的直接机制；双面板同页签时还会互相回灌。
- `Mod-[` 被改绑后，用户习惯的「取消缩进」变成撤销——误触后要再撤销一次，体感即「撤销错乱」。
- 后续批次（手柄、裁剪、分栏、表格、块树）都建立在本批的同步与历史语义上；不先做，结构手术必翻车。

## Scope（范围）

- `src/components/Content/ContentArea.tsx`：updateListener、内容同步 effect、历史重置点。
- `src/stores/index.ts`：`updateTabContent` / `refreshTabContent` / 标题改写写回路径（`setTabTitle` 一带）。
- `src/App.tsx`：保存前 flush。
- `src/editors/setup.ts`：键位表。
- `src/editors/smart-input.ts` + 新增结构事务助手：标题升降、列表缩进、智能回车/退格、块转换。
- `src/__tests__/editor/` 与 `e2e/`：undo 不变量、同步协议、键位行为。

## Non-goals（范围外）

- 跨页签保留 undo 历史（报告 §8.3(c)2，需 tab 级 HistoryState，另立项）。
- 拖拽重排 `moveBlock` 的 `trimNewlines` 全文规范化收口（报告 §8.2(c)3，属批次 2 手柄改造）。
- 手柄/图片裁剪/分栏止血/表格/块树（批次 2-5）。
- 不给 `smart-input.ts` 全部 28 个 dispatch 补注解：本批只覆盖「结构命令」四类；其余按历史边界原则在后续票逐步收口。

## 输入契约（L-1 五条）

| 契约 | 落实 |
|---|---|
| 来源可追溯 | 每条需求可回指总报告 §3.1 条目号与域报告 §8.2/§8.3，上表列本仓 HEAD 行号 |
| 空白显式化 | 无未决空白：双面板镜像语义取「写入者归属 + 修订号」（D2），flush 点清单（D3）在 design 完整列出；不引用任何 `open-question` |
| 一手证据 | 上表 8 条为本仓源码实读；报告行号已按 HEAD 校正 |
| 冲突显式 | ① 报告条目顺序（1 节流 → 2 回灌）与机械安全相反：先节流会让旧快照回灌覆盖新输入，故执行顺序改为回灌先行（D1）；② 与未开工 change `editor-surface-batch20` 的 4.3「撤销键生效」相邻但不重叠：本批只移除 `Mod-[`/`Mod-]`，不动 `Mod-Z`（D7）；③ 与 ADR 0003 不冲突：300ms 保持不变，新增的 2s 截止写入新 ADR 0012，不 supersede 0003 |
| 验收锚点 | `openspec/changes/editor-foundation-batch1/anchors.md`（R-1…R-4，exact/state-machine），由 `cw-conformance.sh generate/lock` 锁定 |

## 设计取舍（详见 change design.md）

- **不做**「store 只存脏标记、消费者各自读 view」的结构改：预览/属性面板/搜索/导出的消费者太多，一次改完风险大于收益；本批取「节流快照 + flush 点」，把每键 O(doc) 降为每 300ms 一次。
- **不做**「同步 effect 只认 `tab.id`」的最小改：会丢掉双面板同页签的镜像，用户看到两个面板内容分叉；改取修订号协议。
- **不做**「`Mod-[` 直接移除不绑」：`defaultKeymap` 已有 `indentLess`，删掉覆盖条目即恢复常规语义，零新增绑定。
