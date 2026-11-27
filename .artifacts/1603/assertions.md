# #1603 二轮（真机取证后）证据纪要

真机证据：中汽系统搭建情况对称1110.md.crop-debug.log（2026-11-27 13:12）+ 两张截图

## 签名 → 根因 → 修复
| 签名 | 根因 | 修复 |
|---|---|---|
| JUMP 1293→909 / 1796→1423（向上 ~380px，紧跟 pointerdown:cm-line） | 裁剪态 suppressCaret 白名单放行 .cm-scroller → 光标落位 caret 揭示滚动 | 白名单移除 .cm-scroller（模态会话点框外=确认路径） |
| 截图整套裁剪 UI 残影（DOM 计数 0） | WKWebView GPU 合成层未刷新；scroller filter 不足以清子层缓存 | 子层 filter 先行 + 恢复 1px 回弹 + scroller filter（三重） |
| 「重置图片」ExpandOutlined 与全屏撞形 | 四角外扩=全屏观感 + 与 fileEmbed 展开同图标 | 新增 UndoOutlined（撤销箭头） |
| 「+ 调整后回 100%」守卫未挡 | 写入者静态不可见 | DEV 探针 [maximize-probe] 记录调用栈 + 守卫容差 ±0.001 |

## 验证
- tsc 0；vitest 2265 全过；e2e 15 passed（1 flaky=CDP wheel 抖动，3 次重跑全绿，DQ-4 机制解释：非确定性损坏）

## 真机待验
1. 裁剪态点框外不再上跳（log 签名应消失）
2. 裁剪后蒙层/框残影是否消失（组合拳）
3. 「+ 调整后回 100%」复现时看 dev console `[maximize-probe]` 调用栈 → 定位写入者后精准修
4. UndoOutlined 观感

## 机读断言摘录（e2e 原始 expect）

```
// crop-jump-measure.spec.ts（A 跳动·进入态）
expect(Math.abs(p3.scrollTop - p2.scrollTop)).toBeLessThanOrEqual(1);
expect(Math.abs(afterFresh)).toBeLessThanOrEqual(1);

// maximize-zoom-persist.spec.ts（D 缩放保持）
expect(Math.max(...postZoomSamples)).toBeGreaterThan(1.1);
expect.poll(() => readScale(page), { timeout: 4000 }).toBeGreaterThan(1.1);

// maximize-button-order.spec.ts（C 图标区分）
expect(paths.rotate).not.toBe(paths.reset);

// crop-cleanup-sync.spec.ts（B 残留 DOM 计数）
expect(residue).toEqual({ frames: 0, handles: 0, shades: 0, active: 0 });
```

Scenario 对照：editing spec E-44「清理可靠性」（多轮裁剪零残留 / 已加载图片标识线必现）与「裁剪缩放不跳变」；真机专属项（WKWebView 合成层 / caret 揭示）以探针输出承载（headless 不可复现，见各条说明）。

## 三轮（连击/显隐/蒙层淡出）机读断言摘录
```
// maximize-zoom-persist.spec.ts（连击±不再回 100%：dblclick target 判定）
expect(await readScale(page)).toBe(1.21);          // 连击后不回落
await page.mouse.dblclick(box.x + 20, box.y + 20);
expect(await readScale(page)).toBe(1);             // 双击图片/背景仍复位（D16）

// maximize-button-order.spec.ts（hover 显隐）
expect(await controlsOpacity(page)).toBe("0");     // 默认淡出
// pointerenter 后
expect(await controlsOpacity(page)).toBe("1");     // 进入浮层显示

// crop-cleanup-sync.spec.ts（shade 淡出后零残留）
expect(residue).toEqual({ frames: 0, handles: 0, shades: 0, active: 0 });
```
Scenario 对照：放大层交互（D16 双击复位 / hover 显隐为用户方案新增）；真机蒙层残影以截图 + 淡出方案承载。


