# #1678 裁剪/视口跳动断言

## 机读断言（自动化）

```
// mode-scroll-anchor.spec.ts —— 预览↔编辑按内容锚恢复
const anchor = await topText(page, "edit");
expect(anchor.length).toBeGreaterThan(4);
await setMode(page, "preview");
expect(await topText(page, "preview")).toContain(anchor.slice(0, 4));
await setMode(page, "edit");
expect(await topText(page, "edit")).toContain(anchor.slice(0, 4));
```

```
// image-crop-quiet.spec.ts —— 裁剪写回后零残留（既有守卫，确认未回归）
await expect(page.locator(".cm-image-crop-frame")).toHaveCount(0);
await expect(page.locator(".image-crop-window")).toHaveCount(0);
```

## 人工验收（真机，headless 不可复现）

Scenario 1 首裁：长文档中部图片 → 首次进入裁剪并确认 → 视口不跳（±2px）
Scenario 2 多图：3 张图逐张确认裁剪 → 每次确认后视口不跳
Scenario 3 点击文本：任意时刻点击正文 → 光标落在点击处、不出现大范围选中、视口不跳
Scenario 4 模式切换：编辑态滚到某段 → 切预览 → 切换后仍是同一段

## 实现要点

- `pinScroll` / `pinScrollDuringWrite` 增加 `pointerdown` 全局让位：窗口内用户一旦按下就不再改 scrollTop（否则 CM6 会把按下点到抬起点之间连成选区）
- `writeImageAttributes`（裁剪/尺寸写回）复用同一钉住策略
- 模式切换锚点从「滚动比例」改为「顶部可见文本」（跳过空行与纯图片行，清理 markdown 语法）

## 二轮（r2）追加

```
// mode-scroll-anchor.spec.ts —— 反复切换 3 轮不跳顶部
for (let round = 0; round < 3; round += 1) {
  await setMode(page, "preview");
  expect(await topText(page, "preview")).toContain(anchor);
  await setMode(page, "edit");
  expect(await scrollTop()).toBeGreaterThan(100);   // 未跳顶部
  expect(await topText(page, "edit")).toContain(anchor);
}
```

实现要点（本轮）：
- `.cm-scroller { overflow-anchor: none }`：关闭浏览器原生滚动锚定（首抖根因——内容高度变化时 WKWebView 自动拉回 scrollTop）
- 编辑态往返改用**像素位置记忆**（同一渲染高度最精确），文本锚仅作无记忆时的回退
- 恢复期标记：程序性 scroll 不覆盖锚点（消除逐轮漂移）

## 三轮（r3）：真机日志定位

真机日志（`中汽系统搭建情况对称1110.md.crop-debug.log`）关键片段：

```
crop-enter @129460  (scrollTop 2400, cropFrames 1)
JUMP 132014: 2400 → 1974        inputs: pointerup:cm-image-crop-frame,
                                        click:cm-image-crop-frame,
                                        pointerdown:cm-line, mousedown:cm-line
crop-confirm @132098  scrollBefore:1974   ← 确认时位置已被污染
```

结论：抖动发生在 **crop-confirm 之前**，由 `pointerdown:cm-line` 触发 CM6 落光标 + caret 揭示滚动。
根因：`suppressCaret` 只监听 `mousedown`，而 CM6 在 **`pointerdown`** 阶段就处理了。

修：
- `suppressCaret` 同时挂 `pointerdown`（capture，裁剪框/图片控件放行）
- 模式恢复增加「布局就绪轮询」（scrollHeight 可用后落位，成功即停，≤1200ms，用户操作即让位）

## 四轮（r4）：预览容器塌陷

真机日志（第二轮）：

```
JUMP 155385: 3780 → 0     scroller content-scroll, docH 7487 → 767
JUMP 157758:    0 → 3123  docH 767 → 7440
JUMP 159228: 3123 → 0     docH 7440 → 767
```

切换瞬间预览容器内容高度塌陷，浏览器把 scrollTop 夹成 0，渲染完成后才回位 → 用户看到「先跳到顶部再回来」。

修：`restoreScrollWhenReady` 改为**容量感知**——容器容得下目标位置才落位（塌陷期等待，高度恢复立即落位，成功即停，用户操作让位）。
（尝试过的 min-height 顶住方案会干扰预览尺寸计算，已回退。）

裁剪侧：本轮日志确认会话内已无 `pointerdown:cm-line` 跳（上一轮修复生效）；剩余抖动来自内容高度小幅变化（docH 8971 ↔ 8917），待下一轮定位。
