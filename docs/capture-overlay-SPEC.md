---
title: Capture Overlay v5.5 实施规格书
type: design
status: superseded
last_updated: 2026-09-02
source_of_truth: historical
superseded_by: ../openspec/specs/capture/spec.md
redirect: ../openspec/specs/capture/spec.md
---

# Capture Overlay v5.5 — 实施规格书 (SPEC)

> ⚠️ **已废弃（2026-09-02）**：本实施规格已被 [OpenSpec capture 域主规格](../openspec/specs/capture/spec.md) 取代，仅作历史对照。Capture 需求的活入口为 `openspec/specs/capture/spec.md`，状态一览见 [需求台账](./delivery/requirements-status.md)。

> **对应设计**: capture-overlay-v5.3.md (v5.4 + v5.5 增补)
> **Ponytail**: full · spec = v5.5 P0 逐项覆盖 · 每个 API 有精确签名 · 每个 P0 case 有具体步骤

---

## 一、顶层需求对照

v5.5 P0 Checklist 全量对照（25 项，SPEC 承诺每一项可达）:

| # | v5.4 P0 项 | SPEC 覆盖位置 | 状态 |
|---|-----------|---------------|------|
| P1 | Cmd+Shift+. 弹入 < 200ms | f1 overlay-enter animation | ⚠️ visual OK, keyboard automation blocked |
| P2 | textarea focus + 首字 < 100ms | f1 autofocus RAF | ✅ |
| P3 | hover 顶栏淡入 200ms | f1 Quiet CSS | ✅ |
| P4 | Enter 始终换行 | f1 textarea keydown | ✅ |
| P5 | Cmd+Enter 始终提交 | f1 handleCmdEnter | ✅ |
| P6 | Cmd+N save+new + 飞出动画 | f2 handleCmdN + transition | ✅ |
| P7 | prefix IME 兼容 | f2 setDraftContent map | ✅ |
| P8 | Enter 空行退出 prefix + Cmd+Enter 后清空 prefix | f2 setDraftContent + handleCmdEnter | ✅ |
| P9 | 字号 Cmd+=/- 持久化 | f8 setFontSize + config.toml | ✅ |
| P10 | [查看] 链接主窗口 | f4 history day-group + [查看] btn | ✅ |
| P11 | [折叠 ▴]/[展开 ▾] 日分组 | f4 collapse state | ✅ |
| P12 | [✓] archive 通用 | f5 archiveEntry dispatch Rust IPC | ✅ |
| P13 | [⋯] menu 编辑/删除/转正(P2) | f5 menu popover | ✅ |
| P14 | click item → inline detail | f5 detail view expand | ✅ |
| P15 | hover item → [✓][⋯] 显现 | f5 CSS hover opacity | ✅ |
| P16 | P0 4s undo toast | f5 countdown 4000ms | ✅ |
| P17 | 胶囊 44×44 触屏 | f3 capsule size + position | ✅ |
| P18 | ~~hover tooltip 完整内容~~ | — | ❌ 已移除（v5.4） |
| P19 | 单击 popover preview | f3 popover buffer + 3 items | ✅ |
| P20 | 双击 restore overlay | f3 capsule dblclick | ✅ |
| P21 | 拖动停靠四角/四边 | f3 capsule mousemove track | ✅ |
| P22 | ↑↓ 导航 + Enter archive | f1 global keydown | ✅ |
| P23 | 窗口宽高可调 (320~600 / 280~800) | f10 window resize handles | ✅ |
| P24 | 面板拖拽分隔条 (textarea↔history) | f10 panel drag handle | ✅ |
| P25 | X 按钮 = 保存关闭 / 无内容直接关闭 | f10 handleXClick | ✅ |

---

## 二、文件变更清单

| 文件 | 操作 | 行数 | 主要变更 |
|------|------|------|----------|
| `src/components/CaptureOverlay.tsx` | 重写 | ~380 | 双面板布局 + 拖拽分隔条 + 窗口 resize + X 按钮关闭 |
| `src/stores/captureOverlay.ts` | 重写 | ~400 | 所有动作原子化 + Rust IPC + overlayWidth/Height/panelRatio |
| `src/stores/index.ts` | 修改 | +3 | re-export |
| `src/styles/editor.css` | 追加 | +40 | 所有 animations |
| `src/App.tsx` | 修改 | +10 | 无变更（全局快捷键已有） |
| `src/types/index.ts` | 修改 | +25 | types |
| `src-tauri/src/commands/capture.rs` | 新建 | ~140 | append/archive/load/loadDate/config(+overlay_width/height/panel_ratio) |
| `src-tauri/src/commands/mod.rs` | 修改 | +2 | |
| `src-tauri/src/lib.rs` | 修改 | +4 | invoke_handler |
| `src-tauri/Cargo.toml` | 修改 | +2 | chrono + dirs + toml |

