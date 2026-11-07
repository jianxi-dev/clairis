# Tasks: 图标体系 v3 批量重绘

> 垂直切片：每条任务做完都能在页面上看到结果；prefactor 单独成条并显式标注 `no-ui-impact`。
> 依赖：1 → 2 / 3 / 4；4.1 → 4.2；1.2 与 3.2 → 5。
> 坐标来源：`docs/design/explorations/icon-system-v3/icon-system-v3-proto.html` 的 `ICONS` 注册表（用户已逐格确认）。执行者从原型抄坐标，不凭记忆重画。

## 1. 契约 prefactor（无用户可见变化；`no-ui-impact`）

- [x] 1.1 `src/ui/icons.ts`：`IconDef` 改为 `{ d?: string; s?: string; label: string }`（二者至少其一），现有 33 概念原样迁入 `d`；`src/__tests__/lib/fileType.test.ts` 的 `d.length > 0` 同步改为 `(d ?? s)` 非空断言。
  判据：`npx tsc --noEmit` 通过；`npm test -- fileType` 通过。
  标注：prefactor，`no-ui-impact`。

- [x] 1.2 `src/components/Icon.tsx`：`s` 渲 `fill="none" stroke={color ?? "currentColor"} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"`；`d` 保持实心；svg 根保留 `fill="currentColor"`。
  判据：新增单元测试断言 `s` 图标的 `<path>` 有 `fill="none"` 与 `stroke`；`e2e/icon-system.spec.ts` 现有 5 用例仍通过。
  标注：prefactor，`no-ui-impact`。

## 2. 文件类型族（用户可见：页签 / 卡片 / 门户磁贴）

- [x] 2.1 按原型注册表重绘 markdown / html / text / pdf / video / image / code / audio；外壳统一为圆角纸片（无折角），markdown 用粗 M。同时修 `e2e/icon-system.spec.ts:120-137` 像素签名用例：克隆后同时设 `stroke="#000"`，保留 8 类型签名校验（不缩减采样）。
  判据：类型色 / path 数 = 1 / `M` ≥ 2 断言全绿；8 个签名 hash 互不相同、`coverage > 0.02`；临时把某个图标换成空 path 应红。

## 3. 动作与布局族（用户可见：格头 / ⋯菜单 / 设置 / 顶栏）

- [x] 3.1 重绘通用动作：folder / file / search / grid / pin / pinOff / chevronLeft / chevronRight / sun / moon / monitor / close / settings（7 齿圆头齿轮 + 内孔）/ more / eye / pencil / export / share / locate / copyPath / check / warning / sparkle / immersive。
  判据：图标抽屉列出全部；`src/__tests__/paneHeader.test.tsx` 菜单图标集合不变。

- [x] 3.2 重绘分栏与全屏族：splitRight / splitDown（双格·新格虚线，间距 3 单位）、expand / collapse（四角括号成对）。
  判据：expand 与 collapse 的 `d` 不相等；分栏入口图标在 `e2e/pane-drag.spec.ts` / `e2e/grid-overview.spec.ts` 可见。

## 4. 媒体族 + 播放器换源（用户可见：播放器控制条）

- [x] 4.1 重绘媒体概念：play / pause / prev / next / volume / volumeMute / playlist / loopNone / loopSingle / loopPlaylist / subtitle / timestampNote / keyboardHints / pip / speed / home；play/pause 实心，其余描边；循环三态用笔画角标（不用 `<text>`）。
  判据：`grep '<text' src/ui/icons.ts` 无输出；图标抽屉列出全部媒体概念。

- [x] 4.2 `src/ui/icons.ts` 新增 `iconSvg(name, size = 22): string`（与 `Icon.tsx` 同规则读 `ICONS`），并让 `src/components/Content/VideoPlayer.tsx` 删除本地 `ICONS` / `LOOP_ICONS` 改用它；循环三态具名化，`innerHTML` 换图标机制保留。
  判据：单元测试断言描边/实心两种返回字符串的关键属性；播放器 e2e 断言控制条图标 `data-icon` 与 18px 尺寸；暗底截图像素覆盖率 > 0.02。
  接线归属：`VideoPlayer.tsx` 自绘控件（同条完成，不留白）。

## 5. 状态对接线（用户可见：格头按钮 expand ↔ collapse）

- [x] 5.1 `src/components/Content/PaneTreeView.tsx`：`fullscreenPaneId === leafId` 时渲染 `collapse`，否则 `expand`；`aria-pressed` 与 `title`/`aria-label`「退出全屏」同步。
  判据：新增 e2e 真实点击，断言 `data-icon` 从 `expand` → `collapse` → `expand`，`aria-pressed` 同步。
