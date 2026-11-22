import { describe, expect, it } from "vitest";
import { formatFileSize } from "../../lib/fileSize";

describe("formatFileSize", () => {
  it("按 1024 阶梯格式化，与 Tauri metadata 的字节数一致", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
    expect(formatFileSize(1024)).toBe("1.00KB");
    expect(formatFileSize(1536)).toBe("1.50KB");
    expect(formatFileSize(12 * 1024 * 1024)).toBe("12.00MB");
    expect(formatFileSize(12897485)).toBe("12.30MB");
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.00GB");
  });

  it("非法值返回空串，不出 NaN / Infinity", () => {
    expect(formatFileSize(Number.NaN)).toBe("");
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe("");
    expect(formatFileSize(-1)).toBe("");
  });
});