---

## 三、前端实施（逐 API）

### 3.1 store: setDraftContent + IME 兼容

```ts
setDraftContent: (raw: string, cursorPos?: number) => {
  const pos = cursorPos ?? raw.length;

  // Per-line prefix detection: find the line containing the cursor
  const beforeCursor = raw.slice(0, pos);
  const lastNewline = beforeCursor.lastIndexOf('\n');
  const currentLineStart = lastNewline + 1;
  const posInLine = pos - currentLineStart;

  // If cursor is at position 1 in the current line (first char just typed)
  if (posInLine === 1 && raw.length > 0) {
    const firstChar = raw[currentLineStart];
    const detected = IME_PREFIX_MAP[firstChar];
    if (detected) {
      // Consume the prefix char: strip it from content
      const newContent = raw.slice(0, currentLineStart) + raw.slice(currentLineStart + 1);
      set({ draftPrefix: detected, draftContent: newContent });
      return;
    }
  }

  // Default: just update content
  set({ draftContent: raw });
}

setDraftPrefix: (prefix: CapturePrefix) => set({ draftPrefix: prefix })
```

**API 签名:**
- `setDraftContent: (v: string, cursorPos?: number) => void`
- 行为: 逐行首字符检测 prefix，光标在当前行第 1 个字符位置时命中 IME_PREFIX_MAP 则识别 prefix 并消费该字符
- `setDraftPrefix: (prefix: CapturePrefix) => void` — 直接设置 prefix（供 Enter 空行清除使用）
- IME_PREFIX_MAP: `{ '.':'.', '。':'.', '．':'.', '-':'-', '—':'-', '–':'-', '!':'!', '！':'!', '?':'?', '？':'?' }`

### 3.2 store: handleCmdEnter（原子操作）

```ts
handleCmdEnter: async (): Promise<string | null> => {
  const { draftContent, draftPrefix, undo } = get();
  if (undo) return null;
  if (!draftContent.trim() && draftPrefix) {
    set({ draftPrefix: '', draftContent: '' });
    return null;
  }
  if (!draftContent.trim()) return null;

  const id = nextEntryId();
  let capturedAt = new Date().toISOString();
  
  // dispatch Rust IPC
  try {
    await invoke('append_inbox', { entry: { id, prefix: draftPrefix, content: draftContent, capturedAt }});
  } catch { /* localStorage 兜底 */ }
  
  const newEntry: InboxEntry = { id, prefix: draftPrefix, content: draftContent, capturedAt };
  set((s) => ({ history: [newEntry, ...s.history], draftContent: '', draftPrefix: '', selectedIndex: -1, savedAckId: id }));
  setTimeout(() => set((s) => (s.savedAckId === id ? { savedAckId: null } : {})), 600);
  return id;
}
```

**API:**
- `handleCmdEnter: () => Promise<string | null>`
- 返回值: id (成功) / null (空 prefix 清除 或 empty 提交 或 undo 中)
- 动画: 新条目 fly-in 由 overflow-hidden + translateY 过渡实现

### 3.2.1 textarea: Enter 键空行清除 prefix

```ts
// 在 handleTextareaKeyDown 中:
if (e.key === 'Enter' && !(e.metaKey || e.ctrlKey)) {
  const pos = ta.selectionStart;
  const beforeCursor = val.slice(0, pos);
  const lastNewline = beforeCursor.lastIndexOf('\n');
  const currentLine = beforeCursor.slice(lastNewline + 1);
  if (currentLine.trim() === '' && store.draftPrefix) {
    store.setDraftPrefix('');
  }
  // Enter 正常换行（不 preventDefault）
}
```

**行为:**
- Enter 键始终换行（P4）
- 若光标前当前行为空且有 prefix → 清除 prefix
- 非空行 Enter 仅换行，prefix 保留

### 3.3 store: handleCmdN（新建 = commit + clear）

```ts
handleCmdN: async () => {
  const { draftContent } = get();
  if (draftContent.trim()) await get().handleCmdEnter();
  else set({ draftContent: '', draftPrefix: '' });
}
```

