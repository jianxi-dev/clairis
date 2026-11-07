# 需求四要素 — icon-system-v3-redraw

> spec issue：https://github.com/jianxi-dev/clairis/issues/290
> 来源：用户 2026-11-07 逐格确认并批准的 v3 图标小样 `docs/design/explorations/icon-system-v3/icon-system-v3-proto.html` + 已批准 draft `.omo/drafts/icon-system-v3.md`。
> 一手证据：三主题全页截图 `.omo/evidence/task-7-{light,dark,warm}.png`（1280×2981 一致）+ 逐格判读 `docs/design/explorations/icon-system-v3/PROTOTYPE-QA.md`（56 行 PASS）。

## What

把已批准 v3 图标体系落进产品代码，约 49 个概念，拆成六个可独立验收的切片：

1. **`IconDef` 双字段 + 描边渲染**：`{ d?: string; s?: string; label: string }`；`Icon.tsx` 对 `s` 渲 `fill="none" stroke="currentColor"`，对 `d` 仍走实心；svg 根永远保留 `fill="currentColor"`；`color` prop 同步转发到 `stroke`。
2. **`ICONS` 表 v3 全量替换**：现有 33 个概念按已定案形状重绘；新增反向/媒体概念（`collapse`、`pinOff`、`volumeMute`、`play`、`pause`、`loopNone`/`loopSingle`/`loopPlaylist`、`subtitle`、`timestampNote`、`keyboardHints`、`pip`、`speed`、`home`、`immersive`）。
3. **状态对**：`expand`/`collapse`、`pin`/`pinOff`、`volume`/`volumeMute`、`play`/`pause`、循环三态；调用点按 next action 选，不给 `Icon` 加 state prop。
4. **全屏退出态接线**：`PaneTreeView` 在 `fullscreenPaneId === leafId` 时渲染 `collapse`，`aria-pressed` 与「退出全屏」文案同步。
5. **播放器图标统一**：新增 `iconSvg(name, size=22)` 序列化器；删除 `VideoPlayer` 本地 `ICONS` / `LOOP_ICONS`，自绘控件改用它；不覆盖 ArtPlayer 原生控件。
6. **规格同步**：修订 `navigation`「图标体系」requirement 与 `application-shell` G-7（补全屏退出的图标断言）。

## Why

- 18px 是页签、格头、菜单的唯一线索；当前分栏图标只陈述「有两格」，不陈述「新增在哪一侧」。
- `PaneTreeView.tsx:550-565` 写死 `name="expand"`，`ICONS` 无 `collapse`，全屏后用户没有退出入口的心智。
- `Icon.tsx:27-45` 只渲 `<path fill=currentColor>`；v2 提案里的 `fill="none" stroke=…` 会被当实心填充渲染成色块——这是 v3 必须先解决的架构问题。
- `VideoPlayer.tsx:92-97` 硬编码 22px / stroke-2 的第二套图标语言，与全站 18/24 + 1.7 不一致。
- 可逆动作没有成对形状，学一次不能会两次。

## Scope

- 前端：`src/ui/icons.ts`、`src/components/Icon.tsx`、`src/components/Content/PaneTreeView.tsx`、`src/components/Content/VideoPlayer.tsx`、`src/lib/paneHeaderMenu.ts`、`src/components/Grid/GridTile.tsx`（按实际调用点）。
- 规格：`openspec/specs/navigation/spec.md`（图标体系）、`openspec/specs/application-shell/spec.md`（G-7）。
- 测试：`e2e/icon-system.spec.ts`、`src/__tests__/lib/fileType.test.ts`、`src/__tests__/paneHeader.test.tsx`，以及新增的全屏退出 / 状态对 / 播放器用例。
- 设计产物：`docs/design/explorations/icon-system-v3/`（原型 + QA 保留为探索历史）。

## Non-goals

- 不引入图标库（lucide / universe-icon / sprite / mask-CSS / 构建步骤）。
- 不改图标以外的视觉语言（圆角、阴影、间距、字体、布局）。
- 不覆盖 ArtPlayer 原生控件图标。
- 不重排页签、格头、播放器控件布局。
- 不新增 20px 档（18/24 两档；播放器序列化器 22 是既有例外）。
- 不改现有 `IconName` 字符串（`e2e/rail-cards.spec.ts` 断言 `[data-icon="html"]`）。
- 不在本 change 内批量改写 `docs/design/approved/`（文档迁位 deferred）。

## 需求输入门（L-1 五契约）

| 契约 | 状态 | 证据 / 处置 |
|---|---|---|
| 来源可追溯 | ✅ | draft `.omo/drafts/icon-system-v3.md`（approved 2026-11-07）；原型 `icon-system-v3-proto.html`；QA `PROTOTYPE-QA.md` |
| 空白显式化 | ✅ | 见下方「未决项」，以 `open-question` 标注并阻断对应规格条目 |
| 一手证据 | ✅ | 三主题全页截图 `.omo/evidence/task-7-{light,dark,warm}.png`；逐格判读 56 行 PASS |
| 冲突显式 | ✅ | `navigation` 规格「统一为 universe-icon」vs draft A5「不引入图标库」；裁定见 spec issue #290 Implementation Decisions 8 |
| 验收锚点 | ✅ | `PROTOTYPE-QA.md` 四问结论；`e2e/icon-system.spec.ts` 现有断言（计算 fill / path 数 / 像素签名） |

### 未决项（open-question）

1. **`prev` / `next` 是否采用「描边竖线 + 实心三角」混合模式**：draft D6 允许，但需要两段路径（`d` + `s`）。阻断 `ICONS` 表媒体条目的最终坐标，实现前须定。
2. **`loopNone` 的 0.45 透明度归属**：当前裁定由播放器控制项 class 承担、不进 path；若播放器未使用该 class 则退化为全不透明。阻断循环三态的视觉验收。
3. **`navigation` 规格「universe-icon」措辞修订的落点**：本 change 的 delta spec 修订，还是另开 change。阻断 G4 的 `/opsx-sync`。
