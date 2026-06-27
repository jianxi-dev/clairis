# MDWRT — 技术架构设计 v2

> 基于 CORE-REQUIREMENTS.md v2 (已通过 Codex 5 轮对抗审查)
> 技术架构已通过 Codex 2 轮审查, 14 条发现全部采纳

---

## 一、架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                    Tauri Shell (Rust)                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                 Webview (React + TS)                    │  │
│  │                                                         │  │
│  │  ┌──────────────┐  ┌──────────────────────────────┐   │  │
│  │  │   Sidebar     │  │      Content Area             │   │  │
│  │  │              │  │  ┌────┬────┬────┬────┬──┐    │   │  │
│  │  │ 最近文件     │  │  │t1 │t2 │t3 │.. │+ │    │   │  │
│  │  │ 文件树       │  │  ├────────────────────────┤   │   │  │
│  │  └──────────────┘  │  │  ┌─ PreviewView ─────┐ │   │  │  │
│  │                    │  │  │ marked→DOMPurify→  │ │   │  │  │
│  │                    │  │  │ 精美CSS渲染        │ │   │  │  │
│  │                    │  │  ├─ EditView ────────┐ │   │  │  │
│  │                    │  │  │ CM6+decoration L2 │ │   │  │  │
│  │                    │  │  └────────────────────┘ │   │  │  │
│  │                    │  │  └─ SourceView ────────┐ │   │  │  │
│  │                    │  │    CM6 raw (no decor) │ │   │  │  │
│  │                    │  │    └───────────────────┘ │   │  │  │
│  │                    │  └──────────────────────────┘   │  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Rust Backend (Tauri Commands)              │  │
│  │  file: open/save/save_as/read_dir/get_info             │  │
│  │  config: load/save + keyring CRUD                      │  │
│  │  translate: translate/stop + endpoint validation       │  │
│  │  system: open_with_default/reveal_in_finder/app_info   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 关键架构决策

| 决策 | 理由 |
|------|------|
| 阅读/编辑分离 (两个渲染管线) | 阅读不受编辑器限制, 可极致排版 |
| 模式切换用 CSS display 非 remount | 保留 CM6 编辑状态/undo/选区, 不重建 EditorView |
| store→CM6 同步 debounce 300ms | 避免每个 keystroke 同步到 store 的性能开销 |
| store 存纯文本, 不存编辑器对象 | 序列化/跨页签/恢复简单 |

---

## 二、核心数据模型

```typescript
// 文件类型
type FileKind = 'markdown' | 'html' | 'text'

// 编辑器模式
type EditorMode = 'preview' | 'edit' | 'source'

interface Tab {
  id: string
  title: string
  path: string | null
  fileKind: FileKind
  content: string
  dirty: boolean
  editorMode: EditorMode
  scrollPos: number
}

interface AppConfig {
  version: number               // schema 版本号, 用于迁移
  fontSize: number
  headingColors: Record<string, string>
  ollamaEndpoint: string
  openaiEndpoint: string
  openaiModel: string
  translationProvider: 'ollama' | 'openai'
  langPair: { source: string; target: string }
  theme: 'light' | 'dark' | 'auto'
  recentFiles: { path: string; name: string; openedAt: number }[]
}

interface AppStore {
  activeTabId: string | null
  tabs: Record<string, Tab>
  sidebarOpen: boolean
  fileTree: FileTreeEntry[] | null
  fileTreeRoot: string | null
  translation: TranslationState
  config: AppConfig

  // Actions
  openFile: (path: string) => Promise<void>
  saveFile: () => Promise<void>
  switchTab: (id: string) => void
  closeTab: (id: string) => void
  setEditorMode: (mode: EditorMode) => void
  updateContent: (content: string) => void  // debounced
  loadDirectory: (path: string) => Promise<void>
}
```

---

## 三、阅读渲染管线 (PreviewView)

```
store.content (markdown)
    │
    ▼
marked.parse(content)          ← GFM → HTML
    │
    ▼
DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['p','h1','h2','h3','h4','h5','h6',
                'ul','ol','li','pre','code',
                'blockquote','table','thead','tbody','tr','th','td',
                'img','a','em','strong','del','hr','br'],
  ALLOWED_ATTR: ['href','src','alt','title','class','target'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],         // 链接 target="_blank"
})
    │
    ▼
dangerouslySetInnerHTML
    │
    ▼
自定义 CSS:
  --reader-font-size: 16px
  --reader-line-height: 1.8
  --reader-max-width: 680px
  dark/light 变量切换
  代码高亮 (hljs 或 prism, Phase 1)
```

