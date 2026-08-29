---
title: "渐晰 Clairis 主题色系统 v6 归档"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
superseded_by: ../README.md
redirect: docs/design/explorations/theme/README.md
---

# 渐晰 Clairis 主题色系统 v6 归档

归档日期: 2026-07-12  
对应原型: `./clairis-themes.html`  
主题范围: 6 套核心主旋律主题，另附 1 套实验纸质主题

## 设计目标

渐晰的主题不按“颜色皮肤”组织，而按阅读、写作和灵感场景组织。主题要服务正文，避免变成代码编辑器式的机械深色、游戏 UI 式的霓虹强调色，或普通网页式的装饰配色。

核心原则:

- 清晰: 正文对比稳定，长时间阅读不刺眼。
- 安静: 强调色只做引导，不抢正文。
- 仪式感: 每套主题有明确的纸面、光线和空间想象。
- 轻未来感: 深色保留低光空气感，避免纯黑和赛博霓虹。
- 场景化: 用户选择的是写作状态，而不是单纯换色。

## 共用 Token 结构

每套主题使用同一组 CSS 变量:

```css
--bg           页面背景
--surface      面层 / 顶栏 / 侧栏
--s2           次级面层
--s3           高位面层
--fg           正文
--fg-dim       次级文字
--muted        弱提示文字
--border       分割线
--accent       主题强调色
--soft         选中态 / 柔性强调底色
--glow         低光发光色
--sel          hover / selected 背景
--paper        正文纸面
--shadow       主题投影
--frost-*      磨砂外壳参数
--grain-opacity 页面颗粒强度
--fd           标题字体
--fb           UI 字体
--fc           内容字体
```

深色主题的背景亮度控制在 `L=14%~16%` 左右。它们不是纯黑，而是有色相、有空气、有层次的低光纸面。

## 核心主题总览

| Key | 名称 | 角色 | 最佳场景 | 主气质 |
| --- | --- | --- | --- | --- |
| `clairis-light` | 清曜 Light | 默认 / 白天工作 | 全天候写作 | 冷青微光、清晰纸面 |
| `clairis-night` | 清曜 Night | 默认 / 全天候 | 夜间写作 | 墨蓝低光、温柔聚焦 |
| `linen-paper` | 亚麻 Paper | 长读 / 资料 | 长文阅读 | 未漂白亚麻、自然暖光 |
| `amber-study` | 暖烛 Study | 研究 / 深读 | 夜读研究 | 暗褐书房、蜂蜜金灯 |
| `ink-jade` | 松烟 Ink Jade | 写作 / 专注 | 深夜长写作 | 冷灰松烟、青玉微光 |
| `aurora-field` | 极光 Field | 灵感 / AI | 灵感整理 | 靛紫磁场、极光青边 |

## 1. 清曜 Light

CSS key: `clairis-light`  
角色: 默认 / 白天工作  
最佳场景: 全天候写作  
气质描述: 清晨纸面、冷青微光、清晰而不刺眼。

设计意图:

清曜 Light 是白天默认主题。它需要足够干净，但不能像普通白底文档一样无性格。背景采用极浅冷灰青，正文纸面接近白色，强调色使用低饱和冷青，形成“清醒但不冰冷”的工作状态。

核心 token:

```css
--bg:oklch(96% .006 230);
--surface:oklch(99% .003 230);
--s2:oklch(92% .010 230);
--s3:oklch(87% .014 230);
--fg:oklch(24% .010 235);
--fg-dim:oklch(45% .012 235);
--muted:oklch(61% .010 235);
--border:oklch(88% .012 230);
--accent:oklch(50% .085 210);
--soft:oklch(91% .035 210);
--paper:oklch(100% 0 0);
```

质感策略:

- 不启用明显磨砂，保持白天工作界面的稳定性。
- `grain-opacity` 很低，只提供轻微纸面密度。
- 适合作为默认浅色主题和办公环境主题。

## 2. 清曜 Night

