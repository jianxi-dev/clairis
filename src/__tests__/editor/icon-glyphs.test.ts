// 图标字形层断言（#1433）。
//
// 既有用例只断言 `data-icon` 名（代理属性），有序 / 无序图标名不同但字形几乎
// 同形（三条横线 + 三个相同小标记），用户分辨不出。本文件断言**字形本身**：
// 1. 有序列表字形 = `ui/icons` 的规范编号字形（SSOT 同源）；
// 2. 有序 / 无序路径集不相等；
// 3. 左缘标记列的「形状签名」：无序三枚圆点 → 1 种；有序编号 → ≥2 种。
//    这条断言在旧字形（三条横线 + 三个相同小方块）上失败。
import { describe, expect, it } from "vitest";
import { renderIcon } from "../../editors/icons";
import { ICONS } from "../../ui/icons";

/** 取图标第一个 path 的 `d`。 */
function firstPathD(name: string): string {
  const svg = renderIcon(name);
  const path = svg.querySelector("path");
  if (!path) throw new Error(`${name} 没有 path`);
  return path.getAttribute("d") ?? "";
}

/**
 * 把一条 `d` 拆成子路径（每个 `M` 前切开），返回各子路径起始 x 坐标。
 * 起始 x 取该子路径 `M` 后的第一个数字。
 */
function subpathStarts(d: string): Array<{ startX: number; body: string }> {
  const parts = d.split(/(?=M)/).filter((part) => part.trim() !== "");
  return parts.map((part) => {
    const m = /M\s*(-?\d+(?:\.\d+)?)/i.exec(part);
    return { startX: m ? Number(m[1]) : Number.POSITIVE_INFINITY, body: part };
  });
}

/**
 * 命令形状签名：去掉数字、空白、小数点、负号后剩下的命令字母序列，并转小写
 * 以统一绝对 / 相对指令（`V` 与 `v` 同形）。
 */
function shapeSignature(subpath: string): string {
  return subpath.replace(/[\d\s.-]/g, "").toLowerCase();
}

/**
 * 左缘标记列的形状签名集合。
 *
 * 标记列 = 起始 x < 5 的子路径。阈值取 5 而非任务描述的 8：旧有序字形的
 * 横条子路径起始于 x=5（`M5 5h14…`），若用 8 会把横条误计入标记列，使旧
 * 字形也得到 2 种签名（测试不再 RED）。5 恰好排除横条、保留三枚标记
 * （旧有序 x=3、无序 x=4、规范编号 x=3.6/4）。
 */
function leadingMarkSignatures(d: string): Set<string> {
  const sigs = new Set<string>();
  for (const { startX, body } of subpathStarts(d)) {
    if (startX < 5) sigs.add(shapeSignature(body));
  }
  return sigs;
}

describe("有序列表字形（#1433）", () => {
  it("有序列表第一个 path 等于 ui/icons 的规范编号字形（SSOT 同源）", () => {
    expect(firstPathD("OrderListOutlined")).toBe(ICONS.ordered.s);
  });

  it("有序与无序的图标路径不相等", () => {
    expect(firstPathD("OrderListOutlined")).not.toBe(
      firstPathD("DisorderListOutlined"),
    );
  });

  it("无序列表左缘标记列只有 1 种形状（三枚相同圆点）", () => {
    const sigs = leadingMarkSignatures(firstPathD("DisorderListOutlined"));
    expect(sigs.size).toBe(1);
  });

  it("有序列表左缘标记列有 ≥2 种形状（编号不是均匀标记）", () => {
    const sigs = leadingMarkSignatures(firstPathD("OrderListOutlined"));
    expect(sigs.size).toBeGreaterThanOrEqual(2);
  });
});
