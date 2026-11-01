---
title: 桌面应用后台进程烧 CPU 事故复盘与 Biaoyue 避坑清单
type: guide
status: accepted
last_updated: 2026-09-02
source_of_truth: supporting
---

# 桌面应用后台进程烧 CPU 事故复盘与 Biaoyue 避坑清单

> 一句话结论：**Electron 多渲染进程 + 隔离副本运行 + 渲染进程死循环 = 前台无窗口、后台烧 CPU、机身发烫、用户却"看不到任何程序在跑"。** Biaoyue 的 Tauri 架构天然免疫了孤儿渲染进程，但 HTML 预览 iframe 允许脚本执行是同类风险，需在开发与分发时主动设防。

---

## 一、事故记录（2026-09-02，本机）

### 1.1 现象

- 机身明显发烫，但**前台看不到任何程序在运行**（用户原话："前台看没有什么程序在预算，但电脑比较发烫"）。
- 实测数据（12 核 Apple M3 Pro，18G 内存）：
  - `load average: 15.96 15.67 15.33` —— 12 核机器持续超载，发热的直接来源。
  - `Sunote Helper (Renderer)` **两个进程各占 ~450% CPU，合计 ~890% CPU**（≈7.4 个核心跑满）。
  - `WindowServer` 42%（被异常窗口刷新拖累的次生现象）。
  - 残留孤儿进程 `block-editor-backend`（PPID=1，父进程已死）。

### 1.2 处理过程

| 步骤 | 动作 | 结果 |
|---|---|---|
| 1 | `kill 53221 53224`（两个渲染进程） | 进程消失 |
| 2 | `kill 6960`（孤儿 backend，PPID=1） | 已退出 |
| 3 | `rm -rf .../AppTranslocation/AF0B01B2-...`（隔离副本） | 已删除 |
| 4 | 等待负载回落 | 15.96 → 6.97（1 分钟均值） |

---

## 二、根因分析（为什么会这样）

### 2.1 直接原因：渲染进程孤儿化 + 死循环

- **孤儿化**：Sunote 主程序退出后，两个 Renderer Helper 进程没有被正确终止，变成无主进程继续存活（backend 进程 PPID=1 是同一问题的另一表现）。
- **死循环**：渲染进程 CPU 持续 400%+，说明 WebView 内存在 JS 死循环或渲染/合成循环，且没有任何机制发现并终止它。

### 2.2 放大因素：AppTranslocation 隔离副本

- Sunote 是从 **dmg/下载目录直接双击运行**，而非从 `/Applications` 启动。
- macOS 因此生成隔离副本：`/private/var/folders/f9/.../AppTranslocation/<UUID>/d/Sunote.app`，**真正运行的是这份副本**。
- 后果：
  - 排障时看到的是 `/Applications` 的安装版，与实际运行版本不一致，极易误判。
  - 更新后旧副本仍存活，新旧两份并存，行为不可预期。
  - 隔离副本位置藏在系统临时目录，用户和排查工具都很难发现。

### 2.3 本质

桌面应用（尤其 Electron 类）的**后台进程生命周期没有兜底**：退出路径不清理子进程、渲染进程异常无看门狗、分发路径放任隔离副本。三者叠加，就是"前台干净、后台烧机"。

---

## 三、对照 Biaoyue：哪些天然免疫，哪些是风险

### 3.1 架构天然免疫（Tauri 2 的优势）

| Sunote 的问题 | Biaoyue 的对应情况 | 判定 |
|---|---|---|
| Electron 多渲染进程，退出后 Renderer Helper 孤儿化 | Tauri 的 webview 是**系统 WebKit 进程**（`com.apple.WebKit.WebContent`），随应用退出由系统回收 | ✅ 无孤儿渲染进程 |
| 从 dmg 直接打开 → AppTranslocation 隔离副本 | Tauri 应用资源在 bundle 内，影响比 Electron 小 | ✅ 影响较小（仍有分发注意点，见 4.2） |
| 后台/前端计时器泄漏 | 已核查全部 `setInterval`/`setTimeout`/`requestAnimationFrame`：`ReadingProgressInk`、`FramePreview`、`VideoPlayer` 均有 cleanup | ✅ 无计时器泄漏 |

