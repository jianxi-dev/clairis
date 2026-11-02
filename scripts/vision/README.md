# 读图工具（vision）

## 这是干什么的

**主 agent 和子 agent 都可能读不了图。** 这取决于当前会话用的模型支不支持图像输入：不支持时（`input` 只有 `text`，如 `deepseek-v4.1-flash`、`glm-5.3`），内置 `read` 工具打开 PNG/JPG 会报：

```
Current model does not support images
```

子 agent 尤其明显：它继承了同样的模型限制，且看不到主会话里已经绕过的办法。这个目录就是那个办法。

**看到这句话，不要放弃，也不要让用户口述截图内容——直接用下面的脚本。**

**为什么脚本能绕开模型限制**：`vision.py` 自己发 HTTP 到 DeepSeek（`model=deepseek-flash`，该模型本身支持图像输入），**完全不经过当前会话的 provider**。它只要求 agent 能跑 `bash`。所以这与 agent 配了什么模型无关——`deepseek-v4.1-flash` 用脚本照样能读图。

> `deepseek-flash` 与 `deepseek-v4.1-flash` 是同一个模型，两个名字指向同一端点。

**什么时候直接 `read`**：当前模型 `input` 含 `image`（如 `glm-5.3-flash`、`longcat-2.5-preview`）时，`read` 直读即可，脚本是多余的。判断不了就无脑用脚本，代价只是多一次 HTTP 调用。

> 同源副本在 `contentweave/scripts/`（那边叫 `analyze_image.py` / `batch_vision.py`，因为 `scripts/` 同目录已有同名文件）。**改动需同步两处。**

## 三个脚本，分工不同

| 脚本 | 回答什么问题 | 成本 |
| --- | --- | --- |
| `analyze.py` | 颜色到底是多少、各占多少、亮/暗、留白、纹理密度 | 免费，毫秒级，**不会错** |
| `vision.py` | 这一屏长什么样、布局是哪种、视觉母题是什么 | 一次 API 调用 |
| `batch.py` | 一批截图逐张过一遍，六字段结构化 | 每张一次 API 调用 |

**默认先跑 `analyze.py`。** 能从像素算出来的量，不要让模型去猜。

## 用法

```bash
# 1. 硬数据（免费，先跑这个）
python3 scripts/vision/analyze.py path/to/shot.png
# → {palette, dark_pct, light_pct, bands, accent_hues, texture}

# 2. 语义判断（需要时再跑）
python3 scripts/vision/vision.py path/to/shot.png -p "布局形态？视觉母题？只描述真实看到的"

# 3. 批量
python3 scripts/vision/batch.py path/to/shots/ out.jsonl
```

`vision.py` 支持一次传多张图：`vision.py a.png b.png -p "对比这两屏的差异"`。

## 关键约束：先算后猜

`vision.py` **会编造具体细节**。已实测过：给它一张软件截图，它会说「顶部菜单栏包含打开、保存、新建」，而这些按钮文字它并没有能力确认。

所以：

- `analyze.py` 的输出 → **可以直接当结论**
- `vision.py` 的输出 → **只能当线索**；凡是具体数字、精确色值、按钮文字，一律回头用 `analyze.py` 或读源码核实

更好的用法是把已确认的事实喂进 prompt：

```bash
# 先拿到主色，再让模型判断风格——把事实当前提，编造空间就小一半
python3 scripts/vision/analyze.py shot.png        # 主色 #f0f0f0 占 96.9%
python3 scripts/vision/vision.py shot.png -p "主色 #f0f0f0 占 96.9%，亮区 98.2%。这是什么风格？"
```

### 实测陷阱：`batch.py` 的 SCHEME 字段不可信

同一张图（红底 + 白斜条纹，`dark_pct=0.0`）跑了两次 `batch.py`，`SCHEME` 一次给 `light`、一次给 `dark`；`ACCENT` 给 `#c8102e` / `#c0161c`，两个都不是真实值 `#c01818`。同时 `vision.py` 把这张 64×64 测试图认成了「达契亚/Dacia 汽车品牌标志」。

**结论**：

- **判明暗用 `analyze.py` 的 `dark_pct` / `light_pct`，不要用 `batch.py` 的 `SCHEME`**——前者是像素算的，后者是模型猜的
- **精确色值一律回 `analyze.py` 的 `palette`**，`ACCENT` 字段只是定位提示
- 模型对「这是什么」的品牌归属、按钮文字、UI 控件几乎必错；只用它的语义判断（布局形态、视觉母题）

## 依赖

- Python 3 标准库，**无第三方依赖**
- `~/.pi/agent/auth.json` 里的 `deepseek` key（用环境变量 `VISION_AUTH` 可指向别的 auth 文件）
- `batch.py` 缩大图用 macOS 自带 `sips`（可选，失败则读原图）；缩图缓存目录可用 `VISION_OPT_DIR` 覆盖，默认 `/tmp/shots/opt`

## 为什么不做成 MCP / 工具

因为子 agent 的工具集是固定的（`read` / `bash` / `grep` / `edit`），加不了新工具。脚本 + `bash` 是唯一对所有 agent 都成立的通道——这也是它必须放在仓库里、而不是 `/tmp` 的原因。

配套：两个仓库的 `AGENTS.md` 都写了「读图」一节，子 agent 启动即读到，不依赖临时约定。
