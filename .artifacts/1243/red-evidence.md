# #1243 RED 证据（修复前）

## 失败用例
`e2e/doc-property-embed.spec.ts` → 「预览态：属性块宿主与预览纸面同宽同底（A/B 两态，#1243）」

```
Error: expect(received).toBe(expected)
Expected: true
Received: false
> expect(m!.insidePaper).toBe(true);
```

## 几何量（`.artifacts/1243/red-geometry.json`，视口 1200×800）

| 状态 | insidePaper | host left/width | paper left/width | host bg | paper bg |
| --- | --- | --- | --- | --- | --- |
| preview A | false | 0 / 1200 | 0 / 1200 | rgba(0,0,0,0) | rgb(251,250,248) |
| preview B | false | 0 / 1200 | 0 / 1200 | rgba(0,0,0,0) | rgb(251,250,248) |

- 宿主是 `.preview-content` 的**兄弟节点**（`.content-scroll > .doc-property-embed-preview`），不在纸面内。
- 默认配置下宽度恰好相等（两者都取 `--type-measure-wide` 的 1200 回退），但宿主背景透明，落在窗口底 `.content-scroll` 上，与纸面 `rgb(251,250,248)` 不同 → 视觉分裂。
- 一旦配置阅读宽度（`readerWidth`），纸面走 `editorThemeVars` 注入的 `--type-measure-wide = min(readerWidth+120,1400)`，而宿主在纸面外拿不到该变量，只能回退 1200 → 宿主比纸面窄（用户截图即此形态）。

## 截图
- `red-preview-A.png`：A 态预览，属性卡片悬在纸面上方、底色不同。
- `red-preview-B.png`：B 态预览，同样分裂。
- `red-edit-A/B.png`：编辑态面板与 `.cm-line` 已同宽（1080）同底，无分裂。

## 编辑态量测
| 状态 | panelW | lineW | embedW | contentW | panelBg | contentBg |
| --- | --- | --- | --- | --- | --- | --- |
| edit A | 1080 | 1080 | 1136 | 1200 | rgb(251,250,248) | rgb(251,250,248) |
| edit B | 1080 | 1080 | 1136 | 1200 | rgb(251,250,248) | rgb(251,250,248) |

编辑态宽度/背景已对齐，无需改动；保留断言作回归。