### 数据流 vs 编辑器的关系

```
PreviewView  ← 只读, 无交互状态
EditView     ← CM6 EditorView (保留实例, CSS display 切换)
SourceView   ← 同一 CM6 EditorView, 仅移除 decorations

模式切换不重建 CM6 EditorView:
  CSS display:none/block + decorations enable/disable
  保持 undo history, 选区, scroll 位置, composition state
```

---

## 四、编辑渲染管线 (EditView — CM6 L2)

### CM6 Setup

```typescript
const editorExtensions = [
  basicSetup,
  markdown({ base: markdownLanguage }),

  // Decorations (L2 美化)
  headingDecorator,        // `### ` → [H3 ▼] 标签
  boldItalicDecorator,     // `**`/`*` 隐藏
  listDecorator,           // `-` → • / `1.` → 数字
  taskListDecorator,       // `[ ]`/`[x]` → checkbox
  quoteDecorator,          // `>` → 灰块
  codeDecorator,           // `` `code` `` → 灰底等宽
  linkDecorator,           // `[text](url)` → 蓝色可点

  // IME: composition 时降级为 raw
  compositionFallback,

  // 同步到 store (debounced)
  EditorView.updateListener.of(debounced(300, update => {
    if (update.docChanged) {
      store.updateContent(update.state.doc.toString())
    }
  })),

  // 大文件 >500KB: 自动关闭 decorations
  largeFileGuard(500 * 1024),
]
```

### Decoration 实现策略

| 类型 | CM6 方案 | 匹配 |
|------|----------|------|
| 标题标签 | `Decoration.widget` 替换行前缀 | `^#{1,6} ` |
| 加粗/斜体 | `Decoration.mark` + CSS style | `**...**` / `*...*` |
| 列表标记 | `Decoration.line` + `::before` | `^[-*+] ` / `^\d+\. ` |
| 任务列表 | `Decoration.replace` 替换 checkbox | `^- \[[ x]\] ` |
| 引用 | `Decoration.line` + CSS border-left | `^> ` |
| 内联代码 | `Decoration.mark` + CSS background | `` `...` `` |
| 链接 | `Decoration.mark` + click handler | `[...](...)` |
| IME 降级 | `EditorState.transactionFilter` | composition events |

### 大文件守卫

使用 CM6 `Compartment` 控制 decoration extensions 的启用/禁用:

```typescript
// editors/setup.ts
const decorCompartment = new Compartment()

// 正常状态: 启用 decoration
decorCompartment.of([
  headingDecorator,
  boldItalicDecorator,
  listDecorator,
  // ...
])

// 大文件守卫: 监听文档长度变化, 动态切换 decoration
let prevLength = 0
EditorState.transactionFilter((tr) => {
  const len = tr.newDoc.length
  const overLimit = len > 500 * 1024
  const wasUnderLimit = prevLength <= 500 * 1024
  prevLength = len

  if (overLimit && wasUnderLimit) {
    // 超过阈值: 关闭 decoration
    return [tr, { effects: decorCompartment.reconfigure([]) }]
  }
  if (!overLimit && !wasUnderLimit) {
    // 低于阈值: 重新启用 decoration
    return [tr, { effects: decorCompartment.reconfigure(fullDecorations) }]
  }
  return [tr]
})

// 模式切换也复用同一个 Compartment reconfiguration
// edit→source: reconfigure([]), source→edit: reconfigure(fullDecorations)
```

> 超过 500KB 时自动禁用 decoration, 显示提示"文件较大, 已关闭格式美化". 切换到 SourceView 彻底避免 decoration 开销.

---

## 五、Rust Backend API

### 现有 (保留)

| Command | 说明 |
|---------|------|
| `open_file` | 对话框 → 读取文件, 含 fileKind 判断 |
| `save_file` | 原子写入 (tempfile::persist) |
| `save_as_file` | 对话框 + 原子写入 |
| `translate_text` | 流式翻译 (emit events) |

### 新增

