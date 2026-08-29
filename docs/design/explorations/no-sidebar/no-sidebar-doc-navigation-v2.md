---
title: "渐晰无侧栏文档查看与打开 v2 — 三层导航"
type: design
status: superseded
last_updated: 2026-08-01
source_of_truth: historical
redirect: docs/design/approved/navigation/spec.md
superseded_by: ../../approved/navigation/spec.md
---

# 渐晰无侧栏文档查看与打开 v2 — 三层导航

> 阶段: Phase R (Release 1.0)
> 状态: 设计中 — v2 重写
> 关联: CORE-REQUIREMENTS §4.1-4.2, no-sidebar-design.md, the-desk-concept.md
> 目标: 无需固定侧栏，零学习成本切换文档

---

## 一、核心原则

**无边框不是没有导航，是让导航在需要时零成本出现、不需要时不刺眼。**

用户只有三类意图：
1. **切** — 从这篇切到那篇（手边最近）
2. **搜** — 知道名字/内容，直接召回
3. **看** — 迷路了，摊开全部看一眼

三层对应三个动词。不需要记五条路径。

| 层 | 名字 | 触发 | 承担场景 |
|----|------|------|----------|
| 切换 | Quick Switch | Cmd+E / Cmd+` | 80% 日常切换 |
| 搜索 | Omni | Cmd+P | 明确目标的召回 |
| 全景 | Desk | Cmd+↑ | 兜底迷路 |

---

## 二、Quick Switch（切换层）

**底部常驻 Tab 栏 — 最多 5 篇最近活跃的文档。**

不隐藏、不触发条、不热区。始终在底部占据一行高度（32px）。

**规则：**
- Tab 栏永远显示，最低 opacity 0.4（不刺眼），hover 时 1.0
- 最多 5 篇（7±2 下限，避免拥挤）
- 当前激活 tab 高亮 + 下划线
- 点击切换，Cmd+` 循环切换（模仿浏览器标签）
- 新文档出现在最右侧

**Cmd+E = 展开 Quick Switch 面板：**
- Tab 栏上方弹出卡片层，5 个文档预览卡片横排
- 点击切换，数字键 1-5 瞬切，Esc 关闭
- 面板超出 5 篇时显示「更多」按钮 → 进入 Omni

---

## 三、Omni（搜索层）

**Cmd+P 打开居中模态，三模式 Tab：文件 / 命令 / 面板。**

默认态（空输入）= 最近 5 + 固定 3 + 上次搜索词

输入后即时搜索。

| 模式 | 搜索范围 | R 实现 |
|------|----------|--------|
| 文件 | 文件名 + frontmatter 标题 + recency boost | 字面匹配 + 时间加权 |
| 命令 | 列表过滤（新建/打开/保存/切换/沉浸...） | 静态列表 |
| 面板 | 快捷唤起（AI 对话/大纲/灵感/翻译） | 静态列表 |

> ponytail: 全文 TF-IDF 搜索留 P2，R 不做。文件名匹配覆盖 95% 场景。

**操作：**
- Enter = 当前标签页打开
- Cmd+Enter = 新标签打开（保留当前）
- ↑↓ = 移动选择
- Esc = 关闭

---

## 四、Desk（全景层）

**Cmd+↑ 全场景转换，9 格固定位置。**

格子数固定 9 个（7±2），不随文档数变化。

**位置算法（稳定规则，不随时间漂移）：**
```
slotIndex = documentId % 9
```
同一文档永远占同一槽位。槽位之间的视觉层次按时间分数排序：

| 槽位组 | 视觉 | 含义 |
|--------|------|------|
| 0, 1, 2 | opacity 1.0, 中部 | 最近 3 篇（伸手可及）|
| 3, 4, 5 | opacity 0.7, 稍远 | 稍早前 |
| 6, 7, 8 | opacity 0.45, 边缘 | 被遗忘的 |

时间分数只影响"哪个文档进哪个槽位"，不影响槽位本身的布局。

**交互：**
- 点击文档 → 展开全屏 → 进入 Surface 层
- Esc / Cmd+↓ → 回到 Surface
- 悬停 → 稍放大 + 显示时间 + 字数
- >15s 无操作 → 桌面 opacity 降为 0.6（淡化，不关闭）