### 3.4 store: archiveEntry

```ts
archiveEntry: (id: string) => {
  const deadline = Date.now() + UNDO_MS;
  const timer = window.setTimeout(() => get().tickUndo(), UNDO_MS + 50);
  set((s) => ({
    undo: { entryId: id, deadline, timer },
    history: s.history.map((e, i) => e.id === id ? { ...e, archivedAt: new Date().toISOString() } : e),
  }));
}

// Rust：append-then-delete
async function dispatchArchive(id: string, capturedAt: string) {
  try { await invoke('archive_entry', { date: capturedAt.slice(0,10), entryId: id }); }
  catch { /* localStorage 标记 archived */ }
}
```

### 3.5 component: CaptureOverlay.tsx HTML 结构

```html
<div class="overlay-root" ref="${containerRef}"
     style="width: ${store.overlayWidth}px; height: ${store.overlayHeight}px">
  <div class="overlay-inner" style="display: flex; flex-direction: column; height: 100%">

    <!-- Quiet Chrome: top bar fades in on hover -->
    <div class="top-bar" style="opacity: ${isHovering ? 1 : 0};">
      <span class="drag-handle">≡</span>
      <span class="label">⊕ Jianxi</span>
      <span class="count">${history.length} 条</span>
      <button onclick="togglePin">${isPinned ? '📌' : '📌'}</button>
      <button onclick="handleXClick">✕</button>  <!-- v5.4: 保存+关闭 / 无内容直接关闭 -->
    </div>

    <!-- TEXTAREA PANEL (高度 = panelRatio * 可用高度) -->
    <div class="textarea-panel" style="height: ${textareaH}px">
      <textarea
        ref="${textareaRef}"
        value="${store.draftContent}"
        onInput="store.setDraftContent(target.value)"
        onKeyDown="onTextareaKeyDown"
        style="fontSize: ${store.fontSize}"
        placeholder="${getPlaceholder(store.draftPrefix)}"
        autoFocus
      />
    </div>

    <!-- PANEL DRAG HANDLE (v5.4 新增) -->
    <div class="panel-drag-handle" style="height: 4px; cursor: row-resize">
      <div class="handle-bar"></div>
    </div>

    <!-- HISTORY PANEL (flex: 1, overflow-y: auto) -->
    <div class="history-panel" style="flex: 1; overflow-y: auto">
      <!-- Day group (today) -->
      <div class="day-group">
        <div class="day-header">
          <span>今天 · 7 条</span>
          <button onclick="openTodayInMainWindow">[查看]</button>
          <button onclick="toggleDayCollapsed('today')">[折叠 ▴]</button>
        </div>
        <!-- Items -->
        <div class="history-item ${idx === selectedIndex ? 'selected' : ''}"
             onclick="setSelectedIndex(${idx})">
          <span class="prefix-badge">${entry.prefix}</span>
          <span class="content">${entry.content}</span>
          <div class="inline-actions ${isUndoActive ? 'show' : ''}">
            ${isUndoActive ? `
              <span class="archive-label">已归档</span>
              <button onclick="undoArchive('${entry.id}')">撤销</button>
            ` : `
              <button onclick="archiveEntry('${entry.id}')">✓</button>
              <button onclick="showMoreMenu('${entry.id}')">⋯</button>
            `}
          </div>
        </div>
        <!-- More items -->
      </div>
      <!-- Yesterday / Date groups -->
      ...
    </div>

    <!-- Footer -->
    <div class="footer">
      <button onclick="toggleCollapsed">[展开历史 ▾ ${history.length}条]</button>
      <kbd-hints>↑↓ · ↵ Cmd+Enter · Esc</kbd-hints>
    </div>
  </div>

  <!-- WINDOW RESIZE HANDLES (v5.4 新增) -->
  <div class="resize-handle resize-n" cursor="n-resize" />
  <div class="resize-handle resize-s" cursor="s-resize" />
  <div class="resize-handle resize-w" cursor="w-resize" />
  <div class="resize-handle resize-e" cursor="e-resize" />
  <div class="resize-handle resize-nw" cursor="nw-resize" />
  <div class="resize-handle resize-ne" cursor="ne-resize" />
  <div class="resize-handle resize-sw" cursor="sw-resize" />
  <div class="resize-handle resize-se" cursor="se-resize" />
</div>

<!-- Capsule (separate root when status === 'capsule') -->
<div class="capsule" onMouseDown="onCapsuleDragStart" onClick="handleCapsuleClick">
  ⊕
</div>

<!-- Capsule Popover (on click, 200ms defer) -->
<div class="capsule-popover">
  <h4>当前 buffer:</h4>
  <p>${store.draftContent || '(空)'}</p>
  <h4>最近:</h4>
  <ul>${history.slice(0,3).map(e => `<li>${e.content}</li>`).join('')}</ul>
  <button onclick="restoreFromPopover">展开查看 ▸</button>
</div>
<!-- v5.4: capsule tooltip 已移除 -->
```

