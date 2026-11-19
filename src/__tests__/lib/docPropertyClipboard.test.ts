import { describe, expect, it } from "vitest";
import {
  clearFieldSelection,
  decodeFieldSelection,
  encodeFieldSelection,
  getFieldSelection,
  setFieldSelection,
  type DocPropertyClipboardPayload,
} from "../../lib/docPropertyClipboard";
import { uniqueKey, type FrontmatterField } from "../../lib/frontmatter";

const FIELDS: FrontmatterField[] = [
  { key: "分类", type: "text", value: "草稿", display: "草稿" },
  { key: "作者", type: "text", value: "张三", display: "张三" },
  { key: "数量", type: "number", value: 42, display: "42" },
  { key: "发布", type: "boolean", value: true, display: "开" },
  { key: "标签", type: "array", value: ["甲", "乙"], display: "甲、乙" },
  { key: "截止", type: "date", value: "2026-11-14", display: "2026-11-14" },
];

describe("encodeFieldSelection（复制不含值）", () => {
  it("剥离 value / display，保留 key / type 与版本号", () => {
    const payload = encodeFieldSelection(FIELDS, [0, 1]);
    expect(payload.version).toBe(1);
    expect(payload.fields).toEqual([
      { key: "分类", type: "text" },
      { key: "作者", type: "text" },
    ]);
    for (const entry of payload.fields) {
      expect(entry).not.toHaveProperty("value");
      expect(entry).not.toHaveProperty("display");
    }
  });

  it("下标升序去重，越界 / 非整数忽略", () => {
    const payload = encodeFieldSelection(FIELDS, [4, 2, 2, 99, -1, 1.5]);
    expect(payload.fields.map((f) => f.key)).toEqual(["数量", "标签"]);
  });

  it("未来属性进 attrs，不混入值", () => {
    const extra = {
      key: "重量",
      type: "number",
      value: 3,
      display: "3",
      unit: "kg",
    } as unknown as FrontmatterField;
    const payload = encodeFieldSelection([extra], [0]);
    expect(payload.fields[0]).toEqual({
      key: "重量",
      type: "number",
      attrs: { unit: "kg" },
    });
  });
});

describe("decodeFieldSelection（按类型重建空值）", () => {
  it("文本 / 数字 / 日期时间 / 布尔为空串", () => {
    const payload: DocPropertyClipboardPayload = {
      version: 1,
      fields: [
        { key: "a", type: "text" },
        { key: "b", type: "number" },
        { key: "c", type: "date" },
        { key: "d", type: "datetime" },
        { key: "e", type: "boolean" },
      ],
    };
    const out = decodeFieldSelection(payload);
    expect(out.map((f) => f.value)).toEqual(["", "", "", "", ""]);
    expect(out.every((f) => f.display === "")).toBe(true);
  });

  it("数组 / 复选为空列表", () => {
    const payload: DocPropertyClipboardPayload = {
      version: 1,
      fields: [
        { key: "tags", type: "array" },
        { key: "checks", type: "multiselect" },
      ],
    };
    const out = decodeFieldSelection(payload);
    expect(out[0].value).toEqual([]);
    expect(out[1].value).toEqual([]);
  });

  it("attrs 随字段重建", () => {
    const payload: DocPropertyClipboardPayload = {
      version: 1,
      fields: [{ key: "重量", type: "number", attrs: { unit: "kg" } }],
    };
    const [field] = decodeFieldSelection(payload);
    expect(field.value).toBe("");
    expect((field as unknown as Record<string, unknown>).unit).toBe("kg");
  });

  it("encode → decode 往返：键 / 类型一致，值为空", () => {
    const out = decodeFieldSelection(
      encodeFieldSelection(FIELDS, [0, 2, 3, 4, 5]),
    );
    expect(out.map((f) => [f.key, f.type])).toEqual([
      ["分类", "text"],
      ["数量", "number"],
      ["发布", "boolean"],
      ["标签", "array"],
      ["截止", "date"],
    ]);
    expect(out.map((f) => f.value)).toEqual(["", "", "", [], ""]);
  });

  it("版本不符 / 结构非法 / 类型不识别时安全返回", () => {
    expect(decodeFieldSelection(null)).toEqual([]);
    expect(
      decodeFieldSelection({
        version: 99,
        fields: [],
      } as unknown as DocPropertyClipboardPayload),
    ).toEqual([]);
    expect(
      decodeFieldSelection({
        version: 1,
        fields: [
          { key: "x", type: "bogus" },
          { key: "", type: "text" },
        ],
      } as unknown as DocPropertyClipboardPayload),
    ).toEqual([{ key: "", type: "text", value: "", display: "" }]);
  });
});

describe("模块级剪贴板单例", () => {
  it("set / get / clear 跨调用保持", () => {
    const payload = encodeFieldSelection(FIELDS, [0]);
    setFieldSelection(payload);
    expect(getFieldSelection()).toBe(payload);
    clearFieldSelection();
    expect(getFieldSelection()).toBeNull();
  });
});

describe("粘贴去重（uniqueKey 依次顺延）", () => {
  it("载荷顺序保留，目标已有同名键时追加序号", () => {
    const clones = decodeFieldSelection(
      encodeFieldSelection(FIELDS, [0, 1, 0]),
    );
    const taken = new Set(["分类"]);
    const keys = clones.map((f) => {
      const key = uniqueKey(f.key, taken);
      taken.add(key);
      return key;
    });
    expect(keys).toEqual(["分类-2", "作者"]);
  });
});
