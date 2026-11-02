import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAPABILITY_META,
  applyCapabilityConfig,
  disableCapability,
  enableCapability,
  isCapabilityEnabled,
  listCapabilities,
  resetCapabilities,
  serializeCapabilities,
  setCapabilityEnabled,
  subscribeCapability,
} from "../../lib/capabilities";

afterEach(() => {
  resetCapabilities();
});

describe("默认状态", () => {
  it("全部能力默认开启", () => {
    for (const meta of CAPABILITY_META) {
      expect(isCapabilityEnabled(meta.id)).toBe(true);
    }
    expect(listCapabilities().every((c) => c.enabled)).toBe(true);
  });

  it("没有关闭项时序列化为空表", () => {
    expect(serializeCapabilities()).toEqual({});
  });
});

describe("enable/disable 幂等", () => {
  it("关闭后为 false，重新开启为 true", () => {
    expect(disableCapability("mermaid")).toBe(true);
    expect(isCapabilityEnabled("mermaid")).toBe(false);
    expect(enableCapability("mermaid")).toBe(true);
    expect(isCapabilityEnabled("mermaid")).toBe(true);
  });

  it("重复关闭不重复通知，返回 false", () => {
    const listener = vi.fn();
    subscribeCapability(listener);

    expect(setCapabilityEnabled("math", false)).toBe(true);
    expect(setCapabilityEnabled("math", false)).toBe(false);
    expect(setCapabilityEnabled("math", false)).toBe(false);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("math", false);
  });

  it("重复开启同样只通知一次", () => {
    const listener = vi.fn();
    subscribeCapability(listener);
    disableCapability("code-highlight");

    expect(enableCapability("code-highlight")).toBe(true);
    expect(enableCapability("code-highlight")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("订阅", () => {
  it("同一个函数重复订阅只注册一次", () => {
    const listener = vi.fn();
    subscribeCapability(listener);
    subscribeCapability(listener);

    setCapabilityEnabled("preview-zoom", false);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("退订后不再收到通知", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCapability(listener);
    unsubscribe();

    setCapabilityEnabled("math", false);

    expect(listener).not.toHaveBeenCalled();
  });

  it("多个订阅者各自收到一次，顺序与订阅一致", () => {
    const calls: string[] = [];
    subscribeCapability(() => calls.push("a"));
    subscribeCapability(() => calls.push("b"));

    setCapabilityEnabled("mermaid", false);

    expect(calls).toEqual(["a", "b"]);
  });
});

describe("持久化", () => {
  it("只序列化被关闭的能力", () => {
    disableCapability("math");
    disableCapability("mermaid");

    expect(serializeCapabilities()).toEqual({ math: false, mermaid: false });
  });

  it("应用配置：缺省为开、false 为关、未知 id 忽略", () => {
    applyCapabilityConfig({ math: false, "not-a-capability": false });

    expect(isCapabilityEnabled("math")).toBe(false);
    expect(isCapabilityEnabled("mermaid")).toBe(true);
  });

  it("重复应用同一份配置不重复通知", () => {
    const listener = vi.fn();
    applyCapabilityConfig({ math: false });
    subscribeCapability(listener);

    applyCapabilityConfig({ math: false });
    applyCapabilityConfig({ math: false });

    expect(listener).not.toHaveBeenCalled();
  });

  it("配置里显式 true 会把已关闭的能力重新打开", () => {
    disableCapability("math");
    applyCapabilityConfig({ math: true });

    expect(isCapabilityEnabled("math")).toBe(true);
  });

  it("null / undefined 配置不改变任何状态", () => {
    disableCapability("math");
    applyCapabilityConfig(null);
    applyCapabilityConfig(undefined);

    expect(isCapabilityEnabled("math")).toBe(false);
  });
});

describe("resetCapabilities", () => {
  it("恢复全开，且不摘掉已注册的订阅者", () => {
    const listener = vi.fn();
    subscribeCapability(listener);
    disableCapability("math");
    listener.mockClear();

    resetCapabilities();

    expect(isCapabilityEnabled("math")).toBe(true);
    disableCapability("math");
    expect(listener).toHaveBeenCalledWith("math", false);
  });
});