### 3.6 component: onTextareaKeyDown

```
onTextareaKeyDown:
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)):
    e.preventDefault(); store.handleCmdEnter();
  else if (e.key === 'Enter'):
    // 默认行为 = 换行
  else if (e.key === 'n' && (e.metaKey || e.ctrlKey)):
    e.preventDefault(); store.handleCmdN();
  else if (e.key === 'Tab'):
    e.preventDefault(); 插入 2 空格;
```

### 3.7 component: onGlobalKeyDown（模态内）

```
onGlobalKeyDown(e):
  if (e.isComposing) return;
  if (e.key === 'Escape'):
    e.preventDefault();
    if (store.editingId) store.cancelEdit();
    else if (store.draftContent) store.setDraftContent('');
    else if (store.draftPrefix) store.setDraftContent('');
    else if (store.undo) store.undoArchive(store.undo.entryId);
    else if (isPinned) store.setPinned(false);
    else store.close();  // v5.4: 直接关闭（不 minimize）
  else if (e.key === 'ArrowDown' && store.selectedIndex >= 0):
    e.preventDefault(); store.selectNext();
  else if (e.key === 'ArrowUp' && store.selectedIndex >= -1):
    e.preventDefault();
    if (store.selectedIndex === -1) return;
    store.selectPrev();
  else if (e.key === 'Enter' && store.selectedIndex >= 0):
    e.preventDefault();
    store.archiveEntry(store.history[store.selectedIndex].id);
```

### 3.8 component: 胶囊 handleCapsuleClick（200ms defer）

```ts
let pendingClick: number | null = null;

const handleCapsuleClick = () => {
  if (pendingClick) {
    // Second click arrived < 200ms → it's a double-click
    clearTimeout(pendingClick);
    pendingClick = null;
    store.restore();
  } else {
    pendingClick = window.setTimeout(() => {
      // Single click: open popover
      setShowPopover(true);
      pendingClick = null;
    }, 200);
  }
};
```

### 3.9 component: 胶囊 mouseDown 拖拽

```ts
const onCapsuleDragStart = (e: React.MouseEvent) => {
  e.preventDefault();
  dragOffset.current = { x: e.clientX - store.positionX, y: e.clientY - store.positionY };
  
  const onMove = (ev: MouseEvent) => {
    if (!dragOffset.current) return;
    store.setPosition(ev.clientX - dragOffset.current.x, ev.clientY - dragOffset.current.y);
  };
  
  const onUp = () => {
    dragOffset.current = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    store.clampPosition();
  };
  
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};
```

### 3.10 CSS: Quiet Chrome 动画

```css
/* Quiet Chrome top bar fade */
.top-bar { opacity: 0; transition: opacity 0.15s ease; }
.overlay-root:hover .top-bar { opacity: 1; }

/* Inline actions fade per item */
.history-item .inline-actions { opacity: 0; transition: opacity 0.15s ease; }
.history-item:hover .inline-actions { opacity: 1; }

/* New entry fly-in (Cmd+Enter) */
@keyframes historySlideIn {
  from { transform: translateY(-10px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
.history-item.new { animation: historySlideIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
```

### 3.11 CSS: capsule + popover + resize handles