| Command | 说明 | 安全要求 |
|---------|------|----------|
| `read_directory` | 递归读取目录 (max_depth=3, 排除 .git/node_modules/hidden) | 使用 `lstat` 检测 symlink, 不跟随。symlink 条目从树中排除 (不可选)。权限错误跳过 |
| `get_file_info` | 文件元信息 | — |
| `load_config` | 读取 app_config.json, schema 版本校验, 损坏回退默认 | 配置备份 `.bak` |
| `save_config` | 写入 app_config.json | — |
| `get_api_key` | keyring 读取 | — |
| `set_api_key` | keyring 写入 | — |
| `delete_api_key` | keyring 删除 | — |
| `stop_translation` | 取消当前翻译 | — |
| `open_with_default` | 系统默认打开文件 | 路径白名单: 仅已打开过的文件/目录 |
| `reveal_in_finder` | Finder 定位 | 同上 |
| `get_app_info` | 版本/更新检查 | 匿名 GitHub API |

### 端点安全策略 (翻译)

```rust
/// 翻译端点验证: 仅允许 http/https, 禁止非全局 IP
fn validate_translation_endpoint(url: &str, is_ollama: bool) -> Result<Url, AppError> {
    let parsed = Url::parse(url).map_err(|_| AppError::InvalidEndpoint)?;
    
    // 1. 协议白名单
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(AppError::InvalidEndpoint)
    }
    
    // 2. 解析 DNS → 实际 IP (防止 hostname 指向内网)
    let host = parsed.host_str().ok_or(AppError::InvalidEndpoint)?;
    let ips = resolve_dns(host).map_err(|_| AppError::DnsResolutionFailed)?;
    
    // 3. Ollama: 优先检查 — 仅允许 localhost, 跳过 IP 检查
    if is_ollama {
        if host != "localhost" && host != "127.0.0.1" && host != "[::1]" {
            return Err(AppError::EndpointBlocked { host: host.into(), ip: ips[0] })
        }
        return Ok(parsed)
    }
    
    // 4. OpenAI: 检查 DNS 解析 IP, 仅允许全局单播地址
    for ip in &ips {
        if !is_global_unicast(ip) {
            return Err(AppError::EndpointBlocked { host: host.into(), ip: *ip })
        }
    }
    
    // 5. 禁用 HTTP 重定向
    Ok(parsed)
}
```

> 实际 HTTP 客户端配置: `reqwest::Client::builder().no_default_headers().no_proxy().danger_accept_invalid_certs(false).redirect(reqwest::redirect::Policy::none())`

---

## 六、文件结构 (Phase 0)

```
src/
├── main.tsx
├── App.tsx                        # 布局: sidebar + tabs + viewport
├── components/
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── RecentFiles.tsx
│   │   └── FileTree.tsx
│   ├── Content/
│   │   ├── ContentArea.tsx         # 页签 + 视图切换
│   │   ├── PreviewView.tsx         # marked + DOMPurify + CSS
│   │   ├── EditView.tsx            # CM6 L2
│   │   └── SourceView.tsx          # CM6 raw
│   ├── Translation/
│   │   └── TranslatePanel.tsx
│   └── Settings/
│       └── SettingsModal.tsx
├── editors/
│   ├── setup.ts                   # CM6 扩展装配
│   └── decorations/
│       ├── heading.ts
│       ├── boldItalic.ts
│       ├── list.ts
│       ├── taskList.ts
│       ├── quote.ts
│       ├── code.ts
│       ├── link.ts
│       └── composition.ts
├── hooks/
│   ├── useFile.ts
│   ├── useConfig.ts
│   └── useTranslation.ts
├── stores/index.ts                # 多页签 Zustand store
├── types/index.ts
└── styles/
    ├── editor.css
    ├── theme-light.css
    └── theme-dark.css
```

---

## 七、迁移计划 (v1 → v2)

### 步骤