CSS key: `clairis-night`  
角色: 默认 / 全天候  
最佳场景: 夜间写作  
气质描述: 夜间清醒、墨蓝纸面、温柔聚焦。

设计意图:

清曜 Night 是品牌主视觉深色主题。它避免纯黑，用墨蓝低光承接夜间阅读和写作。层级不是机械加亮，而是从 `bg` 到 `surface` 到 `s3` 逐步变成更可感知的蓝灰空间。

核心 token:

```css
--bg:oklch(15% .024 250);
--surface:oklch(19% .026 250);
--s2:oklch(23% .028 250);
--s3:oklch(28% .030 250);
--fg:oklch(88% .006 245);
--fg-dim:oklch(68% .010 245);
--muted:oklch(50% .012 245);
--border:oklch(27% .018 250);
--accent:oklch(73% .090 205);
--soft:oklch(24% .040 205);
--paper:oklch(17% .026 250);
```

质感策略:

- 适合加入低光磨砂: `--frost-blur:18px`，`--frost-saturate:1.08`。
- 磨砂只作用在外壳、选择器、详情卡、顶部栏、侧栏和状态栏。
- 正文纸面保持稳定，不做玻璃化，避免长写作时发虚。

## 3. 亚麻 Paper

CSS key: `linen-paper`  
角色: 长读 / 资料  
最佳场景: 长文阅读  
气质描述: 未漂白亚麻纸、自然暖光、久读不疲。

设计意图:

亚麻 Paper 是长阅读主题。它比清曜 Light 更温暖，但不走泛黄旧纸路线。背景和纸面使用低色度暖亚麻色，强调色采用青玉绿，避免整套主题落入单一米色。

核心 token:

```css
--bg:oklch(94% .010 82);
--surface:oklch(98% .006 82);
--s2:oklch(90% .014 82);
--s3:oklch(85% .020 82);
--fg:oklch(27% .016 78);
--fg-dim:oklch(46% .014 78);
--muted:oklch(61% .010 78);
--border:oklch(86% .014 82);
--accent:oklch(38% .064 145);
--soft:oklch(88% .036 145);
--paper:oklch(99% .004 82);
```

质感策略:

- 外壳基本不磨砂，保证资料阅读的静态稳定。
- `grain-opacity` 略高于清曜 Light，形成自然纸感。
- 适合阅读、资料整理、轻量批注。

## 4. 暖烛 Study

CSS key: `amber-study`  
角色: 研究 / 深读  
最佳场景: 夜读研究  
气质描述: 暗褐书房、蜂蜜金灯、文字有温度。

设计意图:

暖烛 Study 是深夜阅读和资料研究主题。它不是黑金，也不是复古棕色网页，而是书房里的低照度暖光。背景偏暗褐，强调色是蜂蜜金，让用户感到安静和被照亮。

核心 token:

```css
--bg:oklch(16% .020 55);
--surface:oklch(20% .024 55);
--s2:oklch(25% .026 55);
--s3:oklch(31% .030 55);
--fg:oklch(88% .010 70);
--fg-dim:oklch(69% .014 70);
--muted:oklch(52% .016 70);
--border:oklch(29% .022 55);
--accent:oklch(72% .080 75);
--soft:oklch(26% .034 75);
--paper:oklch(18% .022 55);
```

质感策略:

- 磨砂感像“灯罩雾面”，不强调透明。
- `--frost-blur:14px`，比清曜 Night 更温润。
- 适合夜读、论文摘录、资料研究，不适合高刺激灵感场景。

## 5. 松烟 Ink Jade

CSS key: `ink-jade`  
角色: 写作 / 专注  
最佳场景: 深夜长写作  
气质描述: 冷灰松烟、青玉微光、安静克制。

设计意图:

松烟 Ink Jade 是最克制的深色写作主题。它要保留文人气和墨色感，但不能复古到变成仿古界面。背景是冷灰青黑，强调色是青玉色，整体更适合长时间写作。

核心 token:

