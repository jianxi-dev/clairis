# Proposal: 第十四批真机走查（ui-polish-batch14）

## Why

用户 2026-11-10 第十四批真机走查报 14 项，已固化为 #597。核心损失分四类：

- **回归**：`#566` 重开——轮盘透明度仍是旧值，高亮块图标仍不随类型切换。
- **能力缺口**：MP3 被 PDF 渲染器接住（`FPDF_LoadMemDocument failed`）；视频全屏时间戳不可见、重启回到首个视频、多画中画不成立、页签无静音入口。
- **编辑手感**：macOS 前进/后退缺失；悬浮小窗编辑态显示源码；胶囊双层大胶囊功能不全；转换菜单缺图标且二级菜单不隐藏；任务图标误转高亮；列表同级转换不完整。
- **一致性**：弹窗中心未对齐按钮图标中心；提示延迟待确认。

## What Changes

1. **轮盘回归（#566）**：三层展开时轮盘本体透明度改为 90%；高亮块图标按当前类型取默认图标，覆盖值只在原类型生效。
2. **音频分流（#2）**：按 `fileKind` 把音频交给音频表面，不再进 PDF 渲染器；补齐播放/暂停与时长。
3. **视频核心（#1/#5/#14）**：全屏时间戳可见；播放列表记录当前项并在重启后恢复；取消列表顶部循环图标；页签名后加静音切换。
4. **视频布局与手势（#1）**：窄宽先挤按钮间距、到极限再缩图标；双指上下滑动左半调亮度、右半调音量；多视频各自画中画。
5. **编辑导航（#3）**：macOS 前进/后退支持 `cmd`/`ctrl`。
6. **悬浮小窗（#8）**：编辑态渲染富文本，不再显示源码。
7. **胶囊（#9）**：改为圆角矩形，承载轮盘全部功能，高频动作按最短点击路径排布。
8. **转换菜单与列表（#10/#11/#12）**：插入 CSS、缩进/对齐及子功能补图标；二级菜单可隐藏；修复任务图标误转高亮；同级列表转换并自动编号。
9. **一致性（#4）**：所有按钮弹窗以按钮图标中心对齐；`#6` 提示延迟标注 open-question，未确认前不排期。
10. **导出（#13）**：菜单顺序改为 word、mdpkg、图片、pdf、html、zip；PDF 导出复用 md-bundle 能力。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `editing`：轮盘透明度与高亮块图标、胶囊形态与功能、转换菜单与列表转换。
- `file-management`：音频分流、视频播放与手势、导出顺序与 PDF 复用。
- `application-shell`：编辑导航快捷键、悬浮小窗编辑态、弹窗对齐。

## Impact

- 代码：`src/editors/orchestration/{roulette-view,floating-toolbar,capsule-toolbar,block-menu,block-convert}.ts`、`src/editors/decorations/callout-emoji.ts`、`src/components/Content/{VideoPlayer,PdfViewer,FloatingPreview}.tsx`、`src/components/TabBar.tsx`、`src/lib/export/**`、`src/App.tsx`、`src/styles/{editor,player}.css`
- 测试：对应 e2e 扩展（`roulette-*`、`video-*`、`audio-*`、`export-*`、`floating-preview-*`）
- 数据面：本批不新增配置字段；沿用 `rouletteSectors` / `htmlToolbarItems` 等既有字段（六栏表见 design.md）
