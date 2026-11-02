# brand-narrative 规格

## Purpose

品牌叙事与对外文案口径——slogan 层级、典故使用边界（借象不借教）、名称语义（标月=动作）、文案禁用清单、各渠道（首屏/应用商店/about 页）的文案分层规则。来源：2026-11-02 跨模型碰撞定案（Claude 提案 × Codex 对抗评审），change `add-brand-slogan`。

## Requirements

### Requirement: BN-1 主 slogan 与文案层级

产品对外文案 SHALL 遵循统一层级：主 slogan 为「标月：你只管月亮，工具交给 AI。」；上墙短句为「指向月亮，然后退后。」；传播钩子为「月亮不在设置里。」；首屏副标为「一款被你拥有、可被 AI 塑形的读写应用。布局、键位、导航，一句话改；改坏了，一句话退回。」。首屏（官网/README/应用商店第一屏）SHALL 带品类词「读写应用」，SHALL NOT 让「标月」单独出现而无品类信号。

#### Scenario: 首屏文案合规

- **WHEN** 检查官网 hero、README 开头或应用商店首屏文案
- **THEN** 文案 SHALL 出现品类词（读写应用/读写工具），且 slogan 或副标 SHALL 符合本规格定义的层级文案

#### Scenario: slogan 层级一致

- **WHEN** 任何对外物料引用主 slogan、上墙短句、传播钩子或首屏副标
- **THEN** 引用文本 SHALL 与本规格定义的定案文案逐字一致（标点含全角句号）

### Requirement: BN-2 典故使用边界（借象不借教）

品牌叙事 SHALL 采用「借象不借教」口径：允许使用"手指指月、看月不看指"的意象，SHALL NOT 声称文案表述为佛经经义，SHALL NOT 在对外文案中对《圆觉经》《楞严经》做逐句解经式映射。典故内容仅 SHALL 出现在第二层（about 页、README 尾部、启动页签名），SHALL NOT 出现在应用商店副标等转化型首屏文案中。

#### Scenario: 典故位置

- **WHEN** 检查应用商店副标或首屏转化型文案
- **THEN** SHALL NOT 出现经文引文或解经式表述；典故表述仅允许出现在 about 页、README 尾部等第二层位置

#### Scenario: 借象声明

- **WHEN** 对外文案使用指月典故
- **THEN** SHALL 以"借象不借教"为口径表述（如「手指指月，看的是月」），SHALL NOT 出现"经义如此""佛说软件"式断言

#### Scenario: 名称语义

- **WHEN** 对外文案解释「标月」名称的含义
- **THEN** SHALL 将「标月」表述为动宾动作（指向月亮的那一下），SHALL NOT 将产品等同为一根手指（工具）

### Requirement: BN-3 文案禁用清单

对外文案 SHALL NOT 使用以下碰撞定案中淘汰的表达：「软件是指，内容是月」（语法歧义）、「最诚实的指」（硬凑解经）、「AI 掰正手指」（暗示工具本歪）、「会消失的读写工具」（数据丢失联想）、「观指为月（亡失月轮）」等论文式注脚进入用户文案。产品内部术语（omakase、malleability、agentic）SHALL NOT 直接出现在面向普通用户的文案中，SHALL 翻译为「精选默认/开箱即用」「可塑」「AI 改得动、退得回」式人话。

#### Scenario: 禁用表达审查

- **WHEN** 新对外文案提交（官网、README、商店文案）
- **THEN** 文案 SHALL NOT 包含本规格列出的禁用表达，SHALL NOT 出现 omakase/malleability/agentic 等内部术语直出

### Requirement: BN-4 故事定调（退后而非更好）

品牌故事 SHALL 以「指向完成，即退场」为定调（标月=指向月亮的动作，动作完成即结束），SHALL NOT 以「做一根更好的手指/更好的工具」为叙事主轴（该表述与"看月不看指"自相矛盾，且把标月误定义为手指）。第二层标准表述 SHALL 为：「手指指月，看的是月。标月不是一根更漂亮的手指，而是指向月亮的那一下——你看见了月亮，它就退开。」AI 塑形能力 SHALL 表述为「把工具调成你顺手的样子，改坏了一键退回」，SHALL NOT 使用「掰正」等动词。

#### Scenario: 叙事主轴检查

- **WHEN** 撰写或评审品牌故事类文案（官网三段式、发布会稿、README 叙事）
- **THEN** 文案主轴 SHALL 是"工具退后、月亮在前"，SHALL NOT 以"更好的工具"为核心卖点表述
