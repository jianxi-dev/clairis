// 测试文件（fixture）：应被 excludeGlobs 的 **/*.test.ts 排除，不计入统计。
import { describe, expect, it } from "vitest";

describe("sample", () => {
  it("excluded from count", () => {
    expect(true).toBe(true);
  });
});
