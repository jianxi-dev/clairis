# Proposal: 第二批真机走查（ui-polish-batch15）

## Why

用户 2026-11-11 第二批 10 项反馈，落在七个表面：

- **播放连续性**：视频放完不接下一个；竖拍视频不转正、不随窗口适配。
- **轮盘可控性**：选区自动召唤无法关闭；没有开关快捷键；形态（圆心/整盘）不可配；不能拖动位置；动作靠肉眼找，没有搜索与快捷键提示。
- **一致性回归**：块对齐的 `:::` 作者标记直接露在 WYSIWYG 里。
- **音频**：页签喇叭不按文件独立；静音截断突兀；不识别同目录播放列表。
- **PDF**：按钮栏不能固定显示/隐藏。
- **外壳**：顶栏仍显示产品名与窗口按钮，且按钮落点未按左栏钉住状态区分，挤压第一个页签；左栏仍显示「阅读空间」。
- **细节**：轮盘历史缺剪切；颜色二级透明项看不清；栏目「更多操作」菜单右侧被裁。

## What Changes

1. 视频：播放结束自动下一个；按元数据旋转并适配窗口。
2. 轮盘：取消选区自动召唤；新增开关快捷键；新增默认形态配置；双击圆心切换形态；中键拖动并持久化位置。
3. 轮盘搜索：快捷键打开、按动作名过滤（含下级可动作）、去层级名去重、9 行上限、首个选中、滚动、快捷键列固定。
4. 提示信息：显示时长可配（秒，1 位小数）。
5. 块对齐：编辑态隐藏 `:::` 标记，源码态保留。
6. 音视频：页签喇叭按文件独立静音。
7. 音频：静音 1 秒收尾；播放列表扫描同目录。
8. PDF：按钮栏固定显示/隐藏开关 + 快捷键。
9. 顶栏：去产品名与窗口按钮区，按钮下移到栏目栏或左栏并按落点对齐首个页签；去左栏「阅读空间」标题。
10. 轮盘：历史补剪切（复制与前进之间）；颜色二级透明项提升可辨识度。
11. 栏目更多操作菜单：按窗口边界翻转，不越界。

## Capabilities

### New Capabilities

（无。）

### Modified Capabilities

- `application-shell`：顶栏元素与窗口按钮落点、左栏标题、栏目更多操作菜单边界。
- `configuration`：提示时长、轮盘开关快捷键、轮盘默认形态与位置。
- `reading`：视频连播与旋转适配、PDF 按钮栏固定显示/隐藏。
- `editing`：轮盘召唤/搜索/历史/配色、块对齐标记隐藏、音视频独立静音与音频淡出。

## Impact

- 代码：`src/components/{TitleBar,TabBar,Rail,SettingsView}.tsx`、`src/components/ai/**`、`src/components/Content/{VideoPlayer,PdfViewer,AudioPlayer}.tsx`、`src/editors/orchestration/{roulette,roulette-view,floating-toolbar,horizontal-toolbar}.ts`、`src/editors/decorations/{index,structuralTags}.ts`、`src/hooks/{useAiEntry,useConfig}.ts`、`src/stores/index.ts`、`src-tauri/src/config.rs`、`src/styles/{editor,app}.css`
- 测试：`e2e/{video-*,roulette-*,pdf-*,tab-*,settings-*}.spec.ts` 扩展与新增；单测覆盖搜索过滤与时长格式化。
- 数据：新增配置字段（提示时长 / 轮盘快捷键 / 默认形态 / 位置），走配置快照回滚。
