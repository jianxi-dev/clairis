import { afterEach, describe, expect, it } from "vitest";
import {
  docFieldTypesKey,
  readDocFieldTypes,
  writeDocFieldTypes,
} from "../../lib/docFieldTypes";

const DOC = "/Users/test/doc.md";

describe("docFieldTypes 持久化", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("写入后原样读回", () => {
    writeDocFieldTypes(DOC, { category: "date", status: "number" });
    expect(readDocFieldTypes(DOC)).toEqual({
      category: "date",
      status: "number",
    });
  });

  it("空映射删除键，读回空对象", () => {
    writeDocFieldTypes(DOC, { category: "date" });
    writeDocFieldTypes(DOC, {});
    expect(localStorage.getItem(docFieldTypesKey(DOC))).toBeNull();
    expect(readDocFieldTypes(DOC)).toEqual({});
  });

  it("损坏 JSON 视为无记录", () => {
    localStorage.setItem(docFieldTypesKey(DOC), "{bad");
    expect(readDocFieldTypes(DOC)).toEqual({});
  });

  it("非对象与未知类型被丢弃", () => {
    localStorage.setItem(docFieldTypesKey(DOC), JSON.stringify(["date"]));
    expect(readDocFieldTypes(DOC)).toEqual({});

    localStorage.setItem(
      docFieldTypesKey(DOC),
      JSON.stringify({ category: "date", note: "not-a-type" }),
    );
    expect(readDocFieldTypes(DOC)).toEqual({ category: "date" });
  });
});