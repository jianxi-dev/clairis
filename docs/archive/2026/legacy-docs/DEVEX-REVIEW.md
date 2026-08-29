---
title: "Folio 开发者体验审查报告"
type: delivery
status: archived
last_updated: 2026-08-01
source_of_truth: historical
superseded_by: ../../../delivery/roadmap.md
---

# Folio 开发者体验审查报告

> 日期: 2026-07-02
> 审查范围: 开发工具链、测试体系、CI/CD、编码工作流、调试体验

---

## 一、现状评估

| 维度 | 评分 | 摘要 |
|------|------|------|
| **工具链** | 6/10 | 基础齐全省心，但缺 lint 规则 / pre-commit / formatter 集成 |
| **测试体系** | 7/10 | 140 测试通过率 100%，金字塔完整，但缺组件覆盖率统计 |
| **CI/CD** | 2/10 | 无 pre-commit hook，无 CI pipeline，验证全靠手动 |
| **编码工作流** | 5/10 | 无 commit 规范，无分支策略文档，无 changelog |
| **调试体验** | 4/10 | 日志系统有用但缺少 Rust 侧结构化日志/DevTools 集成 |

**整体 DevEX 得分：4.8/10**

最大的问题是**没有自动化 gate**。类型检查、测试、CSS 验证都写了脚本，但没有任何东西阻止"忘记跑验证就提交"的情况。

---

## 二、现有资产盘点

### 2.1 已有的好东西 ✅

| 资产 | 为什么好 |
|------|----------|
| `vitest` 140 测试 18 文件 | 覆盖率好，运行快（1.8s） |
| `scripts/verify.sh` | 6 步全量验证，可一键执行 |
| `scripts/css-manifest-check.sh` | 自动化 CSS class ↔ 定义对照 |
| `e2e/` 双配置 | Browser (14) + Tauri Mock (9)，关键路径覆盖 |
| `src/utils/log.ts` | 统一日志，带 level/module，ring buffer |
| `cargo check` 集成 | Rust 编译检查纳入验证 |
| `npx tsc --noEmit` | 全程类型检查 |

### 2.2 缺失项 ❌

| 缺失 | 影响 | 严重度 | 状态 |
|------|------|--------|------|
| **pre-commit hook** | 忘记跑 `verify.sh` 直接提交 → 坏代码入库 | 🔴 高 | ✅ **已修复** |
| **CI (GitHub Actions)** | 无法在 PR 时自动验证 | 🔴 高 | ✅ **已创建** |
| **Lint 规则/ESLint 配置** | 代码风格全靠人工，不一致 | 🟡 中 | ✅ **已配置** |
| **Commit 规范** | `git log --oneline` 信息混乱 | 🟡 中 | ⏳ 待实施 |
| **编辑器配置** | 无 `.editorconfig` | 🟡 中 | ✅ **已创建** |
| **覆盖率阈值** | vitest 无 coverage threshold | 🟡 中 | ✅ **已配置 (30/20/20/30)** |
| **裸 `console.error`** | 散落在各组件，不走统一日志 | 🟡 中 | ✅ **已替换** |
| **日志系统改进** | Rust 侧 `tracing` 未配置到前端 | 🟢 低 | ⏳ 待实施 |
| **E2E 运行指引** | 需手动安装 chromium | 🟢 低 | ⏳ 待实施 |

---

## 三、详细诊断

### 3.1 工具链：有料但没串起来

**当前状态：**
- `npx tsc --noEmit` ✅ 零错误
- `vitest` 140 tests, 1.8s ✅
- `prettier` v3.9.4 已安装 ✅ 但未集成到任何工作流
- `eslint` v10.6.0 已安装 ✅ 但**没有配置文件** (`no .eslintrc`)
- `lint-staged` v17.0.8 已安装 ✅ 但**没有配置**
- `.husky` **不存在** — pre-commit 钩子完全缺失

**建议：**

