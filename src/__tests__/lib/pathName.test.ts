import { describe, expect, it } from "vitest";
import {
  defaultSaveName,
  joinStemExt,
  splitStemExt,
  stripDocExt,
} from "../../lib/pathName";

describe("pathName（#1263）", () => {
  it("splitStemExt：普通 / 多后缀 / 隐藏文件 / 无扩展名", () => {
    expect(splitStemExt("笔记.md")).toEqual({ stem: "笔记", ext: ".md" });
    expect(splitStemExt("a.b.md")).toEqual({ stem: "a.b", ext: ".md" });
    expect(splitStemExt(".env")).toEqual({ stem: ".env", ext: "" });
    expect(splitStemExt("README")).toEqual({ stem: "README", ext: "" });
  });

  it("joinStemExt：不重复拼同扩展名", () => {
    expect(joinStemExt("笔记", ".md")).toBe("笔记.md");
    expect(joinStemExt("笔记.md", ".md")).toBe("笔记.md");
    expect(joinStemExt("笔记", "")).toBe("笔记");
  });

  it("defaultSaveName：不产生 x.md.md", () => {
    expect(defaultSaveName("x")).toBe("x.md");
    expect(defaultSaveName("x.md")).toBe("x.md");
    expect(defaultSaveName("")).toBe("未命名.md");
  });

  it("stripDocExt：只剥文档扩展名，不误伤版本号", () => {
    expect(stripDocExt("笔记.md")).toBe("笔记");
    expect(stripDocExt("笔记.MARKDOWN")).toBe("笔记");
    expect(stripDocExt("v1.2")).toBe("v1.2");
  });
});