| # | 内容 | 影响文件 | 可逆? |
|---|------|----------|-------|
| 1 | 重构 Store: 单文件→多页签, 保留旧 store 并行运行 | stores/index.ts | ✅ feature flag |
| 2 | CM6 装配 + decorations (逐步增加) | editors/* | ✅ 新文件, 不删旧 |
| 3 | EditView + SourceView (CSS display 切换, 不重建 CM6) | EditView.tsx, SourceView.tsx | ✅ 新组件 |
| 4 | PreviewView (marked + DOMPurify) | PreviewView.tsx | ✅ 新组件 |
| 5 | App.tsx 集成新视图 + 模式切换 | App.tsx | ✅ 逐步替换 |
| 6 | Rust 后端补全 | src-tauri/src/* | ✅ 新增命令 |
| 7 | Sidebar | Sidebar/* | ✅ 新组件 |
| 8 | **验证通过后** 删除 v1 文件 (WysiwygEditor, MarkdownSync, HeadingColor, turndown, tipTap 等) | — | ❌ 不可逆, 但最后一步 |

> 注意: `marked` 在 v2 中用于阅读管线, **不能删除**. 迁移步骤应明确 `marked` 从编辑器管线移到阅读管线, 而不是完全移除.

### 迁移期间兼容

```typescript
// stores/index.ts — 双 store 并行
const v1Store = useV1EditorStore  // 旧组件读旧 store
const v2Store = createV2Store()   // 新组件读新 store

// 当所有组件迁移完毕 → 删除 v1Store
```

---

## 八、测试策略

| 层 | 工具 | 覆盖内容 | Phase |
|----|------|----------|-------|
| 单元 | vitest | store logic, decoration 匹配逻辑, Rust 命令 | P0 |
| 组件 | vitest + jsdom | 各 React 组件, DOMPurify 输入输出 | P0 |
| CM6 行为 | vitest + jsdom | decoration 正则匹配 (非 DOM 交互部分) | P0 |
| Rust 集成 | cargo test | 文件 I/O, 配置, 端点验证 | P0 |
| E2E (Playwright + Tauri) | Playwright | 打开文件/编辑/保存/翻译全流程 | P1 |

> ⚠️ CM6 decoration 在 jsdom 环境中的 DOM 交互行为无法完整模拟。decoration 的核心逻辑 (正则匹配 + 替换规则) 在单元测试中验证, 完整的 DOM 渲染效果在 P1 E2E 中覆盖。

---

## 九、已知技术风险 (扩展)

| 风险 | 影响 | 缓解 |
|------|------|------|
| CM6 decoration 动态更新冲突 | decoration 和输入法同时工作 | composition 降级为 raw |
| 大文件 + decoration | 内存/性能 | >500KB 自动关闭 decoration |
| 自动保存 + 外部修改冲突 | 数据丢失 | 检测文件修改时间, 冲突时提示用户 |
| 目录读取无限递归 | 卡死/崩溃 | symlink 检测, max_depth, 错误跳过 |
| 配置 schema 升级 | 旧配置不兼容 | version 字段 + 迁移函数 |
| store→CM6 双向同步 | 死循环 | debounce + version guard |
| macOS 文件关联 | plist 注册 | 只在用户许可时注册 |

---

## 十、Phase 0 实现步骤

| 批次 | 内容 | 依赖 | 工时 |
|------|------|------|------|
| P0-0 | 重构 Store 为多页签 (并行运行) | 无 | 1天 |
| P0-1 | CM6 装配 + 5 个核心 decorations (heading/粗斜体/列表/引用/代码) | P0-0 | 3天 |
| P0-2 | EditView + SourceView + CSS display 模式切换 | P0-1 | 2天 |
| P0-3 | PreviewView (marked + DOMPurify + 基础主题 CSS) | P0-0 | 2天 |
| P0-4 | Rust 后端补全 (directory/config/keyring/stop_translation) | 无 | 2天 |
| P0-5 | 模式切换集成到 App.tsx + 工具栏 | P0-2 P0-3 | 1天 |
| P0-6 | translation 适配新 store + 端点安全验证 | P0-4 | 1天 |
| P0-7 | 测试 + 联动调试 | 全部 | 3天 |
| P0-8 | 删除 v1 组件 + 清理依赖 | 全部 | 1天 |

**合计: ~16 工作日 (3-4 周)**

> ⚠️ 此为保守估计。实际可能因 decoration 调试、CM6 兼容性问题、以及 Rust 命令集成而延长至 4-6 周。移动端和 Windows 不在 Phase 0 范围内。

---

## 十一、安全边界

| 入口 | 防护 |
|------|------|
| Markdown 渲染 | marked → DOMPurify (白名单标签/属性) |
| HTML 预览 | srcdoc + sandbox + `<meta CSP>` + Tauri asset protocol |
| 翻译端点 | URL scheme 白名单 + 私网 IP 检测 + localhost-only Ollama |
| 文件路径 | 仅允许已打开的文件/目录路径 |
| API Key | OS keyring |
| 文件写入 | tempfile::persist 原子写入 |
| 更新检查 | GitHub API 匿名请求, 可关闭 |
| 日志 | 不记录文档内容/API Key |

---

> 本文档为技术架构总纲。所有实现在此框架下进行。
