---
title: "源码管理策略参考"
type: delivery
status: archived
last_updated: 2026-08-01
source_of_truth: historical
superseded_by:
  - ../../../GOVERNANCE.md
  - ../../../AGENTS.md
---

# 源码管理策略参考

> 2026-07-04 | 印哥 workspace

## 一、核心问题

库不想公开（功能未就绪 / 部分私有），但未来可能部分开放。怎么管理源码？

当前状况：`lqtdys/clairis` 已设 PRIVATE。公开时需要从"完全封闭"过渡到"部分公开"。

---

## 二、方案对比

| 方案 | 公开粒度 | 维护成本 | 防泄露 | 适合场景 |
|---|---|---|---|---|
| A. Monorepo + Submodule | 目录级 | 中 | 强（物理隔离） | 编辑器开源 + 翻译/插件闭源 |
| B. 分支隔离 | 整个 repo | 低 | 弱（cherry-pick 易漏） | 简单 demo，短期演示 |
| C. 独立仓库 + 包引用 | 模块级 | 高 | 最强 | 商业化产品，需要 rpm/npm 发布 |

---

## 三、推荐：方案 A（Monorepo + Submodule）

### 目录结构

```
folium-public/          (公开仓库, 含开源壳层)
├── src/
│   ├── editor/         # 编辑器核心（MIT）
│   ├── ui/             # React UI（MIT）
│   └── commands/       # 基础文件命令
├── tauri.conf.json
└── private/            (git submodule, 指向私有 repo)
    ├── translate/      # 翻译引擎（闭源）
    └── pro/            # 付费功能
```

### 工作流

```bash
# 1. 初始化
git clone github.com/lqtdys/folium-public.git
cd folium-public
git submodule update --init --recursive   # 只有你（有权限）能拉

# 2. 他人 clone 后 private/ 是空的 → 塞 stub 让他能编译开源部分
#    编译时检测 submodule 是否为空，空则跳过私有模块

# 3. 发布新公开版本（只推 public 分支）
git push origin main
```

### 优点
- 公开仓库物理不含私有代码（submodule 外人 404）
- 你的本地完整仓库不用分开维护
- 私有部分独立私有 repo，只你/核心成员有权限

---

## 四、防泄露要点（参考 Anthropic 案例）

### Anthropic 2025 泄露事件简述
- 内部 GitLab commit hash + 目录结构 → 通过 CDN 携带的内部配置文件 → 外部重建
- 根因：CI/CD 管道把不该带出的东西带出了（编译产物夹带内部路径/env）

### 对你的启示

1. **编译产物要 sanitize**
   - build 后产物目录中不应出现 `/Users/mason/`、内网 IP、API endpoint
   - CI 加入 grep 检查，匹配内部路径就 fail

2. **内部功能物理隔离**
   - 私有模块走 submodule，不要和公开代码混在同一个目录树
   - 即使误操作 push，submodule 的 `.gitmodules` 可以指向私有仓库（外部无权访问）

3. **git history 也算已发布**
   - 一旦 push 到 public remote，就算立刻删 commit，也可能被镜像捞到
   - **正确做法**：未来要公开时，新建干净公开 repo，只 cherry-pick 想公开的 commit
   - 不允许把现有 repo 直接 flip 成 public

4. **token/secret 不进代码库**
   - pre-commit hook 扫描硬编码 key
   - `.env` 永不 commit，用 `.env.example` 代替

---

## 五、操作清单（后续执行参考）

```markdown
### 短期（现在 → 公开发布前）
- [ ] jianming 保持 PRIVATE
- [ ] 静态分析清理内部路径/env（cargo build / tauri build 后检查产物）
- [ ] pre-commit 加入 secret 扫描
- [ ] 归档前 strip 历史中含私钥/commit 的记录

### 中期（公开发布前 1 周）
- [ ] 新建 folium-public（空壳）
- [ ] 将 editor/UI 核心代码 cherry-pick 到新 repo
- [ ] 私有功能拆成 submodule，指向私有 repo
- [ ] CI 跑编译 + 编译产物 sanitize grep 检查
- [ ] 公开首版只含"可公开"功能分支

### 长期（产品化后）
- [ ] 公开部分发版本标签 / cargo publish（如果需要）
- [ ] 私有部分独立 repo，CI 走私有 runner
- [ ] 每次公开发布走 PR review，检查是否夹带私有代码
```

---

## 六、最终决策框架

需要回答的问题（印哥决定后再填）：

| 问题 | 答案 |
|---|---|
| 哪些功能打算公开？ | （待填：如 editor 核心、UI、文件浏览） |
| 哪些功能必须闭源？ | （待填：翻译引擎、AI 模块、付费解锁） |
| 是否接受 submodule 的使用门槛？ | （是/否，submodule 对 contributors 有学习成本） |
| 时间线预期：公开始于？ | （Q4 2026？2027？） |

---

*Contact: 印哥 | 后续有更新再修订此文档*
