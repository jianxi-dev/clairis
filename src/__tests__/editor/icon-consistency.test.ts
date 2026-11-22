// 块类型图标跨入口一致性 + 设计系统 §2 审计（#1348 / E-47）。
//
// 同一语义在手柄、命令映射、转换菜单、斜杠菜单、新增手柄、高亮片段六处取同一
// 图标名；表格弃 TableChartOutlined 图表语义，引用统一 FormatQuoteOutlined。
import { describe, expect, it } from "vitest";
import { blockHandleIcon } from "../../editors/orchestration/block-handle";
import { blockMenuItems } from "../../editors/orchestration/block-convert";
import {
  COMMAND_ICON_NAME,
  CONVERT_ICON_NAME,
  hasIcon,
  renderIcon,
} from "../../editors/icons";
import { CALLOUT_SNIPPETS } from "../../editors/decorations/callout-insert";
import { addHandleCommands, defaultCommands } from "../../editors/slash";

const slashIcon = (id: string): string =>
  defaultCommands.find((cmd) => cmd.id === id)?.icon ?? "";
const addIcon = (id: string): string =>
  addHandleCommands.find((cmd) => cmd.id === id)?.icon ?? "";
const calloutIcon = (id: string): string =>
  CALLOUT_SNIPPETS.find((item) => item.id === id)?.icon ?? "";
const convertIcon = (target: string): string =>
  blockMenuItems({ type: "paragraph" }).find((item) => item.target === target)
    ?.icon ?? "";

describe("块类型图标跨入口一致（#1348 / E-47）", () => {
  it("table 在手柄 / 命令 / 转换 / 斜杠 / 新增 / 高亮片段同为 TableGridOutlined", () => {
    const names = [
      blockHandleIcon("table"),
      COMMAND_ICON_NAME["insert-table"],
      COMMAND_ICON_NAME["turn-into-table"],
      slashIcon("table"),
      addIcon("table"),
      calloutIcon("table"),
    ];
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe("TableGridOutlined");
  });

  it("quote 在手柄 / 命令 / 转换 / 斜杠 / 新增 / 块菜单同为 FormatQuoteOutlined", () => {
    const names = [
      blockHandleIcon("blockquote"),
      COMMAND_ICON_NAME["insert-quote"],
      COMMAND_ICON_NAME["turn-into-quote"],
      CONVERT_ICON_NAME.quote,
      slashIcon("quote"),
      addIcon("add-quote"),
      convertIcon("quote"),
    ];
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe("FormatQuoteOutlined");
  });

  it("消费面不再出现旧图表 / 旧引用 / 旧数据表图标名", () => {
    const consumed = [
      ...Object.values(COMMAND_ICON_NAME),
      ...Object.values(CONVERT_ICON_NAME),
      ...defaultCommands.flatMap((cmd) => [
        cmd.icon,
        ...(cmd.children ?? []).map((child) => child.icon),
      ]),
      ...addHandleCommands.map((cmd) => cmd.icon),
      ...CALLOUT_SNIPPETS.map((item) => item.icon),
      blockHandleIcon("table"),
      blockHandleIcon("blockquote"),
    ];
    for (const banned of [
      "TableChartOutlined",
      "ReferenceOutlined",
      "DataSheetOutlined",
    ]) {
      expect(consumed, banned).not.toContain(banned);
    }
  });
});

describe("设计系统 §2 审计（#1348）", () => {
  it("触及条目已注册且渲染为纯 SVG", () => {
    for (const name of ["TableGridOutlined", "FormatQuoteOutlined"]) {
      expect(hasIcon(name), name).toBe(true);
      const svg = renderIcon(name);
      expect(svg.getAttribute("viewBox"), name).toBe("0 0 24 24");
      expect(svg.querySelectorAll("path").length, name).toBeGreaterThan(0);
    }
  });

  it("笔画密度 ≤6（按独立 path 计）", () => {
    for (const name of ["TableGridOutlined", "FormatQuoteOutlined"]) {
      expect(
        renderIcon(name).querySelectorAll("path").length,
        name,
      ).toBeLessThanOrEqual(6);
    }
  });

  it("渲染尺寸落 18px 常规档（ICON_SIZE_PX）", () => {
    for (const name of ["TableGridOutlined", "FormatQuoteOutlined"]) {
      expect(renderIcon(name).style.width, name).toBe("18px");
      expect(renderIcon(name).style.height, name).toBe("18px");
    }
  });

  it("段落 ¶ 与 yaml 表头图标保持区分，不混用", () => {
    const paragraph = renderIcon("TextOutlined");
    const yaml = renderIcon("HeaderRowOutlined");
    expect(paragraph.querySelector("text")?.textContent).toBe("¶");
    expect(yaml.querySelector("text")).toBeNull();
    expect(yaml.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(blockHandleIcon("yamlFrontMatter")).toBe("HeaderRowOutlined");
    expect(blockHandleIcon("paragraph")).not.toBe(
      blockHandleIcon("yamlFrontMatter"),
    );
  });
});
