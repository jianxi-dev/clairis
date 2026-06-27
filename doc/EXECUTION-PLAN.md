# MDWRT — Phase 0 执行计划 (Hermes 分派)

> 管理人员: Claude (主管理 + 代码审查)
> 执行引擎: Hermes Agent (通过 MCP)
> 质量机制: TDD (RED→GREEN→IMPROVE) + 逐批审查

---

## 一、工作流

```
┌──────────────────────────────────────────────────────────────┐
│  每批流程:                                                    │
│                                                               │
│  1. Claude 创建任务规格 (含 TDD 要求和验收标准)                 │
│  2. Hermes run_task (async, 后台执行)                         │
│  3. Claude 轮询 get_session_info 直至完成                     │
│  4. Claude 质量审查 (代码 + 测试 + 覆盖率)                    │
│  5. 通过 → 放行下一批 | 不通过 → Hermes continue_task 修复   │
│                                                               │
│  审查清单 (每批):                                              │
│  [ ] 测试写了? (RED→GREEN 是否完整)                           │
│  [ ] 测试通过了?                                              │
│  [ ] 代码符合架构设计?                                         │
│  [ ] 错误处理完备?                                             │
│  [ ] 不可变模式?                                              │
│  [ ] 不引入新依赖 (除非书面批准)?                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、批次定义

### Batch 0: 项目基线清理

| 项目 | 值 |
|------|------|
| **目标** | 清理 v1 残留依赖, 设置 vitest 配置, 建立测试基础设施 |
| **内容** | 1. 移除未使用的 TipTap/ProseMirror/turndown 依赖<br>2. 添加 dompurify @types/dompurify<br>3. 验证 vitest 配置可用<br>4. 建立 src/\_\_tests\_\_/ 目录 + 基础测试骨架 |
| **TDD** | 验证测试: `npm test` 应报告 0 失败 |
| **范围** | package.json 修改, 不触及 src/ 逻辑代码 |
| **Hermes** | 1 次调用 |

### Batch 1: Store 重构 — 多页签

| 项目 | 值 |
|------|------|
| **目标** | 单文件 store → 多页签 Tab store (并行兼容旧 store) |
| **内容** | 1. 新建 `src/stores/index.ts` 多页签版 (Tab, AppStore, actions)<br>2. 包含 `openFile`, `saveFile`, `switchTab`, `closeTab`, `setEditorMode`, `updateContent`<br>3. 旧 `editorStore.ts` 保留 (v1 组件仍读旧 store)<br>4. 类型定义更新: 增加 FileKind, EditorMode ('preview'|'edit'|'source'), AppConfig version |
| **TDD** | 测试: 创建/关闭 tab, 切换 tab, 更新内容, dirty 标记, 文件类型分支 |
| **范围** | stores/index.ts (新), types/index.ts (更新), 不触及旧组件 |
| **Hermes** | 1 次调用 |

### Batch 2: CM6 编辑器管线

| 项目 | 值 |
|------|------|
| **目标** | CM6 基础装配 + 5 个核心 decorations |
| **内容** | 1. `editors/setup.ts`: CM6 EditorState 装配 (basicSetup + markdown language + decorations)<br>2. 5 个 decoration 模块: heading, boldItalic, list, quote, code<br>3. Compartment 控制 (用于大文件守卫和模式切换)<br>4. debounce 同步 (300ms, CM6→store) |
| **TDD** | 测试: 每个 decoration 正则匹配逻辑, Compartment 开关, debounce 时序 |
| **范围** | src/editors/* (新), 不触及旧组件 |
| **Hermes** | 1 次调用 (可并行写 decoration 模块) |

### Batch 3: EditView + SourceView + 模式切换

| 目标** | WYSIWYG 和源码编辑器组件, CSS display 模式切换 |
| **内容** | 1. EditView.tsx: CM6 L2 视图 (启用 decorations)<br>2. SourceView.tsx: CM6 raw 视图 (无 decorations)<br>3. 模式切换: CSS display n/b + Compartment reconfigure + 保留 EditorView 实例<br>4. 工具栏 (轻量: H/B/I/列表/代码/引用) |
| **TDD** | 测试: 模式切换不重建 EditorView, 切换后内容一致 |
| **范围** | components/Content/* (新), 旧 WysiwygEditor/SourceEditor 保留 |
| **Hermes** | 1 次调用 |

### Batch 4: PreviewView 阅读渲染

| **目标** | 阅读模式: marked + DOMPurify + 基础 CSS 主题 |
| **内容** | 1. PreviewView.tsx: marked.parse → DOMPurify → dangerouslySetInnerHTML<br>2. 基础 CSS 主题 (theme-light.css + theme-dark.css)<br>3. 阅读/编辑/源码 三模式切换集成<br>4. 大文件守卫 (>500KB 提示) |
| **TDD** | 测试: DOMPurify 过滤结果, marked 输入输出, CSS 变量切换 |
| **范围** | components/Content/* + styles/* |
| **Hermes** | 1 次调用 |

### Batch 5: Rust 后端补全

| **目标** | 新增 Rust 命令 (directory/config/security) |
| **内容** | 1. `read_directory()` — 递归读目录 (lstat, symlink 排除, max_depth)<br>2. `load_config()` / `save_config()` — 配置持久化 (含 schema version)<br>3. `get_api_key()` / `set_api_key()` / `delete_api_key()` — keyring 注册为命令<br>4. 翻译端点验证 (DNS 解析 + 全局单播检查 + redirect 禁用)<br>5. `stop_translation()` — 取消翻译请求<br>6. 所有新命令注册到 lib.rs |
| **TDD** | 测试: Rust 单元测试 (目录读取, 配置读写, 端点验证) |
| **范围** | src-tauri/src/* (新增命令, 修改 lib.rs) |
| **Hermes** | 1 次调用 |

### Batch 6: 翻译适配新 Store

| **目标** | 翻译面板适配多页签 store, 端点安全接入 |
| **内容** | 1. useTranslation hook 适配新 store<br>2. TranslatePanel 适配多页签 (当前 tab 内容)<br>3. 选中段落翻译<br>4. 端点安全验证接入 (调用 Rust 命令) |
| **TDD** | 测试: translation state 管理, 段落选择逻辑 |
| **范围** | components/Translation/*, hooks/useTranslation.ts |
| **Hermes** | 1 次调用 |

### Batch 7: 集成 + 测试

| **目标** | 所有新组件集成到 App.tsx, 全流程测试 |
| **内容** | 1. App.tsx 集成新组件, 移除 v1 组件引用<br>2. 功能验证: 打开→编辑→切换模式→保存→重开<br>3. 删除 v1 文件 (WysiwygEditor, SourceEditor, HeadingColor, MarkdownSync)<br>4. 移除 TipTap/turndown/marked 依赖 (marked 保留, 用于阅读管线) |
| **TDD** | 集成测试: 全流程用例 |
| **范围** | App.tsx (重写), 删除旧文件, package.json (清理) |
| **Hermes** | 1 次调用 |

---

## 三、质量门禁

### 门禁 1: 测试通过率 100%

```
Hermes 交付后 → Claude 运行 npm test
  ├── PASS → 进入代码审查
  └── FAIL → Hermes continue_task("修复失败的测试")