## 四轮（真机反馈二）机读断言摘录
```
// caption-save-visibility.spec.ts（描述保存：一次性标志替代固定窗口）
expect(page.locator('[data-testid="img-caption-input"]')).toHaveCount(1);
await expect.poll(() => content(page)).toContain('"诊断描述"');
expect(page.locator('[data-testid="img-caption"]')).toHaveText("诊断描述");

// maximize-button-order.spec.ts（hover 显隐纯 CSS：inline opacity 移除）
const op = await controls.evaluate(el => getComputedStyle(el).opacity);
expect(op).toBe("0");           // 默认淡出
// hover 后
expect(op).toBe("1");           // 浮层悬停显示

// maximize-zoom-persist.spec.ts（dblclick target 判定）
expect(await readScale(page)).toBe(1.21);  // 连击±不回落
expect(await readScale(page)).toBe(1);     // 双击图片仍复位
```
Scenario 对照：描述保存（#1602 既有验收）；放大层 hover 显隐（用户方案）；shade 淡出（裁剪蒙层2.png 残影）。

## 四轮（r4 commit 9f846487）机读断言摘录
```
// caption-save-visibility.spec.ts（描述保存：一次性标志）
expect(page.locator('[data-testid="img-caption-input"]')).toHaveCount(1);
await expect.poll(() => content(page)).toContain('"诊断描述"');
expect(page.locator('[data-testid="img-caption"]')).toHaveText("诊断描述");

// maximize-button-order.spec.ts（hover 显隐纯 CSS，inline opacity 已移除）
expect(await controls.evaluate(el => getComputedStyle(el).opacity)).toBe("0");
expect(await controls.evaluate(el => getComputedStyle(el).opacity)).toBe("1");

// maximize-zoom-persist.spec.ts（dblclick target 判定）
expect(await readScale(page)).toBe(1.21);
expect(await readScale(page)).toBe(1);

// crop-cleanup-sync.spec.ts（shade rAF 淡出后零残留）
expect(residue).toEqual({ frames: 0, handles: 0, shades: 0, active: 0 });
```
Scenario 对照：描述保存（#1602 验收）；放大层 hover 显隐（用户方案 #1603）；shade rAF 淡出（裁剪蒙层2.png 残影）；连击 ±（用户复现描述）。

## 五轮（toggle 语义澄清 + class 根治）机读断言摘录
```
// caption-save-visibility.spec.ts（保存后保持展开：captionVisible=true）
expect(page.locator('[data-testid="img-caption"]')).toBeVisible();
expect(page.locator('[data-testid="img-caption"]')).toHaveText("诊断描述");
// 按钮选中态
expect(page.locator('[data-testid="img-toolbar-comment"]')).toHaveClass(/is-active/);
// toggle 收起（点按钮二次）
expect(page.locator('[data-testid="img-caption"]')).toBeHidden();

// maximize-button-order.spec.ts（hover 显隐：class 命中前置断言）
expect(document.querySelector(".img-max-controls") ? 1 : 0).toBe(1);
expect(await controls.evaluate(el => getComputedStyle(el).opacity)).toBe("0");
expect(await controls.evaluate(el => getComputedStyle(el).opacity)).toBe("1");
```
Scenario 对照：描述区显隐切换（产品规格：默认隐藏，按钮为切换）；放大层 hover 显隐（用户方案）。

## 七轮（r7 c304845a→1634）机读断言摘录
```
// caption-save-visibility.spec.ts（描述写回挂 click 同步路径）
expect(page.locator('[data-testid="img-caption-input"]')).toHaveCount(1);
await expect.poll(() => content(page)).toContain('"诊断描述"');
expect(page.locator('[data-testid="img-caption"]')).toHaveText("诊断描述");

// decorations-blocks.test.ts（未修改时点外部照常取消选中——吸收条件收紧）
expect(widget.dataset.selected).toBe("false");

// maximize-button-order.spec.ts（热区显隐）
expect(await controls.evaluate(el => getComputedStyle(el).opacity)).toBe("1");  // 热区 enter
expect(await controls.evaluate(el => getComputedStyle(el).opacity)).toBe("0");  // 热区 leave
```
Scenario 对照：描述保存（#1602/#1603 全轮验收）；放大层按钮条显隐（用户「滑入按钮区域」语义）。
