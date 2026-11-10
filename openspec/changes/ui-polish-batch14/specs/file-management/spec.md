# file-management（delta）— ui-polish-batch14

## ADDED Requirements

### Requirement: 音频文件走音频表面

系统 SHALL 按文件类型把音频（mp3/wav/m4a/flac/ogg）交给音频播放表面，不得进入 PDF 渲染器。

#### Scenario: 打开 MP3

- **WHEN** 用户打开一个 mp3 文件
- **THEN** 页面不出现 `.pdf-*` 节点，音频控件可见且可播放（A-2.1–A-2.2）

### Requirement: 视频全屏时间戳与播放列表记忆

系统 SHALL 在全屏播放时仍显示时间戳浮层；记录播放列表当前项并在重启后恢复；播放列表顶部不渲染循环按钮；页签名后提供静音切换。

#### Scenario: 全屏、重启与静音

- **WHEN** 用户全屏播放、播放到列表第 2 项后重启，或点击页签喇叭
- **THEN** 时间戳可见、当前项恢复为第 2 项、循环按钮数量为 0、`audio.muted` 翻转为 true（A-3.1–A-3.4）

### Requirement: 视频窄宽降级与手势

系统 SHALL 在播放器宽度收窄时先压缩按钮间距、到极限再按比例缩小图标，保证全部按钮可见；双指上下滑动左半调亮度、右半调音量；多个视频各自拥有独立画中画容器。

#### Scenario: 收窄、手势与多画中画

- **WHEN** 用户把播放器收窄到阈值、执行双指手势，或同时开启两个视频画中画
- **THEN** 按钮溢出数为 0 且图标尺寸下降；亮度/音量分别变化；两个画中画容器同时存在（A-4.1–A-4.3）

### Requirement: 导出菜单顺序与 PDF 导出

系统 SHALL 按 word、mdpkg、图片、pdf、html、zip 的顺序渲染导出菜单，并提供 PDF 导出（复用 md-bundle 能力）。

#### Scenario: 菜单顺序与 PDF

- **WHEN** 用户打开导出菜单并点击 PDF
- **THEN** 菜单文本序列与约定一致，PDF 文件生成或给出可读错误（A-10.1–A-10.2）
