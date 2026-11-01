---
title: 目标用户
type: product
status: accepted
last_updated: 2026-11-01
source_of_truth: canonical
---

# 目标用户

本文档提炼 Biaoyue 的目标用户构成与零门槛口径。产品定义见 [产品愿景](./vision.md)，产品铁律见 [Doctrine](./principles.md)。

## 一、目标用户与占比

| 类型 | 占比 |
|------|------|
| 学习者 | 40% |
| 写作者 | 30% |
| 成长者 | 20% |
| 灵感寻求者 | 10% |

> 来源：全量需求文档 §1.4「目标用户」（历史原稿已被取代，历史存根 `docs/CORE-REQUIREMENTS-clairis.md`；现行产品定义见 [产品方向](./README.md)）。

## 二、重点服务角色

当前重点服务角色是阅读者、写作者、寻求激发灵感创意者；根据不同角色需求提供不同的组件功能，后续围绕个人所需再扩展。

> 来源：[重新定义（历史原稿）](../渐晰-重新定义.md)。

## 三、零门槛口径

Biaoyue 对目标用户承诺**零门槛**：不装任何外部依赖即可用全部核心能力，**含 AI**。

- 内置 provider 预设（DeepSeek / 通义 / Kimi / GLM / 自定义等），用户配一个 API key 即可用 AI；key 只存 OS keyring。
- 本地 LLM 与多 agent 切换标「规划中」，不阻塞核心能力可用。
- 生成物（contentweave 学习页）离线单文件可看，断网可用。
- 不要求用户装 CLI agent、不要求改源码即可调整行为与外观（自然语言驱动）。

> 来源：产品铁律 D10；重定位规格包 §三/§四。

---

## 不承担的内容

- 逐功能的角色适配行为、组件清单：以 `openspec/specs/` 为准。
- 开发状态机与进度跟踪：不进入产品文档。

## 来源与旧入口说明

- 提炼自全量需求 §1.4，并按重定位规格包 §八 补零门槛口径；旧入口（`docs/CORE-REQUIREMENTS-clairis.md`）为历史存根（status=superseded，redirect→ `docs/product/README.md`）。仓库根目录同源副本已于方案 A（2026-08）删除。治理任务 12 已把活文档链接统一改指新位置，旧入口仅作历史追溯。
