## ADDED Requirements

### Requirement: 含图片文档可滚动回顶部

预览中含图片（含裁剪属性、大尺寸图、以图片语法引用的视频）的 Markdown 文档 SHALL 能从任意滚动位置回到文档开头：向上滚动与把滚动条拖到顶端两种方式 SHALL 都能到达 `scrollTop = 0`，且文档首行 SHALL 进入视口。图片加载完成导致内容高度变化时 SHALL NOT 使可达的顶部位置丢失。图片裁剪在预览中的显示宽度 SHALL NOT 超过内容容器宽度，高度 SHALL 按裁剪矩形比例缩放。

#### Scenario: 滚轮回顶

- **WHEN** 用户把含图片文档滚到底部，再用滚轮/触控板持续向上滚动
- **THEN** 滚动容器的 `scrollTop` SHALL 到达 0，且文档第一个内容块 SHALL 进入视口

#### Scenario: 滚动条回顶

- **WHEN** 用户把含图片文档的滚动条拖到最上端
- **THEN** 滚动容器的 `scrollTop` SHALL 为 0，且文档第一个内容块 SHALL 可见

#### Scenario: 图片加载后仍可回顶

- **WHEN** 文档图片在打开后异步加载完成、内容高度增大
- **THEN** 用户仍 SHALL 能滚动到 `scrollTop = 0`，顶部位置 SHALL NOT 被图片加载挤掉

#### Scenario: 裁剪图不超出容器

- **WHEN** 文档图片带 `crop` 属性且裁剪宽度大于预览容器宽度
- **THEN** 图片渲染宽度 SHALL ≤ 容器宽度，高度 SHALL 保持裁剪矩形比例
