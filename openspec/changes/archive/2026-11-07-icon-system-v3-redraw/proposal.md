## Why

18px 图标是页签、格头、菜单里的唯一线索，用户没有标签可依赖时只能靠形状判断动作。当前体系有五个具体问题：

- 分栏图标（右分/下分）只画「外框 + 中线」，陈述「有两格」但不陈述「新格在哪一侧」。
- 全屏后格头按钮仍是「进入全屏」形状（`PaneTreeView.tsx:550-565` 写死 `name="expand"`，`ICONS` 无 `collapse`），用户没有退出入口的心智。
- Markdown 文件图标用 `#` 替代 M，丢掉国际通用记号。
- 播放器自绘控件是 22px / stroke-2 的第二套图标语言（`VideoPlayer.tsx:92-97`），与全站 18/24 + 1.7 不一致。
- 可逆动作（全屏/退出、播放/暂停、静音/取消、钉住/取消）没有成对形状。

用户已在 `docs/design/explorations/icon-system-v3/icon-system-v3-proto.html` 上逐格确认并批准 v3 小样（三主题 × 18px 全 PASS），具备落地条件。

## What Changes

1. **`IconDef` 双字段 + 描边渲染**：`{ d?: string; s?: string; label: string }`。`Icon.tsx` 对 `s` 渲 `fill="none" stroke="currentColor" strokeWidth=1.7`，对 `d` 保持实心；svg 根永远保留 `fill="currentColor"`；`color` prop 同步转发到 `stroke`。
2. **`ICONS` 表 v3 全量替换**：现有 33 个概念按已定案形状重绘；新增反向与媒体概念（`collapse`、`pinOff`、`volumeMute`、`play`、`pause`、`loopNone`/`loopSingle`/`loopPlaylist`、`subtitle`、`timestampNote`、`keyboardHints`、`pip`、`speed`、`home`、`immersive`）。
3. **状态对**：`expand`/`collapse`、`pin`/`pinOff`、`volume`/`volumeMute`、`play`/`pause`、循环三态；调用点按 next action 选，不给 `Icon` 加 state prop。
4. **全屏退出态接线**：`PaneTreeView` 在 `fullscreenPaneId === leafId` 时渲染 `collapse`，`aria-pressed` 与「退出全屏」文案同步。
5. **播放器图标统一**：新增 `iconSvg(name, size=22)` 序列化器；删除 `VideoPlayer` 本地 `ICONS` / `LOOP_ICONS`，自绘控件改用它；不覆盖 ArtPlayer 原生控件。
6. **规格同步**：修订 `navigation`「图标体系」（「universe-icon」裁定为静态 path 表，补状态对与描边语言）；`application-shell` G-7 补全屏退出的图标断言。

非 BREAKING：现有 `IconName` 字符串与公开 API 形状不变。

## Capabilities

### New Capabilities

（无。图标体系已有 canonical 归属，本次修改现有 requirement。）

### Modified Capabilities

- `navigation`: 「图标体系」requirement 从「统一为 universe-icon」改为「静态 path 表 + 描边语言 + 18/24 两档」，并补状态对（expand/collapse、pin/pinOff、volume/volumeMute、play/pause、循环三态）与描边/实心分工。
- `application-shell`: 「G-7 图标语义与全屏可用性」补全屏退出的图标断言——全屏中按钮 SHALL 渲染 `collapse` 且 `aria-pressed` 为真，再点回到 `expand`。

## Impact

- **前端代码**：`src/ui/icons.ts`（IconDef + ICONS 表 + IconName）、`src/components/Icon.tsx`（描边渲染与 color→stroke）、`src/components/Content/PaneTreeView.tsx`（全屏退出态）、`src/components/Content/VideoPlayer.tsx`（图标源统一）、`src/lib/paneHeaderMenu.ts` 与 `src/components/Grid/GridTile.tsx`（调用点按需）。
- **测试**：`e2e/icon-system.spec.ts`（计算 fill / path 数 / 像素签名，需处理描边栅格化）、`src/__tests__/lib/fileType.test.ts`（`d` 非空改为 `(d ?? s)`）、`src/__tests__/paneHeader.test.tsx`（菜单图标集合）；新增全屏退出、状态对、播放器用例。
- **规格**：`openspec/specs/navigation/spec.md`、`openspec/specs/application-shell/spec.md`。
- **依赖**：无新增运行时依赖；不引入图标库。
- **风险**：`e2e/icon-system.spec.ts:120-137` 像素签名用例克隆 svg 后强制 `fill="#000"` 且不设 stroke，纯描边图标会栅格化成空白、`coverage > 0.02` 失败——实现前须补 stroke 或显式豁免。
