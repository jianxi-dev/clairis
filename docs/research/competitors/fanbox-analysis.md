---
title: "FanBox 技术解析 & Biaoyue 媒体支持参考"
type: research
source_of_truth: historical
status: draft
last_updated: 2026-08-01
---

# FanBox 技术解析 & Biaoyue 媒体支持参考

> 源: /Users/mason/Downloads/fanbox-2.6.1，2.6.1 版本
> 日期: 2026-07-09

---

## 1. FanBox 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 后端 | **纯 Node.js 内置模块** | http/fs/path/os/crypto/child_process，零 npm 依赖 |
| 前端 | **原生 JS** (~4900行) | 无框架，无 build，无 webpack/vite |
| 终端 | **xterm.js + node-pty** | WebGL 渲染，真终端，跑 Claude Code/vim 不花屏 |
| 代码编辑 | **Monaco** | VS Code 内核 |
| MD 编辑 | **Milkdown Crepe** | Notion 式 WYSIWYG |
| 语法高亮 | **highlight.js** | |
| MD 渲染 | **marked** | |
| 桌面壳 | **Electron** | node-pty / 文件系统能力靠它 |
| 数据存储 | **JSON 文件** | ~/.fanbox/config.json，原子写 (temp+fsync+rename) |
| 搜索 | **mdfind(Spotlight) + 自研 grep 兜底** | 系统索引毫秒返回，未索引目录 grep fallback |
| 文件监听 | **FSEvents** | agent 改文件 → 卡片发光涟漪 |

架构核心：**本地、零配置、零运行时依赖、只绑 127.0.0.1**。

---

## 2. 核心实现亮点

### 2.1 原子写文件
```js
// temp + fsync + rename，写一半崩溃不损坏原文件
const tmp = `${file}.fanbox-tmp-${pid}-${Date.now()}`;
const fh = await fsp.open(tmp, 'w');
await fh.writeFile(content, 'utf8');
await fh.sync();
await fsp.rename(tmp, file);
```
→ Biaoyue 做笔记/知识库存储时直接抄。

### 2.2 双层搜索 (mdfind + grep)
- mdfind(Spotlight): 属性查询 `kMDItemTextContent == "*关键词*"cd`，毫秒级返回
- grep fallback: 遍历+按mtime排序+行级命中预览，限时 3.5s
- Biaoyue 知识库检索可免费用，比手搓 SQLite FTS 省事

### 2.3 模糊打分算法
- 子序列匹配 + 连续命中加分 + 词首加分 + 靠前加分 + 近期修改加权
- 20行纯函数，效果 > 多数 fuzzy lib

### 2.4 并发覆盖保护
- 编辑前记 mtime，写前校验，被外部改过拒绝盲覆盖
- 多端同步/协作场景必备

### 2.5 强色实体文件图标
- 每种扩展名烧死一个品牌色 + 字母徽章（JS 黄 / PY 蓝 / PDF 红）
- 三套皮肤(iconColorFor)下配色自适应

### 2.6 三套皮肤整体切换
- 不是换主题色，是配色 + 字体 + 图标 + 代码高亮 + 终端 ANSI 一起变

### 2.7 未保存守卫
- 编辑器 dirty 时拦截所有离开路径（点别的文件 / 跳目录 / Esc 旁路）
- 三种编辑器统一 guard 接口

### 2.8 会话录像回放
- 终端输出录成时间轴，拖拽回放
- 可压到 30s 导出 MP4 / GIF（ffmpeg 转码）

### 2.9 项目记忆
- 解析 Claude Code(.jsonl) / Codex(rollout-*.jsonl) 会话日志
- 提取"AI 在这干过什么"，支持一键 `--resume` 续上

### 2.10 零依赖后端
- server.js 一个文件搞定所有 API
- 无 express/fastify，无 ORM
- 部署 = `node server.js`

---

## 3. Biaoyue 媒体预览方案

### 3.1 实现代码
```js
function renderPreview(file) {
  if (file.kind === 'image')
    return `<img src="${file.path}" class="prev-img" onclick="this.classList.toggle('zoomed')">`;
  if (file.kind === 'pdf')
    return `<embed src="${file.path}" type="application/pdf" width="100%" height="100%">`;
  if (file.kind === 'video')
    return `<video src="${file.path}" controls preload="metadata" class="prev-video"></video>`;
  // ... text/html/md
}
```

```css
.prev-img { max-width: 100%; max-height: 80vh; object-fit: contain; cursor: zoom-in; transition: .2s; }
.prev-img.zoomed { max-width: none; max-height: none; cursor: zoom-out; }
.prev-video { max-width: 100%; max-height: 80vh; }
```

### 3.2 各媒体类型
| 类型 | 方案 | 依赖 | 说明 |
|---|---|---|---|
| 图片 | `<img>` | 零 | native，点击放大/还原 |
| PDF | `<embed>` | 零 | 浏览器自带翻页/缩放/搜索 |
| 视频 | `<video controls>` | 零 | 浏览器自带播放器/进度条/字幕 |

### 3.3 跳过项
- 自定义播放器 / PDF 解析器 / 图片编辑器
- pdf.js / 缩略图库 / 波形图 / 逐帧
- add when: 用户要求标注 / 切页 / 逐帧 / 波形图 / 导出图片

---

## 4. 可借鉴优先级 (for Biaoyue)

| 优先级 | 功能 | 成本 |
|---|---|---|
| **P0** | 可信度标注 (`[已验证]`/`[标准依据]`/`[行业惯例]`/`[推断补充]`) | CSS + 字段 |
| **P0** | 原子写 | 一行模板 |
| **P0** | 未保存守卫 | 10行公共接口 |
| **P1** | 场景化触发词速查卡 | 静态 HTML |
| **P1** | 信息密度分层结构 | readme 照搬 |
| **P2** | 三套皮肤 | 全局 CSS 变量 |
| **P2** | mdfind + grep 双层搜索 | 50行 |
| **P3** | 会话录像 | 需要 Electron |
| **P3** | 项目记忆 | 解析 jsonl，看是否有需求 |

---

## 5. 安全管理智能顾问 HTML 参考

- 路径: `/Users/mason/Desktop/AI工具分享/安全管理智能顾问/readme-安全管理领域智能顾问Skill.html`
- 单文件 476 行，Tailwind CDN + Google Fonts + 内联 SVG
- 信息密度结构: Hero → 是什么 → 里面有什么 → 能做什么 → 怎么用 → 可信度 → 注意事项 → 未来
- 结尾附"精简版"section（一页速查）+ 触发词速查卡
- Biaoyue 落地页/帮助页可参考此结构