```

### 门禁 2: 代码审查清单

```
[ ] 测试覆盖率 ≥ 80% (新增代码)
[ ] 无 console.log (调试输出)
[ ] 不可变模式 (无直接 mutation)
[ ] 错误处理完备 (不吞异常)
[ ] 符合架构设计 (不偏离 doc/ARCHITECTURE.md)
[ ] 无未声明的依赖变更
```

### 门禁 3: 架构一致性

```
每次 Hermes 交付验证:
  新增文件是否在 ARCHITECTURE.md 的目录结构中?
  数据类型是否与 store 定义一致?
  Rust 命令签名是否与设计一致?
```

### 门禁 4: 安全敏感代码特殊审查

```
翻译端点验证 → 必须过安全审查
HTML iframe 渲染 → 必须过安全审查  
文件路径操作 → 必须检查路径展平
```

---

## 四、Hermes 调用规范

### 任务模板

```markdown
## Task: <批次名称>
### Goal
<one paragraph>

### Files to create/modify
<file list>

### TDD requirements
- Write tests FIRST (RED)
- Implement (GREEN)  
- Verify tests pass
- Coverage ≥ 80%

### Acceptance criteria
<list>

### Constraints
- Follow doc/ARCHITECTURE.md
- No console.log in production code
- Immutable patterns (never mutate, always copy)
- Error handling at every level
```

### 质量审查回复模板

```markdown
## 审查: <批次名称>
### 结果: PASS | FAIL | CONDITIONAL

### 检查项
[✅/❌] 测试通过: npm test
[✅/❌] 测试覆盖率 ≥ 80%
[✅/❌] 代码符合架构
[✅/❌] 错误处理完备
[✅/❌] 不可变模式
[✅/❌] 无 console.log

### 发现
<具体问题列表>

### 决定
PASS → 放行下一批
FAIL → Hermes continue_task 修复
CONDITIONAL → 修复后直接进入下一批, 无需再次审查
```
