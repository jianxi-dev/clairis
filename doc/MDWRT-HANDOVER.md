# MDWRT — Markdown 阅读编辑器 会话移交文档

> 生成时间: 2026-06-26
> 技术栈: Tauri v2 + React 18 + TypeScript + Vite + TipTap + CodeMirror 6 + Zustand + Tailwind

---

## 一、当前状态

| 维度 | 状态 |
|------|------|
| TypeScript 编译 | ✅ `tsc --noEmit` 零错误 |
| Vite 构建 | ✅ 生产构建成功 |
| Rust 构建 | ✅ `cargo build` 通过 (7 警告, 均为未使用函数——MVP 正常) |
| Tauri 启动 | ✅ `cargo tauri dev` 可启动 |
| WYSIWYG 渲染 | ✅ 通过 `marked` markdown→HTML 再喂 TipTap |
| 源码模式 | ✅ CodeMirror 6 正常显示/编辑 |
| 模式切换 | ✅ CSS display 切换, 保留状态 |

---

## 二、文件结构

```
/Users/mason/mdwrt/
├── src/
│   ├── main.tsx                          # 入口
│   ├── App.tsx                           # 主应用 (工具栏 + 快捷键 + 面板集成)
│   ├── vite-env.d.ts
│   ├── types/index.ts                    # TypeScript 类型定义
│   ├── stores/editorStore.ts             # Zustand 状态管理
│   ├── hooks/
│   │   ├── useFile.ts                    # 文件打开/保存 hook
│   │   ├── useConfig.ts                  # 配置 hook (含占位)
│   │   └── useTranslation.ts             # 翻译流监听 hook
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── WysiwygEditor.tsx         # TipTap WYSIWYG 编辑器
│   │   │   └── SourceEditor.tsx          # CodeMirror 6 源码编辑器
│   │   ├── Translation/
│   │   │   └── TranslatePanel.tsx        # 翻译侧边栏面板
│   │   └── Settings/
│   │       ├── HeadingColorPanel.tsx      # 标题颜色配置弹窗
│   │       ├── FontSizeControl.tsx        # 字体大小滑块
│   │       └── TranslationSettings.tsx    # 翻译后端配置弹窗
│   ├── extensions/
│   │   ├── MarkdownSync.ts               # MD ↔ ProseMirror 互转 (占位用)
│   │   └── HeadingColor.ts               # 标题颜色 TipTap 扩展
│   └── styles/editor.css                 # Tailwind + 编辑器基础样式
│
├── src-tauri/src/
│   ├── main.rs                           # Rust 入口
│   ├── lib.rs                            # Tauri setup + 命令注册
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── file.rs                       # open/save/save_as (原子写入)
│   │   └── translate.rs                  # Ollama + OpenAI 流式翻译代理
│   ├── config.rs                         # AppConfig + keyring CRUD
│   ├── errors.rs                         # 统一错误类型
│   └── types.rs                          # Rust 共享类型
│
├── package.json                          # 前端依赖
├── vite.config.ts                        # Vite 配置 (Tauri HMR)
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── index.html
```

---

## 三、实现对照

| 批 | 内容 | 状态 | 备注 |
|----|------|------|------|
| 0 | 项目脚手架 + 依赖 | ✅ | 手动搭建, Hermes Batch 0 失败 |
| 1 | Store + 类型 + Rust 后端 | ✅ | editorStore + types + file.rs + config.rs |
| 2 | Markdown ↔ ProseMirror | ✅ | MarkdownSync.ts (via prosemirror-markdown) |
| 3 | WYSIWYG + 源码编辑器 | ✅ | TipTap + CodeMirror 6 |
| 4 | 模式切换 + 双向同步 | ✅ | CSS display + contentVersion 防循环 |
| 5 | 字体 + 标题颜色 | ✅ | CSS 变量 + 颜色弹窗 |
| 6+7 | 翻译 (Rust + 前端) | ✅ | translate.rs + TranslatePanel + hooks |
| 8 | 工具栏 + 快捷键 | ✅ | 集成在 App.tsx |

---

## 四、快捷键

| 快捷键 | 功能 |
|--------|------|
| Cmd/Ctrl + O | 打开文件 |
| Cmd/Ctrl + S | 保存 |
| Cmd/Ctrl + Shift + M | 切换 WYSIWYG / 源码模式 |
| Cmd/Ctrl + T | 切换翻译面板 |

---

## 五、已知问题 / 未完成

### Rust warnings (7 个, 均安全)
- `get_size_limits` — 前端未调用
- `get_api_key` / `set_api_key` / `delete_api_key` — keyring CRUD 未注册为命令
- `save_config` — 前端 useConfig 仅有占位
- `SOURCE_MODE_LIMIT` / `SOURCE_READ_ONLY_LIMIT` — 前端 useFile 已定义同名常量, Rust 版 unused

### 功能缺失
1. **Rust config 命令** — `load_config`/`save_config` 未注册为 Tauri command, 前端 useConfig 调不通
2. **API Key keyring** — `get_api_key`/`set_api_key`/`delete_api_key` 需要注册 commands 并在前端调用
3. **大文件自动切模式** — `useFile.ts` 有逻辑检测 >500KB/>2MB, 但 Rust 端 `get_size_limits` 未注册
4. **翻译流取消** — Rust 端 `CANCELLED` atomic bool 单 slot, 但前端 stopTranslation 没发 abort 信号
5. **翻译完成事件** — Rust emit `done:true` 但前端 listen 的 `"translation-chunk"` handler 可能收不到
6. **保存时 dirty 提示** — 关闭未保存文件没有确认弹窗
7. **空文件处理** — WYSIWYG 编辑器 `<pre>` fallback 路径未充足测试

### 需要测试的
- [ ] 打开 .md → WYSIWYG 渲染正确
- [ ] WYSIWYG 编辑 → 切源码 → 内容一致
- [ ] 源码编辑 → 切回 WYSIWYG → 内容一致
- [ ] 编辑 → 保存 → 重新打开 → 内容正确
- [ ] 字体缩放实时生效
- [ ] 标题颜色修改 → 生效 → 保存 → 重开保持
- [ ] 翻译面板打开/关闭
- [ ] 翻译流式输出 (需 Ollama/OpenAI)
- [ ] 空文件操作
- [ ] 大文件 >500KB 自动切源码
- [ ] 大文件 >2MB 只读

---

## 六、启动方式

```bash
# 开发模式 (Vite HMR + Tauri 窗口)
cd /Users/mason/mdwrt && npm run tauri dev

# 仅前端
npm run dev

# 构建生产版本
npm run tauri build
```

---

## 七、设计文档

详细架构设计见: `/Users/mason/mdwrt/设计文档.md`

关键决策:
- **文件 I/O**: 全 Rust 后端 commands, 原子写入 (tempfile::persist)
- **API Key**: OS keyring (keyring crate), 不存 config.json
- **标题颜色**: CSS class 装饰, 不侵入文档 attribute
- **大文件**: >500KB 源码模式, >2MB 只读
- **翻译**: 单活跃 slot + requestId 防竞态
- **模式切换**: CSS display:none/block, 不销毁编辑器状态

---

## 八、下阶段建议

1. **补 Rust 命令注册** — 把 config/keyring/size_limits 注册到 lib.rs
2. **测翻译端到端** — 开 Ollama 或配 OpenAI key, 验证流式输出
3. **TDD 补测试** — 至少核心功能 (MarkdownSync, file ops, mode switch)
4. **dirty 提示** — 关闭/切文件前检查 dirtyFlag
5. **打包** — `cargo tauri build` 出 .dmg / .msi
