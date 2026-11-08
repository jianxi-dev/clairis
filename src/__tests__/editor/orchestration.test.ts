/**
 * 编排层纯逻辑测试（md-orchestration 1.1）。
 *
 * 覆盖：菜单栈（push/pop/幂等/不 retarget/closeAll）、锚点与摆放（翻转/夹取/回退）、
 * hover 门控（300ms 显现、150ms 收起、触摸与抑制不触发、再进入取消关闭）。
 * 全部用注入时间，不依赖真实定时器与 DOM 布局。
 */
import { describe, expect, it, vi } from "vitest";
import {
  rectFromCoords,
  clampRect,
  resolvePlacement,
  intersectRects,
  PANEL_MAX_HEIGHT,
  type AnchorRect,
} from "../../editors/orchestration/anchor";
import {
  createAnchorTracker,
  placeMenu,
} from "../../editors/orchestration/placement";
import {
  MenuStack,
  menuStack,
  resetMenuStack,
  type MenuEntry,
  type MenuOwner,
} from "../../editors/orchestration/menu-stack";
import { HoverGate } from "../../editors/orchestration/hover-gate";
import { createTestEditor } from "./testEditor";

// --- 测试辅助 ----------------------------------------------------------------

const BOUNDS: AnchorRect = {
  left: 0,
  top: 0,
  right: 400,
  bottom: 300,
  width: 400,
  height: 300,
};

function rect(partial: Partial<AnchorRect>): AnchorRect {
  return {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    ...partial,
  };
}

function owner(blockFrom: number, blockTo: number): MenuOwner {
  return { blockFrom, blockTo };
}

function entry(
  id: string,
  blockFrom: number,
  blockTo: number,
  onClose = vi.fn(),
  element = document.createElement("div"),
): MenuEntry {
  return { id, owner: owner(blockFrom, blockTo), element, onClose };
}

// --- 菜单栈 ------------------------------------------------------------------

describe("MenuStack", () => {
  it("push 返回 token，top 为栈顶，size 为 1", () => {
    const stack = new MenuStack();
    const first = entry("a", 0, 5);

    const token = stack.push(first);

    expect(typeof token).toBe("symbol");
    expect(stack.size()).toBe(1);
    expect(stack.top()).toBe(first);
  });

  it("同 owner 重入幂等：返回已有 token，不入栈", () => {
    const stack = new MenuStack();
    const first = entry("a", 0, 5);
    const token = stack.push(first);

    const again = stack.push(first);

    expect(again).toBe(token);
    expect(stack.size()).toBe(1);
    expect(stack.top()).toBe(first);
  });

  it("不同 owner 返回 null 且不入栈（不 retarget）", () => {
    const stack = new MenuStack();
    const first = entry("a", 0, 5);
    stack.push(first);

    const token = stack.push(entry("b", 6, 10));

    expect(token).toBeNull();
    expect(stack.size()).toBe(1);
    expect(stack.top()).toBe(first);
  });

  it("pop 移除条目并调用一次 onClose", () => {
    const stack = new MenuStack();
    const onClose = vi.fn();
    const token = stack.push(entry("a", 0, 5, onClose));

    expect(stack.pop(token as symbol)).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stack.size()).toBe(0);
    expect(stack.top()).toBeNull();
  });

  it("pop 未知 token 返回 false，且 onClose 只调用一次", () => {
    const stack = new MenuStack();
    const onClose = vi.fn();
    const token = stack.push(entry("a", 0, 5, onClose));

    stack.pop(token as symbol);

    expect(stack.pop(token as symbol)).toBe(false);
    expect(stack.pop(Symbol("never-pushed"))).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closeAll 自顶向下关闭并清空", () => {
    const stack = new MenuStack();
    const elA = document.createElement("div");
    const elB = document.createElement("div");
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();
    // 同 owner 的不同层才能叠加。
    stack.push({
      id: "a",
      owner: owner(0, 5),
      element: elA,
      onClose: onCloseA,
    });
    stack.push({
      id: "b",
      owner: owner(0, 5),
      element: elB,
      onClose: onCloseB,
    });
    expect(stack.size()).toBe(2);

    stack.closeAll("scroll");

    expect(stack.size()).toBe(0);
    expect(stack.top()).toBeNull();
    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).toHaveBeenCalledTimes(1);
    expect(onCloseB).toHaveBeenCalledWith("scroll");
  });

  it("has 按 owner 查询", () => {
    const stack = new MenuStack();
    stack.push(entry("a", 0, 5));

    expect(stack.has(owner(0, 5))).toBe(true);
    expect(stack.has(owner(6, 10))).toBe(false);
    expect(stack.has(null)).toBe(false);
  });

  it("空栈 top 为 null，pop 未知 token 不抛错", () => {
    const stack = new MenuStack();
    expect(stack.top()).toBeNull();
    expect(stack.size()).toBe(0);
    expect(stack.pop(Symbol("missing"))).toBe(false);
  });

  it("模块级单例与 resetMenuStack", () => {
    resetMenuStack();
    const onClose = vi.fn();
    const token = menuStack.push(entry("solo", 0, 5, onClose));

    expect(menuStack.size()).toBe(1);

    resetMenuStack();

    expect(menuStack.size()).toBe(0);
    expect(menuStack.top()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(token).not.toBeNull();
  });
});

