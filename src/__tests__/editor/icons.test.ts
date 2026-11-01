// 图标 SSOT（移植自 md-bundle packages/editor/test/icons-ssot.test.ts，#471）。
// 命令 id → 图标名必须一一映射，且映射到的名字必须已注册。
import { describe, expect, it } from "vitest";
import {
  ACTION_ICON_NAME,
  ADD_ICON_NAME,
  COMMAND_ICON_NAME,
  CONVERT_ICON_NAME,
  HANDLE_DEFAULT_ICON,
  hasIcon,
  renderIcon,
} from "../../editors/icons";

/** 豆包 spec 里有、我们缺的 8 个。 */
const DOUBAO_MISSING = [
  "BoldOutlined",
  "ItalicOutlined",
  "UnderlineOutlined",
  "StrikethroughOutlined",
  "FontcolorOutlined",
  "DocColumnsOutlined",
  "GlobalLinkOutlined",
  "DeleteTrashOutlined",
] as const;

describe("icons SSOT (#471)", () => {
  it("补齐豆包 spec 缺的图标", () => {
    for (const name of DOUBAO_MISSING) {
      expect(hasIcon(name), name).toBe(true);
    }
  });

  it("所有格式/插入/对齐/颜色命令都映射到已注册图标", () => {
    const ids = Object.keys(COMMAND_ICON_NAME);
    expect(ids.length).toBeGreaterThanOrEqual(40);
    for (const id of ids) {
      const name = COMMAND_ICON_NAME[id];
      expect(hasIcon(name), `${id} → ${name}`).toBe(true);
    }
  });

  it("映射表覆盖工具栏默认项与常用命令", () => {
    for (const id of [
      "toggle-bold",
      "toggle-italic",
      "toggle-underline",
      "toggle-strikethrough",
      "toggle-code",
      "toggle-link",
      "color-red",
      "align-left",
      "col-2",
      "code-copy",
      "turn-into-h2",
      "insert-task-list",
      "insert-quote",
      "insert-code-block",
      "insert-callout",
      "insert-table",
    ]) {
      expect(COMMAND_ICON_NAME[id], id).toBeTruthy();
    }
  });

  it("块手柄/空行入口的图标名都已注册", () => {
    for (const name of [
      ...Object.values(CONVERT_ICON_NAME),
      ...Object.values(ACTION_ICON_NAME),
      ADD_ICON_NAME,
      HANDLE_DEFAULT_ICON,
    ]) {
      expect(hasIcon(name), name).toBe(true);
    }
  });
});

describe("renderIcon", () => {
  it("返回带 data-icon/viewBox/fill 的 svg 元素", () => {
    const svg = renderIcon("BoldOutlined");
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("data-icon")).toBe("BoldOutlined");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("标题级别图标渲染为文本字形", () => {
    const svg = renderIcon("H2Outlined");
    const text = svg.querySelector("text");
    expect(text?.textContent).toBe("H2");
  });

  it("未注册的名字回落到拖拽手柄，但 data-icon 仍是原名", () => {
    const svg = renderIcon("NoSuchIconOutlined");
    expect(svg.getAttribute("data-icon")).toBe("NoSuchIconOutlined");
    expect(svg.querySelectorAll("path").length).toBe(
      renderIcon(HANDLE_DEFAULT_ICON).querySelectorAll("path").length,
    );
  });

  it("图标不含 emoji（纯 SVG 词汇）", () => {
    const emojiRe = /\p{Extended_Pictographic}/u;
    for (const name of Object.keys(COMMAND_ICON_NAME)) {
      expect(
        emojiRe.test(renderIcon(COMMAND_ICON_NAME[name]).outerHTML),
        name,
      ).toBe(false);
    }
  });
});
