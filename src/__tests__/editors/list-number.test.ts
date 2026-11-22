import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";
import {
  classifyListLine,
  computeOrderedNumbers,
  orderedLiteralChanges,
} from "../../editors/list-number";

/** 只取计算序号，便于断言。 */
function numbers(lines: readonly string[]): number[] {
  return computeOrderedNumbers(lines).map((entry) => entry.number);
}

describe("computeOrderedNumbers", () => {
  it("连续段从 1 起递增", () => {
    expect(numbers(["1. 甲", "2. 乙", "3. 丙"])).toEqual([1, 2, 3]);
  });

  it("连续段忽略源码字面量，一律重算", () => {
    expect(numbers(["1. 甲", "1. 乙", "9. 丙"])).toEqual([1, 2, 3]);
  });

  it("空行不打断连续段", () => {
    expect(numbers(["1. 甲", "", "2. 乙"])).toEqual([1, 2]);
  });

  it("无序项打断同层连续段", () => {
    expect(numbers(["1. 甲", "- 无序", "2. 乙"])).toEqual([1, 1]);
  });

  it("任务项打断同层连续段", () => {
    expect(numbers(["1. 甲", "- [ ] 任务", "2. 乙"])).toEqual([1, 1]);
  });

  it("普通段落打断同层连续段", () => {
    expect(numbers(["1. 甲", "正文", "2. 乙"])).toEqual([1, 1]);
  });

  it("嵌套列表独立计数，外层连续段不被 deeper 行打断", () => {
    expect(numbers(["1. 甲", "  1. 子甲", "  2. 子乙", "2. 乙"])).toEqual([
      1, 1, 2, 2,
    ]);
  });

  it("浅层行重置更深层计数器", () => {
    expect(numbers(["  1. 子", "1. 顶"])).toEqual([1, 1]);
  });

  it("删除中间项后剩余项重算", () => {
    expect(numbers(["1. 甲", "3. 丙"])).toEqual([1, 2]);
  });

  it("插入中间项后前后连续", () => {
    expect(numbers(["1. 甲", "2. 丙"])).toEqual([1, 2]);
  });

  it("引用前缀里的有序项同样编号", () => {
    expect(numbers(["> 1. 甲", "> 2. 乙"])).toEqual([1, 2]);
  });

  it("给出字面量偏移，供源码改写", () => {
    const entries = computeOrderedNumbers(["1. 甲", "2. 乙"]);
    expect(entries[0]).toMatchObject({ line: 1, literalFrom: 0, literalTo: 1 });
    expect(entries[1]).toMatchObject({ line: 2, literalFrom: 5, literalTo: 6 });
  });

  it("isSkipped 跳过围栏代码块行", () => {
    // 行 0-2 是围栏块，整段跳过；只有最后一行参与。
    const skipped = (lineStart: number): boolean => lineStart < 16;
    const entries = computeOrderedNumbers(
      ["```", "5. code", "```", "1. 甲"],
      skipped,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.number).toBe(1);
  });
});

describe("orderedLiteralChanges", () => {
  it("把偏离的编号字面量改成计算值", () => {
    const changes = orderedLiteralChanges(Text.of(["1. 甲", "1. 乙"]));
    expect(changes).toEqual([{ from: 5, to: 6, insert: "2" }]);
  });

  it("已一致时返回空数组", () => {
    expect(orderedLiteralChanges(Text.of(["1. 甲", "2. 乙"]))).toEqual([]);
  });

  it("嵌套独立：外层与内层各自 1 起", () => {
    const changes = orderedLiteralChanges(
      Text.of(["1. 甲", "  2. 子", "  3. 子乙", "3. 乙"]),
    );
    expect(changes).toEqual([
      { from: 7, to: 8, insert: "1" },
      { from: 14, to: 15, insert: "2" },
      { from: 20, to: 21, insert: "2" },
    ]);
  });

  it("围栏代码块内的数字字面量不被改写", () => {
    const doc = Text.of(["```", "5. code", "```", "1. 甲"]);
    expect(orderedLiteralChanges(doc)).toEqual([]);
  });

  it("围栏块之后的有序项仍参与编号", () => {
    const doc = Text.of(["```", "5. code", "```", "2. 甲"]);
    expect(orderedLiteralChanges(doc)).toEqual([
      { from: 16, to: 17, insert: "1" },
    ]);
  });

  it("普通段落里的数字文本不被改写", () => {
    const doc = Text.of(["版本 2.0 发布", "1. 甲"]);
    expect(orderedLiteralChanges(doc)).toEqual([]);
  });
});

describe("classifyListLine（迁移后仍从 list 再导出）", () => {
  it("引用前缀 + 缩进仍归类为有序", () => {
    const info = classifyListLine(">   1. 甲");
    expect(info.kind).toBe("ordered");
    expect(info.prefixLen).toBe(2);
    expect(info.indentLen).toBe(2);
    expect(info.depth).toBe(1);
  });
});