// --- 锚点矩形 ---------------------------------------------------------------

describe("rectFromCoords", () => {
  it("coords 为 null 时返回零宽矩形，落在 fallbackTop 上", () => {
    const r = rectFromCoords(null, 42);

    expect(r).toEqual({
      left: 0,
      top: 42,
      right: 0,
      bottom: 43,
      width: 0,
      height: 1,
    });
  });

  it("不带 right 的坐标退化为零宽", () => {
    const r = rectFromCoords({ left: 10, top: 100, bottom: 120 }, 0);

    expect(r.left).toBe(10);
    expect(r.right).toBe(10);
    expect(r.width).toBe(0);
    expect(r.top).toBe(100);
    expect(r.bottom).toBe(120);
    expect(r.height).toBe(20);
  });

  it("带 right 的坐标算出宽度", () => {
    const r = rectFromCoords(
      { left: 10, top: 100, right: 130, bottom: 120 },
      0,
    );

    expect(r.width).toBe(120);
    expect(r.right).toBe(130);
  });

  it("永不为 NaN", () => {
    for (const coords of [
      null,
      { left: Number.NaN, top: Number.NaN, bottom: Number.NaN },
      { left: 1, top: 2, bottom: Number.POSITIVE_INFINITY },
    ]) {
      const r = rectFromCoords(coords, Number.NaN);
      expect(Number.isFinite(r.left)).toBe(true);
      expect(Number.isFinite(r.top)).toBe(true);
      expect(Number.isFinite(r.right)).toBe(true);
      expect(Number.isFinite(r.bottom)).toBe(true);
      expect(Number.isFinite(r.width)).toBe(true);
      expect(Number.isFinite(r.height)).toBe(true);
    }
  });
});

describe("clampRect", () => {
  it("完全在边界内时保持不变", () => {
    const inner = rect({ left: 10, top: 10, right: 50, bottom: 40 });
    expect(clampRect(inner, BOUNDS)).toEqual({
      ...inner,
      width: 40,
      height: 30,
    });
  });

  it("右侧溢出时夹到边界右缘", () => {
    const outer = rect({ left: 380, top: 10, right: 500, bottom: 40 });
    const r = clampRect(outer, BOUNDS);
    expect(r.right).toBe(400);
    expect(r.width).toBe(20);
  });

  it("完全在边界外时退化为零尺寸，宽高不为负", () => {
    const outside = rect({ left: 1000, top: 1000, right: 1100, bottom: 1200 });
    const r = clampRect(outside, BOUNDS);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
    expect(r.left).toBe(BOUNDS.left);
    expect(r.top).toBe(BOUNDS.top);
  });
});

