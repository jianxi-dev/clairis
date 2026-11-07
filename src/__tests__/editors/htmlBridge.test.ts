import { describe, expect, it } from "vitest";
import {
  BRIDGE_VERSION,
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
