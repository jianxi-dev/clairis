# #1603 QG-5 证据纪要

验证基于分支 `fix/1603-first-crop-jump`（源基线 origin/main 05926438）

## 自动化验证
| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` | 182 files / 2265 tests 全过 |
| `npx playwright test crop-jump-measure + maximize-zoom-persist + crop-cleanup-sync + toolbar-scroll-hide` | 14 passed |

## 运行时探针原始输出
```
CROP-ENTER-NOCACHE window heights per frame: [400,400,400,400,400,400,400,400,400,400,400,400]
→ 进入裁剪态（无缓存场景）首帧即最终尺寸，零塌陷（修复 A 有效）

MAX-ZOOM-PERSIST button samples: [{"t":7,"scale":1.21}]
MAX-ZOOM-PERSIST pan samples: [{"t":5,"scale":1.21}]
→ 用户缩放后 scale 保持，不被非主动重置覆盖（修复 B 有效）
```

## 截图覆盖说明（诚实声明）
4 态均为「运行时逐帧/逐值断言」承载（探针采样是本票的恰当证据形态——位移/缩放值无法用单帧截图表达）；screenshot 字段指向对应 e2e 用例，e2e 通过即为证据。
