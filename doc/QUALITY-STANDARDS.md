# 质量管控标准 v1

> 基于 CORE-REQUIREMENTS.md 设计原则 + QUALITY-IMPROVEMENT.md 根因分析
> 日期: 2026-07-01

---

## 一、设计原则 → 可测试标准

CORE-REQUIREMENTS.md 第二章定义了四条评审红线。每条红线必须可测量、可自动化。

### 快 ⚡

| 度量 | 目标 | 测试方法 |
|------|------|----------|
| 冷启动到可交互 | <1.0s | `console.time` from `main.tsx` to first `App render` |
| 文件打开 | <300ms (50KB .md) | `console.time` in `openFile` action |
| 编辑响应 | <16ms (60fps) | CM6 `updateListener` 中测量 docChanged 间隔 |
| 模式切换 | <100ms | `console.time` in `setEditorMode` |
| 面板折叠/展开 | <150ms | CSS transition + `requestAnimationFrame` 测量 |
| 滚动帧率 | 60fps (无掉帧) | Chrome DevTools Performance 面板，大文件滚动剖面 |
| 大文件降级 | >500KB 自动关闭 decoration | 测试: 打开 600KB 文件，验证 decoration count = 0 |

### 方便 🖐️

| 度量 | 目标 | 测试方法 |
|------|------|----------|
| 快捷键覆盖 | ≥80% 高频操作有快捷键 | 统计: 工具栏按钮数 vs 快捷键数 |
| 单手操作 | 主流程不离开主键盘区 | 测试: 打开→编辑→保存→关闭，全程只用键盘 |
| 鼠标点击次数 | 打开文件到编辑 ≤3 次点击 | 测试: 记录用户操作流中的点击次数 |
| Tab 导航 | 所有交互元素可 Tab 到达 | `document.querySelectorAll('[tabindex]')` + 手动验证 |
| 焦点指示器 | 当前焦点元素有可见 outline | 视觉检查 |

### 舒服 😌

| 度量 | 目标 | 测试方法 |
|------|------|----------|
| 排版克制 | 无信息过载，默认即美观 | 截图 OCR 验证：无冗余 UI 元素 |
| 动画平滑 | CSS transition ≥60fps | DevTools Performance 验证 |
| 配色舒适 | WCAG AA 对比度 ≥4.5:1 | 自动化: axe-core 或手动对比度检查器 |
| 字体可读 | 正文字号 16px，行距 ≥1.6 | `getComputedStyle` 验证 |
| 窄栏宽 | 预览模式最大宽度 ≤720px | `getComputedStyle('.preview-view').maxWidth` |
| 留白充足 | 正文两侧 padding ≥32px | `getComputedStyle('.preview-view').padding` |

### 喜欢 ❤️

| 度量 | 目标 | 测试方法 |
|------|------|----------|
| 细节有惊喜 | 每个 Phase 至少 1 处超出预期的细节 | 人工评审 |
| 无 paper cuts | 无已知微小体验缺陷 | 逐项检查已知 paper cut 列表 |
| 空状态友好 | 无文件时显示引导而非空白 | 截图验证 |
| 错误状态可操作 | 每个错误有恢复建议 | 触发错误 → 验证 UI 有"重试"/"返回"按钮 |

---

## 二、需求追溯矩阵 (RTM)

> 来自 QUALITY-IMPROVEMENT.md 措施 1。每个需求有唯一 ID，每个测试标注覆盖的 REQ。

### REQ 索引