// --- 摆放 --------------------------------------------------------------------

describe("resolvePlacement（D4 统一摆放）", () => {
  const VIEWPORT = BOUNDS;
  const PANEL = { width: 100, height: 50 };

  it("空间充足时开在锚点下方、与锚点左对齐", () => {
    const anchor = rect({ left: 100, top: 100, right: 200, bottom: 150 });
    const r = resolvePlacement(anchor, PANEL, VIEWPORT, VIEWPORT);
    expect(r).toMatchObject({
      x: 100,
      y: 154,
      flippedX: false,
      flippedY: false,
    });
  });

  it("底部溢出翻到锚点上方并标记 flippedY", () => {
    const anchor = rect({ left: 100, top: 240, right: 200, bottom: 280 });
    const r = resolvePlacement(anchor, PANEL, VIEWPORT, VIEWPORT);
    expect(r.y).toBe(186);
    expect(r.flippedY).toBe(true);
    expect(r.flippedX).toBe(false);
  });

  it("右侧溢出翻到锚点左侧并标记 flippedX", () => {
    const anchor = rect({ left: 320, top: 100, right: 380, bottom: 150 });
    const r = resolvePlacement(anchor, PANEL, VIEWPORT, VIEWPORT);
    expect(r.x).toBe(276);
    expect(r.flippedX).toBe(true);
    expect(r.flippedY).toBe(false);
  });

  it("右下同时溢出，两个翻转标记都为 true", () => {
    const anchor = rect({ left: 320, top: 240, right: 380, bottom: 280 });
    const r = resolvePlacement(anchor, PANEL, VIEWPORT, VIEWPORT);
    expect(r.x).toBe(276);
    expect(r.y).toBe(186);
    expect(r.flippedX).toBe(true);
    expect(r.flippedY).toBe(true);
  });

  it("翻转后仍溢出则夹进容器内", () => {
    const tiny = rect({
      left: 0,
      top: 0,
      right: 60,
      bottom: 60,
      width: 60,
      height: 60,
    });
    const r = resolvePlacement(
      rect({ left: 40, top: 40, right: 50, bottom: 50 }),
      { width: 100, height: 50 },
      tiny,
      tiny,
    );
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + 100).toBeLessThanOrEqual(60 + 100); // 不再假设能塞下，只要不出 NaN
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });

  it("视口与容器求交后使用更小的边界", () => {
    const viewport = rect({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
    });
    const container = rect({
      left: 0,
      top: 0,
      right: 120,
      bottom: 300,
      width: 120,
      height: 300,
    });
    const r = resolvePlacement(
      rect({ left: 100, top: 10, right: 110, bottom: 20 }),
      PANEL,
      viewport,
      container,
    );
    // 容器只有 120 宽：必须夹到 120 - 8 - 100 之内
    expect(r.x).toBeLessThanOrEqual(12);
  });

  it("可用高度封顶 min(360, 容器高 - 16)", () => {
    const tall = rect({
      left: 0,
      top: 0,
      right: 400,
      bottom: 5000,
      width: 400,
      height: 5000,
    });
    expect(
      resolvePlacement(
        rect({ left: 10, top: 10, right: 20, bottom: 20 }),
        { width: 100, height: 4000 },
        tall,
        tall,
      ).maxHeight,
    ).toBe(PANEL_MAX_HEIGHT);

    const short = rect({
      left: 0,
      top: 0,
      right: 400,
      bottom: 200,
      width: 400,
      height: 200,
    });
    expect(
      resolvePlacement(
        rect({ left: 10, top: 10, right: 20, bottom: 20 }),
        { width: 100, height: 100 },
        short,
        short,
      ).maxHeight,
    ).toBe(184);
  });

  it("零尺寸容器不产生 NaN", () => {
    const zero = rect({ left: 0, top: 0, right: 0, bottom: 0 });
    const r = resolvePlacement(
      rect({ left: 0, top: 0, right: 0, bottom: 0 }),
      PANEL,
      zero,
      zero,
    );
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
    expect(r.maxHeight).toBeGreaterThanOrEqual(0);
  });
});