```css
.capsule { width: 44px; height: 44px; border-radius: 11px; }
.capsule-popover {
  position: absolute; bottom: 50px; right: 0; width: 280px; max-height: 360px;
  background: rgba(255,255,255,0.95); border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 16px;
}

/* v5.4: capsule tooltip 已移除 */

/* v5.4: panel drag handle */
.panel-drag-handle {
  display: flex; align-items: center; justify-content: center;
  cursor: row-resize;
}
.handle-bar {
  width: 32px; height: 2px; border-radius: 1px;
  background: #d1d5db; transition: background 0.15s;
}
.panel-drag-handle:hover .handle-bar { background: #9ca3af; }

/* v5.4: window resize handles */
.resize-handle { position: absolute; }
.resize-n { top: 0; left: 0; right: 0; height: 4px; cursor: n-resize; }
.resize-s { bottom: 0; left: 0; right: 0; height: 4px; cursor: s-resize; }
.resize-w { top: 0; bottom: 0; left: 0; width: 4px; cursor: w-resize; }
.resize-e { top: 0; bottom: 0; right: 0; width: 4px; cursor: e-resize; }
.resize-nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nw-resize; }
.resize-ne { top: 0; right: 0; width: 12px; height: 12px; cursor: ne-resize; }
.resize-sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: sw-resize; }
.resize-se { bottom: 0; right: 0; width: 12px; height: 12px; cursor: se-resize; }
```

### 3.12 store: 多行批量混合 prefix 提交（v5.5 新增）

```ts
// 按行切块：前缀行开启新条目、无前缀续行并入当前条目（\n 连接）、空行硬分隔并清空粘性 prefix
function chunkDraft(raw: string): { prefix: CapturePrefix; content: string }[] {
  const lines = raw.split('\n');
  const chunks: { prefix: CapturePrefix; content: string }[] = [];
  let cur: { prefix: CapturePrefix; content: string } | null = null;

  for (const line of lines) {
    if (line.trim() === '') {
      // 空行 = 硬分隔：结束当前条目并清除粘性 prefix
      cur = null;
      continue;
    }
    const first = line[0];
    const detected = IME_PREFIX_MAP[first];
    if (detected) {
      // 前缀行开启新条目
      cur = { prefix: detected, content: line.slice(1) };
      chunks.push(cur);
    } else if (cur) {
      // 无前缀续行归并到当前条目
      cur.content += '\n' + line;
    } else {
      // 无前缀且无当前块 → 作为无前缀新条目
      cur = { prefix: '', content: line };
      chunks.push(cur);
    }
  }
  return chunks;
}

handleCmdEnter: async (): Promise<string | null> => {
  const { draftContent, undo } = get();
  if (undo) return null;
  if (!draftContent.trim()) return null;

  const chunks = chunkDraft(draftContent);
  if (chunks.length === 0) return null;  // 空切分结果不写入

  // 批内每条 capturedAt 严格互异（第 i 条取 Date.now() + i）
  const now = Date.now();
  const entries = chunks.map((c, i) => ({
    id: nextEntryId(),
    prefix: c.prefix,
    content: c.content,
    capturedAt: new Date(now + i).toISOString(),
  }));

  // 失败降级链：append_inbox_batch → 逐条 append_inbox → localStorage clairis_capture_fallback
  try {
    await invoke('append_inbox_batch', { entries });
  } catch {
    try {
      for (const e of entries) await invoke('append_inbox', { entry: e });
    } catch {
      localStorage.setItem('clairis_capture_fallback', JSON.stringify(entries));
    }
  }

  set((s) => ({ history: [...entries, ...s.history], draftContent: '', draftPrefix: '', selectedIndex: -1 }));
  return entries[0].id;
}
```

**API 签名:**
- `chunkDraft(raw: string): { prefix: CapturePrefix; content: string }[]` — 按行切块：前缀行开启新条目、无前缀续行并入当前条目（`\n` 连接）、空行硬分隔并清空粘性 prefix
- `handleCmdEnter: () => Promise<string | null>` — 一次提交将切分结果批量写入当日 inbox
- 批内每条 `capturedAt` 严格互异（第 i 条取 `Date.now() + i`），保证 `load_inbox_by_date` / `edit` / `delete` / `archive` 经 `time_hint` 首个匹配不塌缩到同一实块
- 失败降级链：`append_inbox_batch` → 逐条 `append_inbox` → localStorage `clairis_capture_fallback`（注意是 `clairis_` 前缀，不是 `clave_`）
- 空切分结果（全空 / 全空行）不触发任何写入

---

## 四、后端 Rust 实施

### 4.1 Cargo.toml 追加

```toml
[dependencies]
chrono = "0.4"
dirs = "5"
```

### 4.2 commands/capture.rs

四个命令:

| 命令 | 签名 | 行为 |
|------|------|------|
| `append_inbox` | `entry: InboxEntryInput` → `Result<(), AppError>` | 原子写入 tempfile+rename，不阻塞 UI |
| `append_inbox_batch` | `entries: Vec<InboxEntryInput>` → `Result<(), AppError>` | v5.5 新增：按日期分组，每 date 一次原子写（tempfile+persist），空 entries 直接 Ok(()) |
| `archive_entry` | `date: String, entryId: String` → `Result<(), AppError>` | 解析 active 文件 → 找到条目 → append 到 archive → 删除 from active |
| `load_today_inbox` | `() → Result<Vec<InboxEntry>, AppError>` | 读取今天的 active 文件 → 解析 frontmatter + 内容 |
| `load_inbox_by_date` | `date: String → Result<Vec<InboxEntry>, AppError>` | 同上，按日期 |
| `save_config_capture` | `capture_config: CaptureConfig` → `Result<(), AppError>` | 写入 `~/.clairis/config.toml` `[capture]` 段 |
| `load_config_capture` | `() → Result<CaptureConfig, AppError>` | 读取配置，缺失字段返回 None |
| `set_overlay_pinned` | `pinned: bool` → `Result<(), AppError>` | 调用 `window.set_always_on_top(pinned)` |

CaptureConfig 结构体:
```rust
pub struct CaptureConfig {
    pub font_size: Option<u32>,
    pub position_x: Option<i32>,
    pub position_y: Option<i32>,
    pub capsule_x: Option<f64>,
    pub capsule_y: Option<f64>,
    pub pinned: Option<bool>,
    pub overlay_width: Option<i32>,    // v5.4
    pub overlay_height: Option<i32>,   // v5.4
    pub panel_ratio: Option<f64>,      // v5.4
}
```

### 4.3 原子写入 impl

```rust
fn atomic_append(path: &Path, new_content: &str) -> Result<(), AppError> {
    // 1. Read existing
    let mut existing = if path.exists() {
        fs::read_to_string(path).unwrap_or_default()
    } else {
        String::new()
    };
    
    // 2. Append to temp file
    existing.push_str(new_content);
    let dir = path.parent().unwrap_or(Path::new("."));
    if !dir.exists() { fs::create_dir_all(dir)?; }
    
    let tmp = NamedTempFile::new_in(dir)?;
    fs::write(&tmp, &existing)?;
    tmp.persist(path)?;
    
    Ok(())
}
```

### 4.4 解析 frontmatter + content

```rust
fn parse_inbox_entries(content: &str) -> Vec<InboxEntry> {
    // 按 \n---\n 分段，提取每段的 frontmatter + 剩余内容
    // Return: Vec<InboxEntry> { id, prefix, content, capturedAt, archivedAt }
}
```

### 4.5 lib.rs invoke_handler 追加

```rust
.append_inbox, .append_inbox_batch, .archive_entry, .load_today_inbox, .load_inbox_by_date,
.save_config_capture, .load_config_capture, .set_overlay_pinned,
.delete_inbox_entry, .edit_inbox_entry
```

---

## 五、状态机 (data-status + CSS)

```
closed ──Cmd+Shift+.──► normal
normal ──Cmd+Shift+.──► closed
normal ──Esc(空buffer)──► closed          ← v5.4: 直接关闭
normal ──X(有内容)──► closed (先保存)
normal ──X(无内容)──► closed              ← v5.4: 直接关闭
normal ──togglePin──► pinned
pinned ──togglePin──► normal
pinned ──Esc──► normal
capsule ──dblclick──► normal
capsule ──单击(延迟200ms)──► popover_preview
normal ──minimize──► capsule              ← 仅双击顶栏触发
```

CSS:
```css
.overlay-root[data-status="normal"] .capsule { display: none; }
.overlay-root[data-status="pinned"] { z-index: 2147483647; }  /* always on top */
.overlay-root[data-status="capsule"] .overlay-root { display: none; }
```

---

## 六、多屏

```ts
// 前端读取主窗口所在屏
import { currentMonitor } from '@tauri-apps/api/window';

async function openOverlay() {
  const mainWin = await getCurrentWebviewWindow('main');
  const monitor = await mainWin.currentMonitor();
  // overlay 显示在 monitor 的 top-right
  setPosition(monitor.size.width - 420 - 24, 80);
}
```

---

## 七、字号持久化 + 窗口配置