> ponytail: 15s 只淡化不关闭。关闭是 Escape/点击做的事，系统不替用户决定。

---

## 五、阅读完成（读完后）

**读完时底部浮现三张推荐卡片，不自动归档。**

读完 = 手动触发（底部栏"读完"按钮 / Cmd+.）

三组推荐来源（同 v1 文档）：
1. 同文件夹最近活跃（路径亲近）
2. 当前文档 Resonance 最高匹配（语义亲近）
3. Bookmark / Ink Relics（记忆亲近）

**操作：**
- 点击卡片 → 打开该文档
- Esc / 点击空白 → 隐藏卡片
- 无自动消失。用户想停多久就多久。

---

## 六、Resonance 共鸣层

**写作暂停时，右侧显示极淡墨点，不显示完整推荐。**

- 暂停 2s → 右侧出现一个 8px 半透明圆点 `rgba(0,0,0,0.25)`
- hover 圆点 → 展开一条文字（来源文档+片段）
- 点击/Tab → 接受，跳转到源文档
- 低置信度时 → 圆点不出现（不强制显示噪音）

> ponytail: 只显示 1 条，不显示 3 条。3 条=推荐流，1 条=边注。"文件应该来找你"但不应喧宾夺主。

---

## 七、约束与明确不做

| 反模式 | 拒绝理由 |
|--------|----------|
| 边缘 6px 触发条 / 顶部热区 | 不可见 chrome 比可见侧栏更差，用户不知道怎么触发 |
| 嵌入停靠面板 | 这就是侧栏，只是多了 drag 动作。如果要，叫研究模式不是无侧栏 |
| 10s 自动归档 | 用户可能停留摘录，自动消失制造焦虑 |
| Desk 自动关闭 | 淡化不关闭，关闭是用户决定的 |
| 全文搜索（TF-IDF） | R 不做，留给 P2 |

---

## 八、快捷键

| 快捷键 | 行为 |
|--------|------|
| Cmd+E | 展开/关闭 Quick Switch 面板 |
| Cmd+` | 循环切换 tab |
| Cmd+P | Omni（文件/命令/面板）|
| Cmd+↑ / ↓ | 进入 / 退出 Desk |
| Cmd+N | 新建文档 |
| Cmd+O | 打开文件 |
| Cmd+. | 触发阅读完成推荐 |
| Esc | 关闭当前面板 / 回到 Surface |

8 个快捷键。够用的最小集。

---

## 九、State Model

```typescript
interface AppStore {
  tabs: Tab[];               // 最多 5 个打开的 tab
  activeTabIdx: number;
  currentDoc: Document;
  quickSwitchOpen: boolean;  // Cmd+E 面板
  omniOpen: boolean;         // Cmd+P
  deskOpen: boolean;         // Cmd+↑
  readingCardsShow: boolean; // 阅读完成推荐
  resonanceVisible: boolean; // 右侧墨点
}
```

Desk 布局：
```typescript
function deskSlots(docs: Document[]): Slot[] {
  // 9 个槽位，documentId % 9 映射
  const slots = Array(9).fill(null);
  const sorted = [...docs].sort((a,b) => b.lastFocusedAt - a.lastFocusedAt);
  for (const doc of sorted) {
    const idx = doc.id % 9;
    if (!slots[idx]) slots[idx] = doc;
  }
  return slots;
}
```

---

## 十、R 阶段交付清单

- [ ] 底部 Tab 栏（5 篇最近，hover 高亮，Cmd+` 循环）
- [ ] Cmd+E Quick Switch 面板（5 卡片 + 数字键瞬切）
- [ ] Cmd+P Omni（三模式，默认空态 + 文件名匹配 + recency boost）
- [ ] Cmd+↑ Desk（9 格 hash 位置，淡化不自动关闭）
- [ ] 阅读完成底部三卡（手动触发，手动关闭）
- [ ] Resonance 右侧墨点（hover 展开一条，低置信不显示）
- [ ] Bookmark 精确定位（保存 scroll + cursor，restore 时回到原位）
- [ ] 经典侧栏兼容开关（设置里可选）

P1 暂不做：
- 嵌入停靠面板（承认是侧栏 → 称为研究模式）
- 10s 自动归档
- Omni 全文搜索（TF-IDF + semantic）
- Desk 自动 15s 回退（只淡化）
- 边缘触发条
