# #1562 QG-5 证据纪要（editor-surface-batch23/2.1）

验证基于 HEAD: `feat/b4-toolbar-scroll-hide`（工作区未提交；源基线 origin/main 21a7b8d5）

## 自动化验证原始输出
| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` | 2252 tests 全过 |
| `npx playwright test e2e/editors/toolbar-scroll-hide.spec.ts e2e/editors/crop-cleanup-sync.spec.ts --timeout=120000` | 6 passed (5.6s) |

## 运行时状态采样（探针原始输出）
```
EV1 selected:      flex                 ← 选中图片，工具条可见
EV2 scrolling:     none/is-scrolling    ← 连续滚轮期间 display:none + is-scrolling
EV3 restored:      flex                 ← 停滚后复位可见
EV4 bottom:        flex                 ← 滚到底后（该探针文档较短，图片仍在视口内）工具条仍正确显示、不误消失
```

## 多态证据（.artifacts/1562/state-coverage.json，4 态 passed）
selected-visible / scrolling-hidden / stop-restored / scrolled-to-bottom-aligned

## 「滚出视口消失」的验证归属
由 e2e 用例「图片滚出视口后工具条消失且选中态清除」覆盖（长文档 + 30 次滚轮）：
`expect(getByTestId("img-toolbar").count()).toBe(0)` + `[data-selected='true']` 计数 0。
（探针态 4 因文档较短不构成该场景，已如实更名为「滚到底仍对齐」，不冒充。）

## 实现要点
- scroll 监听：document 捕获 → 选中图所在 `.cm-scroller` + `{ passive: true }`
- 滚动期：80ms 防抖 + `is-scrolling`（CSS `display:none`），滚动期不执行位置重算
- 停滚：防抖到期后一次 `positionToolbar()` 复位
- 视口判定：IntersectionObserver 替代逐帧 getBoundingClientRect 夹取
