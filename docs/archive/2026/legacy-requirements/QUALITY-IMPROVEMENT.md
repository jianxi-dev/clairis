# 质量管控加强方案

> 基于 Batch 1-5 复盘: L2 decoration 视觉未达需求根因分析后的改进方案
> 日期: 2026-06-27

---

## 一、根因总结

### 问题清单 (按层面)

| 层面 | 问题 | 影响程度 |
|------|------|---------|
| **需求→实现可追溯** | 无追溯矩阵, CORE-REQUIREMENTS.md 2.2 中 7 项 L2 需求无对应实现验证 | 8/8 decoration CSS 类缺失, link/taskList 模块缺失 |
| **批次依赖** | CSS 样式未作独立批次, 装饰模块和 CSS 分离, 无人负责连接 | 所有 `.cm-*` 类无样式定义 |
| **实现验证** | 审查清单无视觉验证项, 无 CSS 完整性检查 | 门禁通过但视觉为空白 |
| **测试覆盖** | decoration 测试仅验证正则, 不验证 CSS 类存在、装饰类型正确性 | 覆盖率虚高但捕获不到视觉问题 |
| **架构规范精度** | ARCHITECTURE.md 描述 decoration 方案但未说明"如何隐藏标记符号" | 实现者选了错误类型 (mark 而非 replace) |

### 具体数据

```
声明了 CSS 类:  8 个 (cm-heading-marker, cm-strong, cm-em, cm-list, ...)
定义了样式:     0 个
缺失模块:       link.ts, taskList.ts (独立模块)
存根未实现:     composition.ts (IME 降级), 大文件守卫
实现错误:       heading.ts 整行替换 → 标题文本消失
                boldItalic.ts mark → 分隔符未隐藏
                list.ts line → 标记符未替换
                quote.ts line → > 未隐藏
                code.ts mark → 反引号未隐藏
```

---

## 二、改进措施

### 措施 1: 需求追溯矩阵 (RTM)

每个 CORE-REQUIREMENTS.md 中的需求分配唯一 ID，格式 `REQ-<章节>-<序号>`:

```
REQ-2.2-01: 语法标记美化 — #/**/`/> 等符号淡化/替换
REQ-2.2-02: 标题可视化 — ### → [H3 ▼] 标签 + 下拉切换
REQ-2.2-03: 加粗斜体 — **粗体** → 粗体显示 (**隐藏)
REQ-2.2-04: 列表美化 — - 无序 → • 无序
REQ-2.2-05: 任务列表 — [ ] → ☐ 可点击切换
REQ-2.2-06: 引用美化 — > 引用 → 灰线 + 灰块 (>隐藏)
REQ-2.2-07: 代码美化 — `code` → 灰底等宽 (反引号隐藏)
REQ-2.2-08: 链接美化 — [text](url) → 蓝色可点击 (URL 隐藏)
REQ-2.2-09: 工具栏 — H1-H6/B/I/列表/引用/代码/表格/链接
REQ-2.2-10: 快捷键 — B/I/U/S 等 10+
REQ-2.2-11: 源码模式 — Cmd+Shift+M 切换 raw 编辑
```

每个实现批次声明覆盖的 REQ ID。审查时对照 RTM 逐条验证。

### 措施 2: CSS 类清单 (CSS Manifest)

文件 `doc/CSS-MANIFEST.md`，记录每个 CSS 类的用途、所属模块、预期效果:

```markdown
| CSS 类 | 模块 | 类型 | 预期效果 | 定义位置 |
|--------|------|------|---------|---------|
| .cm-strong | boldItalic | mark | font-weight: 700 | editor.css |
| .cm-em | boldItalic | mark | font-style: italic | editor.css |
```

审查时对照清单检查: 每个声明类都有样式定义?

### 措施 3: 审查清单扩展

在 EXECUTION-PLAN.md 的审查模板中增加:

```
[ ] CSS 完整性: 所有声明的 CSS 类在样式文件中有定义?
[ ] 视觉验证: 打开应用, decoration 视觉效果符合预期?
[ ] 架构双向校验: ARCHITECTURE.md 列出文件是否都创建了?
                     新增文件是否在 ARCHITECTURE.md 目录结构中?
[ ] 需求追溯: 本批次覆盖的 REQ ID 全部实现?
```

### 措施 4: 验收测试标准

每个 decoration 模块的测试必须覆盖:

```
必测项:
  [✅] 正则匹配预期/非预期输入
  [✅] 装饰类型正确 (replace/mark/line/widget)
  [✅] CSS 类名在样式文件中存在
  [✅] Widget 内容正确 (如适用)
  [✅] 范围计算正确 (from/to 位置)
  [✅] 嵌套/边界情况

选测项:
  [✅] 多行匹配
  [✅] 空内容
  [✅] 特殊字符
  [✅] 与其他 decoration 组合
```

### 措施 5: 批次依赖声明

在 EXECUTION-PLAN.md 中每个批次增加 `depends_on` 字段:

```yaml
Batch 2:
  depends_on: []
  produces: [decoration-ts, decoration-test]
  required_by: [Batch-2.5-CSS, Batch-3]

Batch 2.5 (新增):
  depends_on: [Batch-2]
  produces: [decoration-css]
  required_by: [Batch-3]
```

显式依赖防止遗漏。

### 措施 6: 覆盖率强制测量

在每个批次完成后运行:

```bash
npx vitest run --coverage
grep -c "cm-" src/styles/editor.css  # CSS 类计数
```

覆盖率 < 80% 自动 FAIL，不通过不放行。

---

## 三、实施计划

| # | 措施 | 优先级 | 执行时机 |
|---|------|--------|---------|
| 1 | 建立 RTM (需求追溯矩阵) | P0 | 立即 |
| 2 | 创建 CSS Manifest | P0 | 立即 |
| 3 | 扩展审查清单 | P0 | 下一个批次前 |
| 4 | 完善测试标准 | P0 | 下一个批次前 |
| 5 | 声明批次依赖 | P1 | 修改 EXECUTION-PLAN.md |
| 6 | 启用覆盖测量 | P1 | 添加 @vitest/coverage-v8 |

---

## 四、修复优先级 (针对当前缺口)

| 优先级 | 修复内容 | 工作量 |
|--------|---------|--------|
| **P0** | heading.ts: 修复范围错误 (仅替换 # 前缀, 保留标题文本) | ~10 行 |
| **P0** | editor.css: 添加 8 个 `.cm-*` 样式定义 | ~30 行 |
| **P0** | boldItalic.ts: 改用 replace 隐藏分隔符 | ~20 行 |
| **P0** | code.ts: 改用 replace 隐藏反引号 | ~15 行 |
| **P1** | link.ts: 新建模块 | ~30 行 |
| **P1** | taskList.ts: 从 list.ts 拆分, 加 click handler | ~50 行 |
| **P1** | composition.ts: 实现降级逻辑 | ~20 行 |
| **P1** | setup.ts: 大文件守卫 | ~30 行 |
