---
tags: [markdown, typography, tex, knuth-plass, app, 排版]
date: 2026-06-26
source: local-video
type: project
---

# Talari：基于 TeX 断行算法的 Markdown 阅读器

## Overview

自己做了一个 Markdown 阅读器 **Talari**，核心亮点是实现 TeX 的 Knuth-Plass 断行算法（KP 替代贪心算法），解决中英混排的美观问题。目前只有 macOS 版本，下一步完善后发布。

## Key Points

### 1. 核心算法

- **TeX Line Breaking Algorithm（Knuth-Plass）**：动态规划算法，根据整个段落计算整体美观程度，而非贪心
- **对比**：现有 Markdown 阅读器都用 Web 流式（贪心）排版，质量远低于 TeX
- TeX 仍是排版领域的质量标杆

### 2. 中英混排细节

- 中英文之间的控白调节
- 标点压缩处理
- 行末标点的宣馆（避头尾）
- 细节非常多

### 3. 性能表现

- 大部分测试用例下实现 **120fps 排版速度**
- 窗口大小改变后立即呈现最新结果
- 基于 macOS 原生文字渲染技术（NSTextView / TextKit）

### 4. 技术栈

- macOS 原生文字渲染
- 自研排版引擎重写（非复用现有库）
- 目前精力有限只做 macOS，后续考虑扩展

### 5. 未来计划

1. 完善 App 稳定性
2. 做**所见即所得**的编辑器（WYSIWYG）
3. Apple Developer 注册完成后发布
4. 做独立网站供下载

### 6. 小广告

在招赴印尼 AI 教师，地点在印尼 UP 大学 AI 学院：
- 计算机相关专业
- 英语能力过关
- 全职/兼职均可
- 薪资较高，欢迎联系

## Actionable Takeaways

1. TeX 断行算法（Knuth-Plass）相比贪心在中文场景下质量提升显著
2. 120fps 实时排版在技术上可行，关键在 DP 状态管理和缓存
3. 中英混排的核心难点：标点压缩 + 控白 + 避头尾

## Key Quote

> "我给我取名字叫 Talari，我一直觉得现在绝大部分的 Markdown 阅读器不够好看，因为他们都是用的流式排版算法，而 Talari 和 TeX 则是排版领域的王者。"