| REQ ID | 需求 | 验收标准摘要 |
|--------|------|-------------|
| REQ-3.1-01 | 秒开 | 冷启动 <1s, 双击 .md 即显示 |
| REQ-3.1-02 | 完整 GFM 渲染 | 表格/任务列表/代码块/引用/图片/链接/粗斜体/列表/分割线 |
| REQ-3.1-03 | 纯阅读模式 | 一键切换，动画过渡，全屏沉浸 |
| REQ-3.1-04 | 字体排印 | 打开即舒适，无需调整 |
| REQ-3.1-05 | 字号缩放 | Cmd+= / Cmd+- 缩放 12-32px，持久化 |
| REQ-3.1-06 | Dark/Light 主题 | 跟随系统 + 手动切换，两套完整配色 |
| REQ-3.1-07 | 滚动顺滑 | 60fps，>500KB 自动降级 |
| REQ-3.1-08 | 阅读进度 | 滚动时实时更新 |
| REQ-3.2-01 | 语法标记美化 | `#`/`**`/`*`/`` ` ``/`>` 淡化或替换 |
| REQ-3.2-02 | 标题可视化 | `### 标题` → `[H3 ▼] 标题` |
| REQ-3.2-03 | 加粗斜体 | `**粗体**` → 粗体显示(**隐藏) |
| REQ-3.2-04 | 列表美化 | `- 无序` → • 无序 (符号淡化) |
| REQ-3.2-05 | 任务列表 | ☐ 可点击切换 `[ ]`↔`[x]` |
| REQ-3.2-06 | 引用美化 | `> 引用` → 灰线 + 灰块 (`>`隐藏) |
| REQ-3.2-07 | 代码美化 | `` `code` `` → 灰底等宽 (反引号隐藏) |
| REQ-3.2-08 | 链接美化 | `[text](url)` → 蓝色可点击 (URL隐藏) |
| REQ-3.2-09 | 工具栏 | H1-H6/B/I/列表/引用/代码/表格/链接/图片 |
| REQ-3.2-10 | 快捷键 | B/I/U/S 等 10+ 快捷键 |
| REQ-3.2-11 | 源码模式 | Cmd+Shift+M 切换 raw 编辑 |
| REQ-3.3-01 | 文件打开/保存 | Cmd+O / Cmd+S / 拖拽打开 / 原子写入 |
| REQ-3.3-02 | 自动保存 | 编辑停止 2s 后自动保存 |
| REQ-3.3-03 | 多页签 | 页签可关闭、切换、拖拽排序 |
| REQ-3.4-01 | HTML 预览 | iframe srcdoc + CSP + sandbox |
| REQ-3.4-02 | HTML 安全 | CSP script-src: 'none' |
| REQ-3.5-01 | 三栏布局 | 左侧栏 + 内容 + 右侧栏，可折叠可拖拽 |
| REQ-3.6-01 | 设置持久化 | 配置写入 app_config.json，重启保持 |
| REQ-5.2-01 | 屏幕阅读器 | VoiceOver 可朗读标题层级/图片alt/链接文本 |
| REQ-5.2-02 | 键盘导航 | Tab 可到达所有交互元素 |
| REQ-5.2-03 | 颜色对比度 | WCAG AA ≥4.5:1 |
| REQ-5.2-04 | 字号缩放 | 200% 缩放不破坏布局 |
| REQ-5.5-01 | 空状态 | 首次启动显示引导 |
| REQ-5.5-02 | 加载状态 | 骨架屏或进度指示器 |
| REQ-5.5-03 | 错误状态 | 每个错误有提示 + 恢复建议 |
| REQ-5.5-04 | 编辑冲突 | 外部修改提示刷新或覆盖 |

### 测试 → REQ 映射

每个测试文件标注覆盖的 REQ ID：

```
src/__tests__/editors/decorations/heading.test.ts    → REQ-3.2-02
src/__tests__/editors/decorations/boldItalic.test.ts  → REQ-3.2-03
src/__tests__/editors/decorations/code.test.ts        → REQ-3.2-07
src/__tests__/editors/decorations/list.test.ts        → REQ-3.2-04, REQ-3.2-05
src/__tests__/editors/decorations/quote.test.ts       → REQ-3.2-06
src/__tests__/stores/sidebar.test.ts                  → REQ-3.5-01
src/__tests__/components/Layout.test.tsx              → REQ-3.5-01
src/__tests__/app-render.test.tsx                     → REQ-3.1-01, REQ-3.5-01
```

---

## 三、CSS 清单验证

> 来自 QUALITY-IMPROVEMENT.md 措施 2。每个 TS 中声明的 CSS class 必须在样式文件中有定义。

### 自动检查脚本