```
安装 → husky
配置 → pre-commit hook: lint-staged
  lint-staged:
    "*.{ts,tsx,js,jsx}": [eslint --fix, prettier --write]
    "*.css": [prettier --write]
    "*.rs": [cargo fmt]

验证脚本 → pre-commit: 
  bash scripts/css-manifest-check.sh
  npm test -- --changed --coverage.threshold=80
  npx tsc --noEmit
```

### 3.2 测试体系：覆盖不错但缺柱子

**当前结构（140 tests）：**

```
         ╱  E2E Tauri Mock ╲         9 tests
        ╱    E2E Browser     ╲       14 tests
       ╱    Unit Tests        ╲     117 tests
      ╱   TypeScript + Rust    ╲   tsc + cargo check
     ╱   CSS Manifest           ╲   css-manifest-check.sh
```

**问题：**
1. **component tests 覆盖不足** — `__tests__/components/` 下只有 Layout/ContentArea/PreviewView/TranslatePanel/Outline 测试，Toolbar/TabBar/SidebarPanel/FileTree/RecentFiles 无测试
2. **无覆盖率报告** — vitest 跑完后不输出覆盖率，无法知道哪里缺
3. **E2E 不覆盖关键用户路径** — 缺少 "打开文件 → 编辑 → 保存 → 重新打开 → 内容一致" 端到端验证
4. **Rust 测试不足** — `src-tauri/src/` 下 Rust 代码没有测试

**建议：**

```bash
# vitest 添加覆盖率配置
npx vitest --coverage --coverage.thresholds.lines=80
```

```
缺失组件测试（按优先级）:
  P0: Toolbar (8 按钮/模式切换/主题)
  P0: TabBar (tab 开关/右击菜单/dirty 标记)
  P1: FileTree (文件夹选择/文件列表/搜索)
  P1: SidebarPanel (tab 切换)
  P2: RecentFiles (显示/清除/打开)
```

### 3.3 CI/CD：完全空白

**当前状态：**
- ❌ 无 `.github/workflows/`
- ❌ 无 pre-commit hook
- ❌ 无自动化发布流程
- ✅ 但有完整的 `verify.sh`（手动跑）

**建议：最低可行 CI (GitHub Actions)**

```yaml
# .github/workflows/ci.yml — <50 lines
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions-rust-lang/setup-rust-toolchain@v1
      - run: npm ci
      - run: npx playwright install chromium
      - run: bash scripts/verify.sh
```

### 3.4 编码工作流：无规范

**当前问题：**
- `git log` commit message 格式不统一：`fix:`, `feat:`, `Merge` 混用
- 分支策略：`main` + `feat/xxx`，但无规范文档
- 无 CHANGELOG / release notes
- PR template 不存在

**建议：**

```
约定式提交 (Conventional Commits):
  feat:  新功能
  fix:   修复
  docs:  文档
  style: 格式（不影响代码运行）
  refactor: 重构
  test:  测试
  chore: 构建/工具链

分支策略（保持简单）:
  main → 稳定，直接从 feat/ PR 合并
  feat/xxx → 功能开发，从 main 分支

CHANGELOG:
  用 standard-version 或手工维护
```

### 3.5 调试体验：有基础但可改进

**当前状态：**
- `src/utils/log.ts` — 统一前端日志系统 ✅
- React DevTools — 浏览器可用 ✅
- Rust `tracing` crate — 已依赖但未配置输出目的地 ❌

**问题：**
1. 前后端日志分离 — Rust `tracing` 日志不显示在前端
2. `console.log` 散落在各组件 — 虽然用了 `log.ts`，但 ErrorBoundary/App.tsx 中仍有裸 `console.error`
3. 无性能标记 — `console.time` 仅在设计文档中提到，未实现

**建议：**

| 改进项 | 实现 |
|--------|------|
| Rust 日志前端可见 | Tauri event: `tracing_subscriber` → `app.emit("log", entry)` |
| 替换裸 console | 全局替换 `console.error(...)` → `log.error(module, msg, err)` |
| 性能计时 | `log.time("openFile")` / `log.timeEnd("openFile")` |
| DevTools 面板 | 右下角浮动面板，显示 `log.recent(200)`（Phase 3） |