describe("intersectRects", () => {
  it("返回重叠区域；无交集时退化为零尺寸", () => {
    const a = rect({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
    });
    const b = rect({
      left: 50,
      top: 50,
      right: 200,
      bottom: 200,
      width: 150,
      height: 150,
    });
    expect(intersectRects(a, b)).toMatchObject({
      left: 50,
      top: 50,
      right: 100,
      bottom: 100,
    });

    const far = rect({
      left: 300,
      top: 300,
      right: 400,
      bottom: 400,
      width: 100,
      height: 100,
    });
    const empty = intersectRects(a, far);
    expect(empty.width).toBe(0);
    expect(empty.height).toBe(0);
  });
});

describe("placeMenu", () => {
  const size = { width: 100, height: 50 };

  it("默认开在锚点下方 4px，不翻转", () => {
    const anchor = rect({ left: 100, top: 100, right: 200, bottom: 150 });

    const r = placeMenu(anchor, size, BOUNDS);

    expect(r).toEqual({
      left: 100,
      top: 154,
      flippedX: false,
      flippedY: false,
    });
  });

  it("底部溢出时翻到锚点上方", () => {
    const anchor = rect({ left: 100, top: 240, right: 200, bottom: 280 });

    const r = placeMenu(anchor, size, BOUNDS);

    expect(r.top).toBe(186); // 240 - 50 - 4
    expect(r.flippedY).toBe(true);
    expect(r.left).toBe(100);
  });

  it("右侧溢出时翻到锚点左侧", () => {
    const anchor = rect({ left: 320, top: 100, right: 380, bottom: 150 });

    const r = placeMenu(anchor, size, BOUNDS);

    expect(r.left).toBe(276); // 380 - 100 - 4
    expect(r.flippedX).toBe(true);
    expect(r.flippedY).toBe(false);
    expect(r.top).toBe(154);
  });

  it("右下双翻", () => {
    const anchor = rect({ left: 320, top: 240, right: 380, bottom: 280 });

    const r = placeMenu(anchor, size, BOUNDS);

    expect(r.top).toBe(186);
    expect(r.left).toBe(276);
    expect(r.flippedX).toBe(true);
  });

  it("翻转后仍溢出则夹取到边界内", () => {
    const tall = { width: 100, height: 400 };
    const anchor = rect({ left: 100, top: 100, right: 200, bottom: 150 });

    const r = placeMenu(anchor, tall, BOUNDS);

    expect(r.top).toBe(8); // bounds.top + margin
    expect(Number.isFinite(r.top)).toBe(true);
    expect(Number.isFinite(r.left)).toBe(true);
  });

  it("水平翻转后仍溢出则夹取，不产生 NaN", () => {
    const wide = { width: 500, height: 50 };
    const anchor = rect({ left: 100, top: 100, right: 200, bottom: 150 });

    const r = placeMenu(anchor, wide, BOUNDS);

    expect(r.left).toBe(8); // bounds.left + margin
    expect(Number.isFinite(r.left)).toBe(true);
    expect(Number.isFinite(r.top)).toBe(true);
  });

  it("零尺寸容器不产生 NaN", () => {
    const empty: AnchorRect = {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
    };
    const anchor = rect({ left: 50, top: 50, right: 80, bottom: 70 });

    const r = placeMenu(anchor, size, empty);

    expect(Number.isFinite(r.left)).toBe(true);
    expect(Number.isFinite(r.top)).toBe(true);
  });
});

// --- 锚点追踪器 --------------------------------------------------------------