```css
--bg:oklch(14% .014 210);
--surface:oklch(18% .016 210);
--s2:oklch(23% .018 210);
--s3:oklch(29% .020 210);
--fg:oklch(87% .005 200);
--fg-dim:oklch(67% .010 200);
--muted:oklch(49% .012 200);
--border:oklch(26% .014 210);
--accent:oklch(70% .075 165);
--soft:oklch(24% .032 165);
--paper:oklch(16% .015 210);
```

质感策略:

- 磨砂最克制: `--frost-blur:12px`，`--frost-chrome-blur:8px`。
- 不做强 glow，避免从“松烟墨面”变成科技面板。
- 适合深夜长写作、日记、沉浸式整理。

## 6. 极光 Field

CSS key: `aurora-field`  
角色: 灵感 / AI  
最佳场景: 灵感整理  
气质描述: 靛紫磁场、极光青边、有轻微未来感。

设计意图:

极光 Field 是最具想象力的主题，用在灵感、AI、知识网络相关状态。它可以比其他主题更有光感，但仍要控制在“轻未来”，不能变成游戏 UI 或赛博霓虹。

核心 token:

```css
--bg:oklch(15% .040 270);
--surface:oklch(20% .044 270);
--s2:oklch(25% .048 270);
--s3:oklch(31% .052 270);
--fg:oklch(90% .008 265);
--fg-dim:oklch(70% .012 265);
--muted:oklch(53% .016 265);
--border:oklch(28% .038 270);
--accent:oklch(76% .110 195);
--soft:oklch(25% .050 195);
--paper:oklch(17% .042 270);
```

质感策略:

- 6 套核心主题中磨砂最明显: `--frost-blur:20px`，`--frost-saturate:1.12`。
- 强调色 chroma 到 `.110`，但只作为边缘引导和 active 状态。
- 适合灵感整理、AI 辅助、知识网络视图。

## 深色主题磨砂规则

深色主题增加磨砂感时遵循以下边界:

- 可磨砂: 页面外壳、主题选择器、详情卡、窗口 chrome、侧栏、状态栏。
- 不磨砂: 正文编辑区、正文阅读区。
- 可加颗粒: 页面背景和低光面层。
- 不加重纹理: 正文区域，除非是专门的纸质主题。

推荐参数范围:

```css
--frost-blur:12px ~ 20px;
--frost-chrome-blur:8px ~ 14px;
--frost-saturate:1.02 ~ 1.12;
--grain-opacity:.14 ~ .20;
```

## 附录: 澄宣 Xuan 实验主题

CSS key: `xuan-paper`  
状态: 实验纸质主题，不计入 6 套核心主旋律  
角色: 宣纸 / 手稿  
最佳场景: 中文长写作  
气质描述: 青灰生宣、细密纸纤维、像墨迹刚落定。

设计意图:

澄宣 Xuan 是一套更具材质感的中文写作主题。它不应成为默认主题，而适合作为“手稿模式”或“中文长写作模式”。它的差异点在于正文区域允许出现极轻的纸纤维层，但透明度必须受控。

核心 token:

```css
--bg:oklch(95% .012 96);
--surface:oklch(98% .006 96);
--s2:oklch(91% .016 96);
--s3:oklch(85% .020 96);
--fg:oklch(25% .018 95);
--fg-dim:oklch(44% .014 95);
--muted:oklch(60% .012 95);
--border:oklch(84% .018 96);
--accent:oklch(48% .095 32);
--soft:oklch(89% .038 32);
--paper:oklch(98% .010 96);
--fiber-opacity:.13;
```

纸纤维规则:

- 只放在正文阅读 / 编辑区域的伪元素层。
- 默认透明度不超过 `.13`。
- 不使用强 `mix-blend-mode:multiply`，避免正文区域发灰。
- 移动端必须优先保证正文可读性，纤维只能“隐约存在”。

## 接入约定

主题通过根节点 `data-theme` 切换:

```html
<html lang="zh-CN" data-theme="clairis-night">
```

主题 key 应保持语义稳定，不随中文命名调整而频繁变动。推荐将 `clairis-night` 作为默认深色主视觉主题，`clairis-light` 作为默认浅色工作主题。

