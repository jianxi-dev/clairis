# #1561 QG-5 证据纪要（editor-surface-batch23/1.3）

验证基于分支 `feat/b3-reset-button`（源基线 origin/main d27b5c6a）

## 自动化验证
| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` | 全绿 |
| `npx playwright test image-reset-button + image-toolbar-reset + crop-cleanup-sync` | 9 passed (6.3s) |

## 三态计算样式采样（原始输出）
```
EV1 无 crop 选中:   display=none    ← 按钮 DOM 常驻但不可见
EV2 裁剪确认后:     display=flex    ← 出现
EV3 重置后再次选中: display=none    ← 回到不可见
```

## 多态证据（.artifacts/1561/state-coverage.json，4 态 passed）
no-crop-hidden / crop-open / has-crop-visible / after-reset-hidden

## 实现要点
- 判据：选中图 widget 内是否存在 `.image-crop-window`（有 crop 才渲染），不重新解析文档
- 刷新点：selectImage / moveImageSelection / notifyImageCropState / positionToolbar
- 按钮 DOM 常驻，只切 `display`，不重建工具条
- 放大层 `img-max-clear-crop` 同口径

## 既有测试适配（非弱化）
`e2e/image-toolbar-reset.spec.ts` 两处：重置后改断言 `toBeHidden`（crop 已清，符合新规格）；未裁剪用例从「点击无副作用」改为「按钮不可见」，保留 display 计算样式断言。
