---
title: Biaoyue 产品愿景
type: product
status: accepted
last_updated: 2026-11-01
source_of_truth: canonical
---

# 产品愿景（标月 / Biaoyue）

本文档定义 Biaoyue 稳定的产品方向：名字、一句话定位、三支柱与「不为谁做」。
产品铁律见 [Doctrine](./principles.md)，目标用户见 [目标用户](./users.md)，范围边界见 [范围边界](./scope.md)，阶段方向见 [交付路线图](../delivery/roadmap.md)。

## 一、产品名称

| 方案 | 名称 |
|------|------|
| 中文主名 | 标月 |
| 英文主名 | Biaoyue（标识符小写 `biaoyue`） |
| 国际简写 | BY |
| 域名 | biaoyue.app / biaoyue.dev / biaoyue.me |
| bundle ID | dev.biaoyue.app |

> 来源：定名决议（2026-10-31 维护者裁定）。旧名 Folio / MDWRT / Jianming（渐明）同源，老文档中出现时指同一项目。

## 二、一句话定位

> 一款被个人拥有、可被 AI 塑形的阅读与创作应用。普通用户不需要改源码，用自然语言就能调整它的行为、外观与导航。

## 三、三支柱

Biaoyue 的一切设计都落在三根支柱上，三者互为支撑：

| 支柱 | 含义 | 落地 |
|------|------|------|
| **omakase（精选默认）** | 每个能力带精选默认行为，首启即「已被组织好的工作现场」；不把选择推给用户 | 默认主题/字号/布局/密度；override 层藏高级选项 |
| **malleability（一切可变状态皆文本）** | 配置、键位、视图规格、扩展都是约定目录的文本文件；用户与 AI 都能改 | 配置三层 + 视图规格 + 扩展包（SKILL.md 式） |
| **agentic（AI 改得动、改坏能退回）** | AI 能改应用行为，但每次改动都有确认卡、快照与一键恢复 | 确认卡三档 + 撤销条 + 快照（最近 10 份） |

> 来源：重定位规格包 §一/§三；产品铁律见 [Doctrine](./principles.md) D5/D6/D7。

## 四、不为谁做（摘要）

Biaoyue 明确不为以下五类对象做，完整口径见 [Doctrine](./principles.md)「不为谁做」：

1. 不为愿意折腾的系统级玩家做整机级定制（那是 omarchy 的领地）。
2. 不为团队/多人协作做（本定位周期不承诺）。
3. 不为插件市场/公开扩展 API 做（扩展点 = 数据文件）。
4. 不为云端免费服务做（本地优先，API key 用户自持）。
5. 不为多语言市场调整产品节奏（中文体验优先做到极致）。

---

## 来源与旧入口说明

- 本文档由重定位规格包 v1.0 §一/§二/§三 重写，取代 2026-08-01 版旧定位（旧五原则与「陪伴式成长伙伴」口径已收编进 Doctrine）。
- 逐功能可验收行为以 `openspec/specs/` 为准；产品级范围边界见 [范围边界](./scope.md)。
- 旧入口（历史存根 `docs/CORE-REQUIREMENTS-clairis.md`，status=superseded，redirect→ `docs/product/README.md`）仅作历史追溯，不再作为活入口裁定依据。
