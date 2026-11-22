import { describe, expect, it } from "vitest";
import {
  emptyItemEnterAction,
  hasDeeperChild,
} from "../../editors/list-indent";

describe("hasDeeperChild", () => {
  it("后续首个非空行缩进更深即为有子项", () => {
    expect(hasDeeperChild(0, ["  - 子项"])).toBe(true);
    expect(hasDeeperChild(2, ["    - 孙项"])).toBe(true);
  });

  it("同级或更浅的后续行不算子项", () => {
    expect(hasDeeperChild(0, ["- 兄弟"])).toBe(false);
    expect(hasDeeperChild(2, ["- 上级"])).toBe(false);
  });

  it("跳过空行后按首个非空行判定", () => {
    expect(hasDeeperChild(0, ["", "  - 空行后的子项"])).toBe(true);
    expect(hasDeeperChild(0, ["", "- 空行后的兄弟"])).toBe(false);
  });

  it("没有后续行时为 false", () => {
    expect(hasDeeperChild(0, [])).toBe(false);
  });
});

describe("emptyItemEnterAction", () => {
  it("有子项且仍有缩进 → 退一层", () => {
    expect(emptyItemEnterAction(2, ["    - 孙项"])).toBe("outdent");
  });

  it("无子项 → 退出列表", () => {
    expect(emptyItemEnterAction(2, ["- 兄弟"])).toBe("exit-list");
    expect(emptyItemEnterAction(2, [])).toBe("exit-list");
  });

  it("已在首层即使有子项也退出列表（子项留在原位）", () => {
    expect(emptyItemEnterAction(0, ["  - 子项"])).toBe("exit-list");
  });
});
