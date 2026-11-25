// bug #1494：配置重载每 ~2s 全量重写 settings.json / state.json 的自持环。
//
// 环的驱动之一：applyRustConfig 每次重载无条件把 raw.scrollPositions /
// raw.embedScrollPositions 交给 store 的 setter，即使内容与当前完全一致也
// 传入新对象引用；App.tsx 的持久化 effect 依赖这两个引用 → 每次重载都
// scheduleSave → 写盘 → Rust watcher → config-changed → 重载，循环不止。
//
// 本测试锁死契约：内容相等时必须保持既有引用（不触发 effect），内容真有
// 变化时才更新。
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../../stores/index";
import type { ScrollPosition } from "../../types";

describe("scroll position setters — 引用稳定性（bug #1494）", () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it("setScrollPositions 内容相等时保持既有引用", () => {
    const first: Record<string, ScrollPosition> = {
      "/a.md": { scrollPos: 120, contentHeight: 2000 },
    };
    useStore.getState().setScrollPositions(first);
    const before = useStore.getState().scrollPositions;
    expect(before).toBe(first);

    // 内容相同、引用不同（重载路径的真实形态）
    useStore.getState().setScrollPositions({
      "/a.md": { scrollPos: 120, contentHeight: 2000 },
    });
    expect(useStore.getState().scrollPositions).toBe(before);
  });

  it("setScrollPositions 内容变化时更新", () => {
    useStore.getState().setScrollPositions({
      "/a.md": { scrollPos: 120, contentHeight: 2000 },
    });
    const before = useStore.getState().scrollPositions;

    useStore.getState().setScrollPositions({
      "/a.md": { scrollPos: 120, contentHeight: 2000 },
      "/b.md": { scrollPos: 0, contentHeight: 800 },
    });
    const after = useStore.getState().scrollPositions;
    expect(after).not.toBe(before);
    expect(after["/b.md"]).toEqual({ scrollPos: 0, contentHeight: 800 });
  });

  it("setScrollPositions 同键数值变化时更新", () => {
    useStore.getState().setScrollPositions({
      "/a.md": { scrollPos: 120, contentHeight: 2000 },
    });
    const before = useStore.getState().scrollPositions;

    useStore.getState().setScrollPositions({
      "/a.md": { scrollPos: 600, contentHeight: 2000 },
    });
    const after = useStore.getState().scrollPositions;
    expect(after).not.toBe(before);
    expect(after["/a.md"].scrollPos).toBe(600);
  });

  it("setEmbedScrollPositions 内容相等时保持既有引用", () => {
    const first: Record<string, ScrollPosition> = {
      "embed-1": { scrollPos: 30, contentHeight: 500 },
    };
    useStore.getState().setEmbedScrollPositions(first);
    const before = useStore.getState().embedScrollPositions;
    expect(before).toBe(first);

    useStore.getState().setEmbedScrollPositions({
      "embed-1": { scrollPos: 30, contentHeight: 500 },
    });
    expect(useStore.getState().embedScrollPositions).toBe(before);
  });

  it("setEmbedScrollPositions 内容变化时更新", () => {
    useStore.getState().setEmbedScrollPositions({
      "embed-1": { scrollPos: 30, contentHeight: 500 },
    });
    const before = useStore.getState().embedScrollPositions;

    useStore.getState().setEmbedScrollPositions({
      "embed-1": { scrollPos: 30, contentHeight: 500 },
      "embed-2": { scrollPos: 0, contentHeight: 400 },
    });
    const after = useStore.getState().embedScrollPositions;
    expect(after).not.toBe(before);
    expect(after["embed-2"]).toEqual({ scrollPos: 0, contentHeight: 400 });
  });
});
