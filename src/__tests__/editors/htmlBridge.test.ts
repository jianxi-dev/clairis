import { describe, expect, it } from "vitest";
import {
  BRIDGE_VERSION,
  commandForCaptureMode,
  commandForRange,
  commandForSelection,
  parseBridgeMessage,
} from "../../editors/html/bridge";

describe("桥消息收口（E-16 切片 3）", () => {
  it("接受合法 selection", () => {
    expect(
      parseBridgeMessage({
        v: BRIDGE_VERSION,
        type: "selection",
        nodeId: "p:0",
      }),
    ).toEqual({ v: BRIDGE_VERSION, type: "selection", nodeId: "p:0" });
  });

  it("接受 null nodeId（点空白）", () => {
    expect(
      parseBridgeMessage({
        v: BRIDGE_VERSION,
        type: "selection",
        nodeId: null,
      }),
    ).toEqual({ v: BRIDGE_VERSION, type: "selection", nodeId: null });
  });

  it("版本位不符一律丢弃", () => {
    expect(
      parseBridgeMessage({ v: 99, type: "selection", nodeId: "p:0" }),
    ).toBeNull();
  });

  it("形状不对一律丢弃（非对象 / 未知类型 / nodeId 类型错）", () => {
    expect(parseBridgeMessage(null)).toBeNull();
    expect(parseBridgeMessage("selection")).toBeNull();
    expect(parseBridgeMessage({ v: BRIDGE_VERSION, type: "nope" })).toBeNull();
    expect(
      parseBridgeMessage({ v: BRIDGE_VERSION, type: "selection", nodeId: 7 }),
    ).toBeNull();
  });

  it("ready 必须带 nodeCount", () => {
    expect(
      parseBridgeMessage({ v: BRIDGE_VERSION, type: "ready", nodeCount: 3 }),
    ).toEqual({ v: BRIDGE_VERSION, type: "ready", nodeCount: 3 });
    expect(parseBridgeMessage({ v: BRIDGE_VERSION, type: "ready" })).toBeNull();
  });

  it("undoRequest / redoRequest 原样解析（#321）", () => {
    expect(
      parseBridgeMessage({ v: BRIDGE_VERSION, type: "undoRequest" }),
    ).toEqual({ v: BRIDGE_VERSION, type: "undoRequest" });
    expect(
      parseBridgeMessage({ v: BRIDGE_VERSION, type: "redoRequest" }),
    ).toEqual({ v: BRIDGE_VERSION, type: "redoRequest" });
  });

  it("命令与版本位同源", () => {
    expect(commandForSelection("p:0")).toEqual({
      v: BRIDGE_VERSION,
      type: "highlight",
      nodeId: "p:0",
    });
    expect(commandForSelection(null).nodeId).toBeNull();
  });
});

describe("选区几何上报（E-19 工具条定位）", () => {
  it("矩形消息解析通过", () => {
    const msg = {
      v: BRIDGE_VERSION,
      type: "selectionRect",
      nodeId: "p:1",
      rect: { x: 10, y: 20, width: 300, height: 40 },
    };
    expect(parseBridgeMessage(msg)).toEqual(msg);
  });

  it("缺字段或非数字一律丢弃", () => {
    const base = {
      v: BRIDGE_VERSION,
      type: "selectionRect",
      nodeId: "p:0",
      rect: { x: 0, y: 0, width: 10, height: 10 },
    };
    expect(parseBridgeMessage({ ...base, rect: null })).toBeNull();
    expect(
      parseBridgeMessage({ ...base, rect: { x: 0, y: 0, width: "10" } }),
    ).toBeNull();
    expect(
      parseBridgeMessage({
        ...base,
        rect: { x: 0, y: 0, width: 10, height: NaN },
      }),
    ).toBeNull();
    expect(parseBridgeMessage({ ...base, nodeId: undefined })).toBeNull();
  });
});

describe("文字选区与回写消息（HTML 文字工具条）", () => {
  it("textSelection 接受矩形；null 表示清空", () => {
    const rect = { x: 1, y: 2, width: 30, height: 20 };
    expect(
      parseBridgeMessage({
        v: BRIDGE_VERSION,
        type: "textSelection",
        rect,
        text: "第一段",
      }),
    ).toEqual({
      v: BRIDGE_VERSION,
      type: "textSelection",
      rect,
      text: "第一段",
      align: "left",
    });
    expect(
      parseBridgeMessage({
        v: BRIDGE_VERSION,
        type: "textSelection",
        rect,
        text: "第一段",
        align: "justify",
      }),
    ).toEqual({
      v: BRIDGE_VERSION,
      type: "textSelection",
      rect,
      text: "第一段",
      align: "justify",
    });
    expect(
      parseBridgeMessage({
        v: BRIDGE_VERSION,
        type: "textSelection",
        rect: null,
        text: "",
      }),
    ).toEqual({
      v: BRIDGE_VERSION,
      type: "textSelection",
      rect: null,
      text: "",
      align: "left",
    });
    expect(
      parseBridgeMessage({
        v: BRIDGE_VERSION,
        type: "textSelection",
        rect: { x: 0, y: 0, width: "1", height: 1 },
        text: "x",
      }),
    ).toBeNull();
  });

  it("rangeHtml 必须同时带 nodeId 与 html", () => {
    const ok = {
      v: BRIDGE_VERSION,
      type: "rangeHtml",
      nodeId: "p:0",
      html: "<span>改</span>",
    };
    expect(parseBridgeMessage(ok)).toEqual(ok);
    expect(parseBridgeMessage({ ...ok, html: 3 })).toBeNull();
    expect(
      parseBridgeMessage({
        ...ok,
        blockStyle: { "text-align": "justify", bad: 42 },
      }),
    ).toEqual({ ...ok, blockStyle: { "text-align": "justify" } });
  });

  it("rangeCommand 与版本位同源", () => {
    expect(commandForRange("bold")).toEqual({
      v: BRIDGE_VERSION,
      type: "rangeCommand",
      command: "bold",
      value: undefined,
    });
  });
});

describe("拖拽移动与区域截图消息（E-20 / E-21）", () => {
  it("moveNode 需要 nodeId / targetId / position", () => {
    const ok = {
      v: BRIDGE_VERSION,
      type: "moveNode",
      nodeId: "p:1",
      targetId: "p:0",
      position: "before",
    };
    expect(parseBridgeMessage(ok)).toEqual(ok);
    expect(parseBridgeMessage({ ...ok, position: "inside" })).toBeNull();
    expect(parseBridgeMessage({ ...ok, targetId: 3 })).toBeNull();
  });

  it("captureRegion 解析区域与 body 样式，非字符串值被丢弃", () => {
    const parsed = parseBridgeMessage({
      v: BRIDGE_VERSION,
      type: "captureRegion",
      region: { x: 10, y: 20, width: 300, height: 100 },
      viewportWidth: 900,
      bodyStyle: { "font-size": "16px", bad: 42 },
    });
    expect(parsed).toEqual({
      v: BRIDGE_VERSION,
      type: "captureRegion",
      region: { x: 10, y: 20, width: 300, height: 100 },
      viewportWidth: 900,
      bodyStyle: { "font-size": "16px" },
    });
    expect(
      parseBridgeMessage({
        v: BRIDGE_VERSION,
        type: "captureRegion",
        region: { x: 0, y: 0, width: 1, height: 1 },
        viewportWidth: "900",
      }),
    ).toBeNull();
  });

  it("截图模式命令与版本位同源", () => {
    expect(commandForCaptureMode(true)).toEqual({
      v: BRIDGE_VERSION,
      type: "captureMode",
      active: true,
    });
  });
});