---

## 四、修复方案（按优先级）

### 🔴 P0 — 必须做（进入 Phase 1 前）

| # | 任务 | 工时 | 说明 |
|---|------|------|------|
| P0-1 | **安装 husky + 配置 pre-commit** | 0.5h | `husky init → pre-commit: npx lint-staged && bash scripts/css-manifest-check.sh` |
| P0-2 | **配置 ESLint** | 1h | `.eslintrc`: TS + React 规则，`@typescript-eslint` 基本集 |
| P0-3 | **配置 lint-staged** | 0.5h | `package.json` 中声明 staged 文件格式 |
| P0-4 | **vitest 覆盖率配置** | 0.5h | 添加 `coverage.thresholds.{lines,functions,branches,statements}: 80` |
| P0-5 | **移除裸 `console.error`** | 1h | 全局替换为 `log.error`，确保所有错误路径走统一日志 |

### 🟡 P1 — 应该做（Phase 1 期间）

| # | 任务 | 工时 | 说明 |
|---|------|------|------|
| P1-1 | **ESLint 规则渐进严格化** | 1h | 逐步启用 `no-unused-vars`、`no-console`、`react-hooks/exhaustive-deps` |
| P1-2 | **缺失组件测试** | 4h | Toolbar / TabBar / FileTree / SidebarPanel |
| P1-3 | **Rust 单元测试** | 3h | `config_cmd.rs` / `file.rs` / `directory.rs` 关键路径 |
| P1-4 | **EditorConfig** | 0.2h | `.editorconfig` 文件（缩进/编码/换行） |
| P1-5 | **GitHub Actions CI** | 1h | 最小 CI: `scripts/verify.sh` 在 push/PR 时运行 |

### 🟢 P2 — 可以补（Phase 2+）

| # | 任务 | 工时 | 说明 |
|---|------|------|------|
| P2-1 | **Commitlint + changelog** | 2h | 约定式提交 + CHANGELOG 自动化 |
| P2-2 | **PR template** | 0.3h | `.github/PULL_REQUEST_TEMPLATE.md` |
| P2-3 | **Rust 日志 → 前端** | 2h | tracing_subscriber → Tauri event bridge |
| P2-4 | **性能计时** | 1h | 启动/打开/切换关键路径 + 开发面板显示 |
| P2-5 | **pre-push hook** | 0.5h | push 前跑全量 verify.sh |

---

## 五、建议交付顺序

```
Day 1 (P0)
  └── husky + lint-staged + ESLint 配置
  └── 替换裸 console.error → log.error
  └── vitest 覆盖率阈值

Day 2 (P1)
  └── 缺失组件测试 (Toolbar/TabBar)
  └── Rust 单元测试
  └── EditorConfig

Day 3 (P1)
  └── GitHub Actions CI (verify.sh on push/PR)
  └── 验收 + 文档更新

Day 4+ (P2)
  └── Commitlint + PR template
  └── DevTools 改进（日志桥/性能计时）
```

---

## 六、成本收益分析

| 改进 | 投入 | 收益 | ROI |
|------|------|------|-----|
| pre-commit hook | 0.5h | 杜绝"忘了跑验证"导致的坏 commit | 🔥 极高 |
| ESLint 基本配置 | 1h | 代码风格一致，减少无谓的 review 噪声 | 🔥 高 |
| 覆盖率配置 | 0.5h | 防止新代码无测试入库 | 🔥 高 |
| 组件测试补全 | 4h | 提高测试对 UI 变更的敏感度 | ✅ 中 |
| GitHub Actions CI | 1h | PR 自动验证，多人协作基础 | ✅ 中 |
| Rust 测试 | 3h | 后端核心路径有安全保障 | ✅ 中 |
| Commitlint | 2h | 自动生成 changelog，长期省时 | 🟢 低 |
| DevTools 改进 | 3h | 调试效率提升 | 🟢 低 |

**前三步（~2h）即可覆盖 80% 的风险。**
