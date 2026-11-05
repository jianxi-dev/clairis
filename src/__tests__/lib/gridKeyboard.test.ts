import { describe, expect, it } from "vitest";
import {
  digitFromCode,
  moveHorizontal,
  moveVertical,
  pageStep,
  sequenceOfVisible,
  type GridBox,
  type GridViewport,
} from "../../lib/gridKeyboard";

/**
 * 网格键盘导航纯逻辑（layout-portal 11.1）。
 *
 * 几何用视口坐标系（y 向下为正）。夹具模拟 4 列网格：
 * - a = 大卡 2×2（跨第 1–2 行）
 * - b = 中卡 2×1（第 1 行右半）
 * - c/d = 小卡 1×1（第 2 行右半）
 * - e = 第 3 行唯一小卡
 */

function box(
  path: string,
  top: number,
  bottom: number,
  left: number,
  right: number,
): GridBox {
  return { path, top, bottom, left, right };
}

const SPANNED: GridBox[] = [
  box("a", 0, 200, 0, 200),
  box("b", 0, 100, 200, 400),
  box("c", 100, 200, 200, 300),
  box("d", 100, 200, 300, 400),
  box("e", 200, 300, 0, 100),
];

const VIEWPORT: GridViewport = { top: 0, bottom: 250, left: 0, right: 400 };

describe("gridKeyboard —— sequenceOfVisible", () => {
  it("只保留与视口相交的卡，按视觉阅读顺序（先上后左）排序", () => {
    expect(sequenceOfVisible(SPANNED, VIEWPORT, 9)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("边贴边不算相交（bottom 恰等于 viewport.top 的卡不可见）", () => {
    const boxes = [
      box("above", -100, 0, 0, 100),
      box("visible", 0, 100, 0, 100),
    ];
    expect(sequenceOfVisible(boxes, VIEWPORT, 9)).toEqual(["visible"]);
  });

  it("limit 截断到前 N 张", () => {
    expect(sequenceOfVisible(SPANNED, VIEWPORT, 2)).toEqual(["a", "b"]);
    expect(sequenceOfVisible(SPANNED, VIEWPORT, 0)).toEqual([]);
  });

  it("跨行大卡按自身 top 参与排序（不被拆成两行）", () => {
    // a 跨第 1–2 行，top=0；f 在第 3 行，top=200 → a 仍排在 f 前
    const boxes = [box("f", 200, 300, 0, 100), ...SPANNED];
    expect(sequenceOfVisible(boxes, VIEWPORT, 9)[0]).toBe("a");
  });
});

describe("gridKeyboard —— moveVertical", () => {
  it("大卡下移：跳到下一视觉行，行内取 x 中心最近者", () => {
    // a 的底是第 2 行底；下一行只有 e
    expect(moveVertical(SPANNED, "a", 1)).toBe("e");
  });

  it("行内上移：回到最近行，跨行大卡优先于同排右侧小卡", () => {
    // e 在第 3 行；上一行有 a/c/d，e 的 x 中心 50 最近的是 a（中心 100）
    expect(moveVertical(SPANNED, "e", -1)).toBe("a");
  });

  it("跨行大卡不被误判成同一行的邻居", () => {
    // c 在第 2 行；a 跨第 1–2 行（bottom=200），不是「上一行」
    // 上一行只有 b（bottom=100），故 k → b
    expect(moveVertical(SPANNED, "c", -1)).toBe("b");
  });

  it("没有下一个视觉行时退回数组顺序 ±1", () => {
    expect(moveVertical(SPANNED, "e", 1)).toBeNull();
    expect(moveVertical(SPANNED, "a", -1)).toBeNull();
  });

  it("当前路径不在列表中返回 null", () => {
    expect(moveVertical(SPANNED, "missing", 1)).toBeNull();
  });

  it("无行邻居时退回数组顺序 ±1", () => {
    const boxes = [box("a", 0, 100, 0, 100), box("b", 0, 100, 100, 200)];
    expect(moveVertical(boxes, "a", 1)).toBe("b");
    expect(moveVertical(boxes, "b", -1)).toBe("a");
  });
});

describe("gridKeyboard —— moveHorizontal", () => {
  it("行内右移：同一行取最近边", () => {
    expect(moveHorizontal(SPANNED, "a", 1)).toBe("b");
    expect(moveHorizontal(SPANNED, "c", 1)).toBe("d");
  });

  it("行内左移：同一行取最近边", () => {
    expect(moveHorizontal(SPANNED, "b", -1)).toBe("a");
    expect(moveHorizontal(SPANNED, "d", -1)).toBe("c");
  });

  it("跨行大卡可被横向选中（垂直重叠 100%）", () => {
    // c 与 a 垂直重叠 100/100 = 100%，a 在 c 左侧 → h → a
    expect(moveHorizontal(SPANNED, "c", -1)).toBe("a");
  });

  it("不同行没有同行邻居时返回 null（不跨行）", () => {
    // i 在第 1 行，j 在第 3 行，二者垂直重叠 0，不构成同一行
    const boxes = [box("i", 0, 100, 0, 100), box("j", 200, 300, 0, 100)];
    expect(moveHorizontal(boxes, "i", 1)).toBeNull();
    expect(moveHorizontal(boxes, "j", -1)).toBeNull();
  });

  it("行边缘不跨行：b 右移、e 右移都原地不动", () => {
    expect(moveHorizontal(SPANNED, "b", 1)).toBeNull();
    expect(moveHorizontal(SPANNED, "e", 1)).toBeNull();
  });

  it("当前路径不在列表中返回 null", () => {
    expect(moveHorizontal(SPANNED, "missing", 1)).toBeNull();
  });
});

describe("gridKeyboard —— pageStep", () => {
  it("容器高 − 24px", () => {
    expect(pageStep(800)).toBe(776);
    expect(pageStep(24)).toBe(0);
  });

  it("高度不足 24px 时钳到 0，不产生负步长", () => {
    expect(pageStep(10)).toBe(0);
    expect(pageStep(0)).toBe(0);
  });
});

describe("gridKeyboard —— digitFromCode", () => {
  it("Digit1–9 与 Numpad1–9 解析为 1–9", () => {
    for (let n = 1; n <= 9; n += 1) {
      expect(digitFromCode(`Digit${n}`)).toBe(n);
      expect(digitFromCode(`Numpad${n}`)).toBe(n);
    }
  });

  it("Digit0 / Numpad0 / 字母键 / 空串都返回 null", () => {
    expect(digitFromCode("Digit0")).toBeNull();
    expect(digitFromCode("Numpad0")).toBeNull();
    expect(digitFromCode("KeyA")).toBeNull();
    expect(digitFromCode("")).toBeNull();
  });
});
