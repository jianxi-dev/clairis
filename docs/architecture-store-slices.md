# 标月架构收敛 — Store Slice 最终方案

> 状态: 已定稿
> 来源: Codex + Ponytail 5 轮对抗审查
> 目标: 合并两个 deprecated store，拆分导航面板状态，保持单 store 一致性

---

## 一、结论：Single Store + 3 Slices

```
store/
  index.ts       // createAppStore()，组合 slices
  tabs.ts        // 标签、分屏、recentFiles、per-tab editor state
  nav.ts         // 面板、搜索、侧栏、上下文种子
  config.ts      // 用户偏好、主题、字体、持久化配置
```

单 store 避免跨 store 同步 bug。Slice 文件按"行为发生的位置"划分边界：用户在标签/编辑区操作 → `tabs.ts`；用户在面板/搜索区操作 → `nav.ts`；用户改偏好设置 → `config.ts`。

---

## 二、字段映射

### tabs.ts — "文档生命周期"

| 字段 | 理由 |
|------|------|
| activeTabId | 标签切换 |
| tabs (Record<string, Tab>) | 标签集合 |
| recentFiles ([]) | 跨目录 MRU |
| splitDirection / splitTabIds / splitActiveTabId / splitEditorMode | 分屏状态 |
| horizontalSplitRatio / verticalSplitRatio | 分屏比例 |
| editorMode / splitEditorMode | 编辑/预览模式（per-tab） |
| content / dirty / filePath / fileName / fileSize / contentVersion | 当前标签文档状态 |
| translation | 翻译面板状态（P1，跨 tab 共用） |

Actions: openTab, closeTab, switchTab, moveTab, updateTabContent, markDirty, saveActiveTab, closeAllTabs, restoreRecentFile, openInSplit, closeSplit, switchSplitTab, setSplitDirection, setSplitRatio, setEditorMode, setSplitEditorMode, setTranslation, bumpContentVersion

---

### nav.ts — "面板与搜索"

| 字段 | 理由 |
|------|------|
| sidebarLeftVisible/sidebarRightVisible | 侧栏可见性 = 面板显示（不是标签行为） |
| navView ('context' \| 'search' \| 'inline') | 面板三视图 |
| searchQuery | 搜索框内容 |
| selectedIndex | 面板选中项序号 |
| contextSeed | 正文选中文本种子 |
| dirFiles | 当前目录枚举缓存 |
| panelOpen | 面板开关 |
| readingMode | 沉浸阅读模式（全局 chrome 状态） |

// ponytail: readingMode 放在 nav.ts 而不是 config.ts — 这不是用户偏好，是 chrome 侧栏/工具栏的全局隐

私. 进入沉浸模式时隐藏侧栏+工具栏，退出时恢复。它控制 nav 层 chrome，不是 per-tab state（split 模式下主区可能 focus 编辑、副区沉浸），也不是持久化偏好（上次用沉浸下次打开不一定沉浸）

Actions: openPanel, closePanel, togglePanel, setNavView, setSearchQuery, clearSearch, selectNext, selectPrevious, setSelectedIndex, setContextSeed, setDirFiles, toggleLeftSidebar, toggleRightSidebar, setReadingMode

---

### config.ts — "用户偏好 + 持久化"

| 字段 | 理由 |
|------|------|
| fontSize | 字号偏好（持久化） |
| headingColors | 标题配色（主题偏好） |
| config (Partial<AppConfig>) | 通用配置 JSON |
| configLoaded / configLoading | 配置加载标记 |

Actions: loadConfig, saveConfig, updateConfig, resetConfig, setConfigLoaded, setConfigLoading, setFontSize, setHeadingColors

---

## 三、保留独立 Store 的条件

如果 future feature 满足以下任一条件，允许新建独立 store：

1. **隔离生命周期** — feature 有独立 mount/unmount（如全屏 overlay、独立窗口）
2. **多实例共存** — 同一 type 的 store 需要多个不同 instance（如多窗口各有自己的 tabStore）
3. **不频繁读写** — 写操作不应触发主 store rerender（如高频 cursor position 更新）

当前 P1/P2 功能不满足以上任何条件，继续使用 slices 模式。

---

## 四、新增字段：导航面板需要但当前不存在的

| 字段 | Slice | 类型 | 说明 |
|------|-------|------|------|
| dirFiles | nav.ts | `{path, name, mtime, isDir}[]` | 当前目录文件列表（Tauri read_dir） |
| contextSeed | nav.ts | string | 正文选中文本（来自 Portal 触发） |

// ponytail: dirFiles 用时不持久化到磁盘——每次打开 panel 时按需 read_dir，减少状态同步 complexity

---

## 五、实施

### R 阶段 store 合并计划（不阻塞开发）

1. 新建 `src/store/index.ts`：createAppStore，组合 tabs + nav + config slices
2. 迁移 `src/stores/index.ts` 和 `src/stores/editorStore.ts` 到新结构
3. 逐步替换 component import（hooks 不变，内部改用新 store）

### 导航面板数据流

```
Cmd+P → nav.openPanel()
  ├─ 空查询 + 无种子 → nav.setNavView('context')
  │   ├─ tabs.recentFiles.slice(0,5) → "继续"分组
  │   ├─ invoke('list_files', {dir:隐式目录}) → nav.dirFiles → "全部"分组
  │   └─ tabs.tabs.filter(dirty || half-read) → "待处理"分组
  └─ 有种子 → nav.setNavView('inline')
      └─ invoke('search_files', {query: seed}) → nav.dirFiles
```

### 已删除/合并的原 store 字段

原 `editorStore.translation` 直接移入 tabs.ts。原 `useStore` 按上述映射拆分。

---

## 六、Codex 反对意见记录（保留供日后参考）

| Round | Codex 立场 | Ponytail 反驳 | 最终 |
|-------|-----------|-------------|------|
| 1 | Cut dir traversal, cut Rust fs layer | 用 Tauri 内置 read_dir 一条命令 = 已安装依赖，不是新 layer | 保留：Tauri stdlib |
| 1 | Recent files 前端持久化 | + "全部"分组 = recentFiles + dirFiles dirFiles 按需加载 | 保留双数据源 |
| 2 | 4 slices (app/tabs/nav/recent) | 压到 3（tabs/nav/config） | 3 slices |
| 3 | Explicit folder model + open folder 按钮 | 隐式目录 = 最近访问父目录，无需用户选择 folder | 隐式 + nav.ts |
| 4 | sidebarLeftVisible 在 nav.ts | 合理，侧栏可见性是 panel chrome 范畴 | 保留 nav.ts |
| 5 | translation 在 tabs.ts, readingMode 在 config.ts | translation 跨 tab 共用合理；readingMode 是 chrome 状态不是偏好 | readingMode → nav.ts |

---

// ponytail: 这份文档是 5 轮对抗后的最终收敛。Field mapping 必须严格执行，不要通过 "action 访问另一个 slice's state" 偷换边界.
