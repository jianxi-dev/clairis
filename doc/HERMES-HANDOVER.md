# MDWRT — Hermes 执行移交清单

> 用于在新对话中启动 Hermes 驱动的主流程

---

## 一、当前状态

### 已完成
| 项目 | 状态 |
|------|------|
| 核心需求文档 | ✅ `doc/CORE-REQUIREMENTS.md` (Codex 4 轮审查) |
| 技术架构设计 | ✅ `doc/ARCHITECTURE.md` (Codex 3 轮审查) |
| 执行计划 | ✅ `doc/EXECUTION-PLAN.md` |
| Batch 0: 基线清理 | ✅ 依赖已清理, v1 文件已删除, TS 编译通过 |
| Batch 1: 测试已写 (RED) | ⏳ `src/__tests__/store.test.ts` 已创建, 等待实现 |
| 权限限制 | ⚠️ 需配置 allowlist (见下文) |

### 遗留文件
| 文件 | 说明 |
|------|------|
| `src/stores/editorStore.ts` | v1 旧 store, 保留兼容, Hermes Batch 1 需保留它 |
| `src/App.tsx` | 临时简化版 (textarea 兜底) |
| `src/hooks/useConfig.ts` | 配置占位, Batch 6 重写 |
| `src/styles/editor.css` | 基础 Tailwind 样式 |

### 已删除 (v1 清理)
WysiwygEditor, SourceEditor, HeadingColor, MarkdownSync, turndown-plugin-gfm.d.ts, TranslatePanel, SettingsModal, useTranslation.ts, markdownRoundtrip.test.ts, MarkdownSync.test.ts, adaptTaskListHtml.test.ts

---

## 二、批量执行顺序

按 `doc/EXECUTION-PLAN.md` 定义的 7 个批次, 逐批执行. 每批内部 TDD 流程:

```
Hermes run_task → 轮询完成 → Claude 质量审查 → PASS→下一批 / FAIL→continue_task
```

### Batch 1 — Store 多页签重构

**入口文件:**
- `src/__tests__/store.test.ts` — 已写好, 12 个 case
- `src/types/index.ts` — 需增加 FileKind/EditorMode/AppConfig version
- `src/stores/index.ts` — 新建多页签 store

**验收:** `npm test` 全部通过, 旧 `editorStore.ts` 保留不被影响

**TDD 指令 (给 Hermes):**
```
RED:   npm test → 应失败 (stores/index.ts 不存在)
GREEN: 创建 stores/index.ts + 更新 types/index.ts → npm test 通过
IMPROVE: 检查覆盖率 ≥ 80%
```

### Batch 2 — CM6 编辑器管线

| 文件 | 说明 |
|------|------|
| `src/editors/setup.ts` | CM6 EditorState 装配 |
| `src/editors/decorations/heading.ts` | 标题标签 decoration |
| `src/editors/decorations/boldItalic.ts` | 粗斜体 |
| `src/editors/decorations/list.ts` | 列表 |
| `src/editors/decorations/quote.ts` | 引用 |
| `src/editors/decorations/code.ts` | 内联代码 |
| `src/editors/decorations/composition.ts` | IME 降级 |

### Batch 3 — EditView + SourceView

| 文件 | 说明 |
|------|------|
| `src/components/Content/EditView.tsx` | CM6 L2 |
| `src/components/Content/SourceView.tsx` | CM6 raw |
| `src/components/Content/ContentArea.tsx` | 模式切换 + 页签 |

### Batch 4 — PreviewView

| 文件 | 说明 |
|------|------|
| `src/components/Content/PreviewView.tsx` | marked + DOMPurify |
| `src/styles/theme-light.css` | 亮色主题 |
| `src/styles/theme-dark.css` | 暗色主题 |

### Batch 5 — Rust 后端

| 文件 | 说明 |
|------|------|
| `src-tauri/src/commands/directory.rs` | 目录浏览 |
| `src-tauri/src/config.rs` | 配置 + keyring 注册为命令 |
| `src-tauri/src/lib.rs` | 注册新命令 |

### Batch 6 — 翻译适配

| 文件 | 说明 |
|------|------|
| `src/hooks/useTranslation.ts` | 适配新 store |
| `src/components/Translation/TranslatePanel.tsx` | 重构 |

### Batch 7 — 集成

| 文件 | 说明 |
|------|------|
| `src/App.tsx` | 集成新组件 |
| `src/stores/editorStore.ts` | 删除 v1 遗留 |

---

## 三、权限配置 (关键!)

在新对话中, 你需要先配置 allowlist 避免每次拦截:

```bash
# ~/.claude/settings.json 或项目 .claude/settings.json
{
  "permissions": {
    "allow": [
      "Bash: npm test",
      "Bash: npx vitest*",
      "Bash: npm run*",
      "Bash: cargo build*",
      "Bash: npm install*",
      "Bash: npm uninstall*",
      "Bash: cd *",
      "Bash: mkdir*",
      "Bash: rm*",
      "Bash: mv*",
      "Bash: cp*",
      "Bash: ls*",
      "Bash: cat*",
      "Bash: find*",
      "Bash: grep*",
      "Bash: which*",
      "Bash: git*",
      "Bash: python3*",
      "Bash: tsc*",
      "Read: *",
      "Write: *",
      "Edit: *"
    ]
  }
}
```

或者在 ```/update-config``` 技能中执行:
```
允许 Bash 命令: npm test, npx vitest, npm install, cargo build, cd, mkdir, rm, ls, find, grep
```

---

## 四、在新对话中的启动命令

```bash
cd /Users/mason/mdwrt

# 1. 先看当前状态
ls src/stores/
cat doc/EXECUTION-PLAN.md

# 2. 启动 Hermes MCP 验证
# 确认 hermes-coding 的 run_task / continue_task / get_session_info 可用

# 3. 从 Batch 1 开始
# RED: npm test → 预期 import 错误
# 然后让 Hermes run_task 实现 stores/index.ts + 更新 types/index.ts
```

---

## 五、审查模板

每批完成后执行审查:

```
npm test                    # 测试全通过?
npm run tsc                 # TS 编译?
grep -r "console.log" src/  # 无调试输出?
```

按 `doc/EXECUTION-PLAN.md` 中的审查清单逐项检查. PASS 放行下一批, FAIL 调 `continue_task` 修复.

---

## 六、关键文档索引

| 文档 | 用途 |
|------|------|
| `doc/CORE-REQUIREMENTS.md` | 核心需求 (最终版) |
| `doc/ARCHITECTURE.md` | 技术架构设计 (最终版) |
| `doc/EXECUTION-PLAN.md` | 执行计划 + 质量门禁 |
| `doc/ARCH-REVIEW-LOG.md` | 架构 Codex 审查记录 |
| `doc/PROBLEM-SUMMARY.md` | 前期问题总结 (已归档) |
| `src/__tests__/store.test.ts` | Batch 1 测试 (已写好, 等待实现) |