### 3.2 真风险点（对照代码）

**风险 ①：HTML 预览 iframe 允许脚本执行（最接近 Sunote 的场景）**

`src/components/Content/HtmlPreview.tsx`，asset 直载路径：

```tsx
<iframe
  src={assetSrc}
  sandbox="allow-scripts allow-same-origin allow-popups"
  ...
/>
```

- 用户用 Biaoyue 打开一个**内含死循环 JS 的本地 HTML 文档**时，WebKit WebContent 进程会持续烧 CPU——与 Sunote 渲染进程 450% 同款问题。
- srcdoc 回退路径有 `script-src 'none'`，但 **asset 直载路径没有任何 CSP 限制**。
- 且 `allow-scripts + allow-same-origin` 同时出现是**安全反模式**：等于沙箱失效，iframe 内脚本理论上可访问父文档上下文。
- 不能简单禁脚本：此前"文档正文不显示"的 bug 正是禁脚本导致，脚本执行是功能需求。

**风险 ②：AppTranslocation（分发路径）**

用户从 dmg 直接双击运行 → 生成隔离副本 → 旧副本+新副本并存，更新后仍跑老代码，排查困难。

**风险 ③：`FramePreview` 200ms 常驻轮询（小隐患）**

`src/components/Content/PreviewView.tsx` 的 `setInterval` 每 200ms 抢 iframe 键盘焦点（跨源 iframe 无法收到 focusin/pointerdown 的替代方案）。有 cleanup，但组件挂载期间常驻，多标签页会累积，量级小、非发热主因。

---

## 四、避坑清单（按优先级）

### 4.1 iframe CPU 看门狗（建议实现，对应风险 ①）

- asset 直载改为「fetch 内容 → 重写路径 → srcdoc 注入 CSP + 看门狗脚本」：脚本仍可执行（保住"正文能显示"），但控制权回到 Biaoyue。
- 看门狗原理：iframe 内 `setInterval` 心跳 → 父窗口检测心跳丢失（主线程卡死）→ reload iframe 并提示"此文档脚本疑似死循环"。
- 始终避免 `allow-scripts + allow-same-origin` 同开；确需同开时必须有 CSP 与心跳兜底。

### 4.2 发布检查单（对应风险 ②）

- [ ] dmg 内提供"拖到 Applications"引导（tauri-bundler 默认具备，发布时确认启用）。
- [ ] README / 首次启动提示写明"请从 Applications 启动"。
- [ ] 发布前用隔离副本路径启动自测一次，确认功能正常（能发现资源相对路径问题）。

### 4.3 定时器纪律（对应风险 ③，可做可不做）

- `FramePreview` 焦点抢回考虑用 `focusin`/`blur` 事件替代轮询，或仅在 iframe 聚焦期间启用轮询。
- 新代码统一遵守：任何 `setInterval`/`rAF` 必须成对出现 cleanup。

---

## 五、附录：排查命令模板

```bash
# 1. 看负载（> 核心数 = 过载）
uptime

# 2. 按 CPU 排序找真凶（-r 即按 %CPU 降序）
ps -Ao %cpu,%mem,rss,pid,command -r | head -15

# 3. 按进程名聚合（确认某应用合计占用）
ps -Ao %cpu,%mem,command | grep -i <app> | grep -v grep | \
  awk '{c+=$1;m+=$3} END {printf "CPU %.1f%%  MEM %.0fMB\n", c, m/1024}'

# 4. 查孤儿进程（父进程已死 = PPID 1）
ps -o pid,ppid,%cpu,command -p <PID>

# 5. 找 AppTranslocation 隔离副本
find /private/var/folders -maxdepth 5 -name "*.app" -path "*AppTranslocation*" 2>/dev/null
```

---

## 六、与本文相关的现有代码位置

| 位置 | 说明 |
|---|---|
| `src/components/Content/HtmlPreview.tsx` | 风险 ①：iframe sandbox / CSP |
| `src/components/Content/PreviewView.tsx` | 风险 ③：200ms 常驻轮询 |
| `src-tauri/tauri.conf.json` | 打包配置（bundle.targets / fileAssociations） |
| `docs/delivery/` | 上架与分发相关文档 |