describe("createAnchorTracker", () => {
  it("coordsAtPos 为 null 时回退到 documentTop，不抛错且无 NaN", () => {
    const { view, destroy } = createTestEditor("# Title\n\nbody");
    vi.spyOn(view, "coordsAtPos").mockReturnValue(null);

    const tracker = createAnchorTracker(view, { from: 0, to: 7 });
    const r = tracker();

    expect(r.top).toBe(view.documentTop);
    expect(Number.isFinite(r.left)).toBe(true);
    expect(Number.isFinite(r.top)).toBe(true);
    expect(Number.isFinite(r.right)).toBe(true);
    expect(Number.isFinite(r.bottom)).toBe(true);
    destroy();
  });

  it("用 coordsAtPos 的结果构造锚点矩形", () => {
    const { view, destroy } = createTestEditor("# Title\n\nbody");
    vi.spyOn(view, "coordsAtPos").mockReturnValue({
      left: 10,
      right: 10,
      top: 100,
      bottom: 120,
    });

    const tracker = createAnchorTracker(view, { from: 0, to: 7 });
    const r = tracker();

    expect(r.left).toBe(10);
    expect(r.top).toBe(100);
    expect(r.bottom).toBe(120);
    expect(r.width).toBe(0);
    expect(r.height).toBe(20);
    destroy();
  });

  it("jsdom 无布局（不 stub）时也不抛错", () => {
    const { view, destroy } = createTestEditor("hello");

    const tracker = createAnchorTracker(view, { from: 0, to: 5 });
    const r = tracker();

    expect(Number.isFinite(r.top)).toBe(true);
    expect(Number.isFinite(r.left)).toBe(true);
    destroy();
  });

  it("位置越界时不抛错", () => {
    const { view, destroy } = createTestEditor("hello");

    const tracker = createAnchorTracker(view, { from: 999, to: 1000 });
    expect(() => tracker()).not.toThrow();
    destroy();
  });
});

// --- hover 门控 --------------------------------------------------------------

describe("HoverGate", () => {
  it("仅 mouse 进入 300ms 后显现", () => {
    const gate = new HoverGate();

    gate.enter("mouse", 0);
    expect(gate.tick(299)).toBeNull();
    expect(gate.isOpen()).toBe(false);

    expect(gate.tick(300)).toBe("show");
    expect(gate.isOpen()).toBe(true);
  });

  it("离开后 150ms 收起", () => {
    const gate = new HoverGate();
    gate.enter("mouse", 0);
    gate.tick(300);

    gate.leave("mouse", 400);
    expect(gate.tick(549)).toBeNull();
    expect(gate.isOpen()).toBe(true);

    expect(gate.tick(550)).toBe("hide");
    expect(gate.isOpen()).toBe(false);
  });

  it("touch / pen 不触发 hover", () => {
    const gate = new HoverGate();

    gate.enter("touch", 0);
    expect(gate.tick(1000)).toBeNull();
    expect(gate.isOpen()).toBe(false);

    gate.enter("pen", 0);
    expect(gate.tick(1000)).toBeNull();
    expect(gate.isOpen()).toBe(false);
  });

  it("抑制状态（键盘输入 / 拖拽中）不触发 hover", () => {
    const gate = new HoverGate();
    gate.suppress(true);

    gate.enter("mouse", 0);
    expect(gate.tick(1000)).toBeNull();
    expect(gate.isOpen()).toBe(false);

    gate.suppress(false);
    gate.enter("mouse", 0);
    expect(gate.tick(300)).toBe("show");
  });

  it("离开后立刻再进入取消待关闭", () => {
    const gate = new HoverGate();
    gate.enter("mouse", 0);
    gate.tick(300); // show
    gate.leave("mouse", 400); // 待 550 关闭

    gate.enter("mouse", 500); // 取消待关闭

    expect(gate.tick(550)).toBeNull();
    expect(gate.isOpen()).toBe(true);
  });

  it("cancel 立即收起并清空待办", () => {
    const gate = new HoverGate();
    gate.enter("mouse", 0);
    gate.tick(300);

    gate.cancel();

    expect(gate.isOpen()).toBe(false);
    expect(gate.tick(1000)).toBeNull();
  });
});