```bash
# 1. 提取所有 TS 中的 CSS class 常量
grep -rn "CLASS\s*=" src/editors/decorations/ | grep -o '"[^"]*"' | tr -d '"' | sort -u > /tmp/css-declared.txt

# 2. 提取所有 CSS 中定义的 class
grep -rn '\.cm-' src/styles/ | grep -o '\.cm-[a-z-]*' | sort -u > /tmp/css-defined.txt

# 3. 对比
comm -23 /tmp/css-declared.txt /tmp/css-defined.txt
# 输出非空 → FAIL: 有 CSS class 声明但无样式定义
```

该检查集成到 CI / pre-commit hook。

### CSS 清单

| CSS Class | 所属模块 | 预期视觉效果 | 定义文件 | 状态 |
|-----------|---------|-------------|---------|------|
| `.cm-strong` | boldItalic | font-weight: 700, 隐藏 `**` | editor.css | ❌ 缺失 |
| `.cm-em` | boldItalic | font-style: italic, 隐藏 `*` | editor.css | ❌ 缺失 |
| `.cm-inline-code` | code | 灰底等宽字体, 隐藏反引号 | editor.css | ❌ 缺失 |
| `.cm-heading-marker` | heading | `[H1]`-`[H6]` 标签样式 (小号蓝底白字) | editor.css | ❌ 缺失 |
| `.cm-list` | list | 列表行样式 | editor.css | ❌ 缺失 |
| `.cm-task-done` | list | 已完成任务: 删除线 + 变灰 | editor.css | ❌ 缺失 |
| `.cm-task-pending` | list | 待办任务: 强调色 | editor.css | ❌ 缺失 |
| `.cm-quote` | quote | 左侧灰线 + 灰色背景块 | editor.css | ❌ 缺失 |
| `.cm-link` | link | 蓝色可点击 + 虚线下划线 | editor.css | ❌ 缺失 (模块也缺失) |

---

## 四、Decoration 测试标准

> 来自 QUALITY-IMPROVEMENT.md 措施 4。

每个 decoration 模块的测试必须覆盖：

```
必测项 (每条 FAIL 则 CI 不通过):
  [ ] 正则: 匹配预期输入 (至少 3 个 case)
  [ ] 正则: 不匹配非预期输入 (至少 3 个 case)
  [ ] 装饰类型: 使用正确的 Decoration 子类 (replace/mark/widget/line)
  [ ] CSS 类存在: 声明的 class 名称在 editor.css 中有定义 (自动化脚本验证)
  [ ] 范围正确: from/to 位置不越界，只替换目标字符
  [ ] Widget 内容: (如适用) Widget 渲染正确内容
  [ ] 边界: 空内容、单字符、超长行
  [ ] 嵌套: (如适用) 一个 decoration 包含另一个 behavior 正确

选测项:
  [ ] 多行: 装饰跨多行
  [ ] 特殊字符: Unicode, emoji, 转义字符
  [ ] 组合: 与其他 decoration 叠加 (如 bold 内 code)
```

---

## 五、测试金字塔

```
         ╱  E2E Tauri Mock ╲         9 tests — 完整文件操作流
        ╱    E2E Browser     ╲       14 tests — UI 布局/交互
       ╱    Unit Tests        ╲     128 tests — 函数/组件/Store
      ╱   TypeScript + Rust    ╲    tsc + cargo check
     ╱   CSS Manifest           ╲   css-manifest-check.sh
    ╱─────────────────────────────╲
```

| 层 | 工具 | 数量 | 覆盖范围 |
|----|------|------|---------|
| 类型检查 | `tsc --noEmit` + `cargo check` | — | 全部代码 |
| CSS 完整性 | `css-manifest-check.sh` | — | 9 TS 声明 ↔ CSS 定义 |
| 单元测试 | Vitest + jsdom | 128 | 函数、组件、Store、装饰模块 |
| E2E Browser | Playwright + Chrome | 14 | UI 布局、侧边栏、暗色模式、快捷键 |
| E2E Tauri Mock | Playwright + Chrome + Mock | 9 | 文件打开、Tab 管理、分栏、目录导航 |

### E2E Tauri Mock 体系

> Web 模式下 Tauri API (`invoke`) 不可用，文件操作功能无法通过真实浏览器测试。
> 解决方案：Playwright `addInitScript` 在页面加载前注入 `window.__TAURI_INTERNALS__` mock。

