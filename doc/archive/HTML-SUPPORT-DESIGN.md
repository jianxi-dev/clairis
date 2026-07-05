# HTML 支持设计概要 — Folio

> 基于 CORE-REQUIREMENTS.md §2.4，经 /office-hours 讨论后形成。
> 设计文档: `~/.gstack/projects/lqtdys-jianming/mason-main-design-20260629-233448.md`

---

## 一、原始需求

CORE-REQUIREMENTS.md §2.4 定义了 HTML 文件支持，但标记为 Phase 2 功能。讨论后决定：

**HTML ↔ Markdown 从架构第一天平权设计**，HTML 不是 Phase 2 附加功能。

## 二、用户定位

- **目标用户**: 普通文档用户（非技术人群）
- **核心诉求**: 不需要知道 .md vs .html 的区别。打开文件，Folio 识别格式，统一阅读体验
- **差异化**: 统一体验（不切浏览器）、秒开、便捷操作（快捷键/快速导航）、降低编辑难度

## 三、设计前提（已确认）

1. **HTML ↔ Markdown 架构平权** — `FileKind` 作为一等分发维度（✅ AGREED）
2. **阅读体验一致，编辑时分化** — 预览同一排版风格，编辑按格式切换 CM6 配置（✅ AGREED）
3. **HTML 预览信任本地文件** — 安全≈浏览器 file://，不注册 .html 文件关联（✅ AGREED，从原严格沙箱修订）

## 四、现有架构评估

**已做对的:**
- `types/index.ts` 已有 `FileKind = "markdown" | "html" | "text"` ✓
- `stores/index.ts` `detectFileKind()` 已处理 `.html` 后缀 ✓
- Tab 架构完全格式无关（存 fileKind + content + editorMode） ✓
- 预览/编辑/源码三种模式已存在 ✓

**HTML 支持所需改动:**
1. `src/renderers/` — 提取渲染管线，按 fileKind 分发
2. `HtmlPreview.tsx` — iframe srcdoc + CSP + sandbox
3. `ContentArea.tsx` — 编辑时按 fileKind 配置 CM6 扩展
4. 步骤 0 原型验证：Tauri v2 srcdoc + file:// 可行性

## 五、批准方案: Approach A — 格式平权，增量扩展

- 在现有 v2 架构上加 `fileKind=html` 渲染分支
- .md: marked→DOMPurify（现有不变）
- .html: iframe srcdoc 沙箱预览
- 编辑: 按 fileKind 切换 CM6 语言
- 预估工时: 4-6 天（含验证）

## 六、商业化考量

功能模块化已为未来 Freemium 分级做好准备：
- Free（MIT 开源）: 阅读 + 基础编辑
- Pro: 翻译、主题、高级渲染

Phase 0 不构建 license 基础设施。

## 七、关键风险

- srcdoc `<base href="file://">` 在 Tauri v2 webview 中可能被平台阻止（需步骤 0 原型验证）
- HTML 编辑目前仅 CM6 语法高亮，无 L2 可视化编辑
- 含脚本交互式 HTML 在预览中不运行（用户右键在浏览器打开）
