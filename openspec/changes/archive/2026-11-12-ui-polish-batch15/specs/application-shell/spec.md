# application-shell（delta）— ui-polish-batch15

## ADDED Requirements

### Requirement: 栏目更多操作菜单边界

栏目「更多操作」菜单 SHALL 按视口边界展开：右侧空间不足时向左翻转，下方不足时向上翻转，SHALL NOT 被窗口裁切；窗口缩放后 SHALL 重新计算。

#### Scenario: 收窄窗口不越界
- **WHEN** 用户把窗口收窄到菜单放不下后打开栏目更多操作菜单
- **THEN** 菜单完整可见，右缘越出视口像素为 0；缩放后仍不越界且无残留浮层（A-11.1）

## MODIFIED Requirements

### Requirement: G-3 无品牌顶栏（内容贴顶）

应用外壳 SHALL NOT 渲染品牌顶栏：窗口内容区上方 SHALL NOT 出现一条只承载产品名「标月」的横条。产品级入口（网格概览 / AI / 主题 / 沉浸）SHALL 全部位于底部状态栏右侧，顺序保持 网格概览 / AI / 主题 / 沉浸。首个分栏的页签条 SHALL 直接贴内容区顶缘，其上 SHALL NOT 存在空白带或占位横条。

窗口控制按钮（关闭 / 最小化 / 最大化）SHALL 由原生标题栏绘制且随内容贴顶：左栏未钉住时按钮 SHALL 落在左侧栏目页签栏区域，第一个页签的内容起点 SHALL 相应右移避让、SHALL NOT 被按钮压住；左栏钉住时按钮 SHALL 落在左边栏区域，第一个页签 SHALL 回到左缘原位。左侧边栏 SHALL NOT 显示「阅读空间」标题。

#### Scenario: 顶部无品牌横条

- **WHEN** 应用处于任何非沉浸状态
- **THEN** 窗口顶部 SHALL NOT 出现只含「标月」品牌文字的横条，首个分栏的页签条 SHALL 直接贴内容区顶缘

#### Scenario: 沉浸入口只留图标

- **WHEN** 审查状态栏右侧的沉浸入口
- **THEN** 该按钮 SHALL 只渲染图标，SHALL NOT 含「沉浸」文字；其可访问名（`aria-label` / `title`）SHALL 仍说明「沉浸阅读」

#### Scenario: 顶栏不再含主题区图标

- **WHEN** 审查顶栏 DOM
- **THEN** 顶栏 SHALL NOT 含 `data-testid="grid-entry"` / `data-ai-entry` / 主题切换 / `data-testid="immersive-entry"` 四个入口

#### Scenario: 未钉住时的按钮与页签
- **WHEN** 左栏未钉住，用户打开任意文档
- **THEN** 顶栏产品名文本长度为 0；窗口按钮位于栏目页签栏区域；第一个页签左缘与按钮右缘间距 ≥2px（A-9.1–A-9.2、A-9.4）

#### Scenario: 钉住时的按钮与页签
- **WHEN** 左栏钉住，用户打开任意文档
- **THEN** 窗口按钮位于左栏区域；第一个页签左缘回到原位（偏差 ≤2px）；左栏不含「阅读空间」文本（A-9.3–A-9.5）