**Mock 文件:** `e2e/mocks/tauri-mock.js`
- 注入 `window.__TAURI_INTERNALS__` → App 识别为 Tauri 环境
- Mock `invoke(cmd, args)` → 返回模拟文件数据
- 支持的命令: `open_file`, `save_file`, `flatten_files`, `pick_folder`, `load_config`, `read_directory` 等

**测试文件:** `e2e/tauri/file-ops.spec.ts`
- 通过 `page.evaluate()` 直接调用 Zustand store 创建 tab
- 测试：右键菜单分栏、目录导航、FileTree 文件列表、Tab 管理、暗色模式

**运行:**
```bash
npx playwright test --config=playwright.tauri.config.ts
```

**扩展 Mock:**
在 `e2e/mocks/tauri-mock.js` 的 `responses` 对象中添加新命令的返回值即可。

---

## 六、门禁检查 (Gate Checks)

### Pre-Commit (自动化, <10s)

```bash
npx tsc --noEmit                    # 类型检查
npm test                             # 全量测试 (128 unit)
bash scripts/css-manifest-check.sh   # CSS 清单对照
```

### Pre-Handoff (自动化, ~60s) — 编码完成后必须运行

```bash
bash scripts/verify.sh
```

执行:
1. TypeScript 类型检查
2. 128 单元测试
3. CSS Manifest 对照
4. Rust 编译检查
5. 14 E2E Browser 测试
6. 9 E2E Tauri Mock 测试

**全部 6 项通过才能交付。**

### Pre-Merge (手动 + 自动化)

```
[ ] 视觉 QA: 截屏 OCR 验证无白屏/截断/溢出
[ ] 键盘遍历: 全程不碰鼠标操作主流程
[ ] 暗色模式: 切换后所有元素可读
[ ] 大文件: 打开 >500KB 文件验证降级
[ ] 空状态: 无文件时界面引导正确
```

### 每批次完成检查

```
[ ] RTM: 本批次覆盖的 REQ ID 全部有对应测试
[ ] CSS 完整性: css-manifest-check.sh PASS
[ ] 测试覆盖率: ≥80%
[ ] 视觉验证: 截屏对比 (OCR or 人工)
[ ] 性能回归: 启动/打开/切换时间在目标内
```

---

## 七、已知问题追踪

> 来自 QUALITY-IMPROVEMENT.md 第四节。每次修复后更新此表。

| # | 优先级 | 模块 | 问题 | 状态 | 修复日期 |
|---|--------|------|------|------|---------|
| 1 | P0 | heading.ts | 整行替换 → 标题文本消失 | ✅ **已修复** | 2026-07-01 — 拆分 replace(prefix) + mark(text) |
| 2 | P0 | editor.css | 9 个 `.cm-*` class 无样式定义 | ✅ **已修复** | 2026-07-01 — 添加全部 CSS 规则 |
| 3 | P0 | boldItalic.ts | `mark` → `**`/`*` 未隐藏 | ✅ **已修复** | 2026-07-01 — 拆分 replace(delim)×2 + mark(content) |
| 4 | P0 | code.ts | `mark` → 反引号未隐藏 | ✅ **已修复** | 2026-07-01 — 拆分 replace(backtick)×2 + mark(content) |
| 5 | P0 | quote.ts | `line` → `>` 未隐藏 | ✅ **已修复** | 2026-07-01 — replace(>)+ line(cm-quote) |
| 6 | P0 | list.ts | `line` → 列表标记未替换 | ✅ **已修复** | 2026-07-01 — replace(marker)+ line(cm-list) |
| 7 | P1 | link.ts | 模块不存在 | ⏳ Phase 1b | CSS `.cm-link` 已预备 |
| 8 | P1 | taskList.ts | 无 click handler | ⏳ Phase 1b | 需要 CM6 StateField + ClickListener |
| 9 | P1 | composition.ts | IME 降级逻辑存根 | ⏳ Phase 1b | 已标记 TODO |
| 10 | P1 | setup.ts | 大文件运行时守卫缺失 | ⏳ Phase 1b | 打开时降级到 source mode 已有，运行时 guard 待补 |