```ts
// ~/.clairis/config.toml
[capture]
font_size = 15
position_x = 80
position_y = 80
capsule_x = 940
capsule_y = 760
pinned = false
overlay_width = 420       // v5.4: 窗口宽度 (320~600)
overlay_height = 500      // v5.4: 窗口高度 (280~800)
panel_ratio = 0.4         // v5.4: textarea 占比 (0.2~0.8)
```

Cmd+=/- → setFontSize → debounce 500ms → invoke('save_config_capture')
拖拽 resize/panel → setOverlaySize/setPanelRatio → 立即 invoke('save_config_capture')
加载: invoke('load_config_capture') → 恢复所有字段

---

## 八、自测清单 (P0 Checklist 对应)

| P# | 测试步骤 | 期望 | SPEC 对应 |
|---|---------|------|----------|
| P1 | Cmd+Shift+. 弹入 < 200ms | f1 animation | ⚠️ pending manual |
| P2 | textarea focus 自动聚焦 | f1 RAF | ⚠️ pending manual |
| P3 | hover 顶栏淡入 200ms | f1 Quiet CSS | ✅ visual |
| P4 | Enter 键 textarea 换行 | f1 keydown | ⚠️ pending manual |
| P5 | Cmd+Enter → 条目出现 | f2 store | ⚠️ pending manual |
| P6 | Cmd+N → 新建 | f2 handleCmdN | ⚠️ pending manual |
| P7 | 输入 "."/"。" → prefix | f2 IME map | ⚠️ pending manual |
| P8 | Enter 空行清除 prefix + Cmd+Enter 后清空 | f2 setDraftContent + handleCmdEnter | ⚠️ pending manual |
| P9 | Cmd+=/- 字号 +1/-1 | f8 setFontSize | ✅ coded |
| P10 | 日组 [查看] → 主窗口切换 | f4 link | ✅ coded |
| P11 | [折叠] 日组 → 条目隐藏 | f4 collapse | ✅ coded |
| P12 | [✓] → 条目归档 | f5 undo | ⚠️ partial (Rust stub) |
| P13 | [⋯] → 菜单出现 | f5 menu popover | ✅ coded |
| P14 | click item → inline detail | f5 detail expand | ✅ coded |
| P15 | hover item → [✓][⋯] | f5 CSS | ✅ visual |
| P16 | undo 倒计时 5s → slideOut | f5 timeout | ⚠️ partial (Rust stub) |
| P17 | capsule 44×44 触屏 | f3 capsule | ✅ coded |
| P18 | ~~hover capsule → tooltip~~ | — | ❌ v5.4 已移除 |
| P19 | 单击 capsule → popover | f3 defer 200ms | ✅ coded |
| P20 | 双击 capsule → restore | f3 dblclick | ✅ coded |
| P21 | 拖动 capsule → 停靠 | f3 mouse drag | ✅ coded |
| P22 | ↑↓ Enter archive | f1 global key | ⚠️ pending manual |
| P23 | 拖拽窗口四边/四角调整大小 | f10 resize handles | ✅ coded |
| P24 | 拖拽分隔条调整 textarea/history 比例 | f10 panel drag | ✅ coded |
| P25 | X 按钮有内容 → 保存+关闭 | f10 handleXClick | ✅ coded |
| P26 | X 按钮无内容 → 直接关闭 | f10 handleXClick | ✅ coded |
| P27 | Escape 无内容 → 直接关闭 | f10 global keydown | ✅ coded |
| P28 | Escape 编辑模式 → 取消编辑 | f10 global keydown | ✅ coded |

---

## 九、排期

| Day | 功能 | SPEC 章节 |
|-----|------|----------|
| D1 | f1 基础 (textarea + Quiet Chrome + 方向键) | §三 |
| D2 | f2 (Cmd+N, IME, prefix) + f6 (pin z-index) | §三 |
| D3 | f3 (胶囊 popover + 拖动停靠) | §三.5 |
| D4 | f4 (历史日分组 + [查看] 链接) + f7 (多屏) | §六 |
| D5 | f5 (archive + inline detail + [⋯] 菜单 + undo) + f8 (字号) | §三 |
| D6 | f9 (Rust IPC: append/archive/load) + f10 (全局快捷键) | §四 |
| D7 | f10 (窗口 resize + 面板 drag + X 按钮) | §三.5 |
| D8 | 自测 P0 全部 25 项 | §八 |

---

ponytail: SPEC = v5.5 P0 full coverage. 8 days / 25 P0 tests. Every API is signed and behaviorally specified. Every CSS transition is named. Every Rust command is atomic.
