import { beforeEach, describe, expect, it } from "vitest";
import { resetCapabilities } from "../../lib/capabilities";
import { clearMermaid, renderMermaid } from "../../renderers/mermaid";
import { engineLoadCount } from "../../renderers/diagram/engine";

beforeEach(() => {
  resetCapabilities();
});

/** 按生产 markup 组一个图块：.mermaid-block > pre.mermaid（源码用 textContent 写入，避免 HTML 转义问题）。 */
function blockOf(source: string): HTMLElement {
  const block = document.createElement("div");
  block.className = "mermaid-block wide";
  const pre = document.createElement("pre");
  pre.className = "mermaid";
  pre.textContent = source;
  block.appendChild(pre);
  return block;
}

function containerOf(...sources: string[]): HTMLElement {
  const root = document.createElement("div");
  for (const source of sources) root.appendChild(blockOf(source));
  return root;
}

describe("图表引擎契约（Pele，8 类代表图）", () => {
  const cases: { name: string; source: string; label: string }[] = [
    {
      name: "flowchart（含 classDef/style）",
      source: [
        "flowchart TD",
        "  A[Start] --> B[End]",
        "  classDef hot fill:#f96,stroke:#333",
        "  class A hot",
        "  style B fill:#bbf",
      ].join("\n"),
      label: "Start",
    },
    {
      name: "sequenceDiagram",
      source: [
        "sequenceDiagram",
        "  Alice->>Bob: Hello",
        "  Bob-->>Alice: Hi",
      ].join("\n"),
      label: "Hello",
    },
    {
      name: "classDiagram",
      source: [
        "classDiagram",
        "  Animal <|-- Dog",
        "  class Animal {",
        "    +int age",
        "  }",
      ].join("\n"),
      label: "Animal",
    },
    {
      name: "stateDiagram-v2",
      source: ["stateDiagram-v2", "  [*] --> Idle", "  Idle --> Running"].join(
        "\n",
      ),
      label: "Running",
    },
    {
      name: "erDiagram",
      source: ["erDiagram", "  CUSTOMER ||--o{ ORDER : places"].join("\n"),
      label: "CUSTOMER",
    },
    {
      name: "gantt",
      source: [
        "gantt",
        "  title 项目计划",
        "  dateFormat YYYY-MM-DD",
        "  section 设计",
        "  任务一 :a1, 2026-01-01, 3d",
      ].join("\n"),
      label: "任务一",
    },
    {
      name: "pie",
      source: ["pie title 占比", '  "Dogs" : 386', '  "Cats" : 85'].join("\n"),
      label: "Dogs",
    },
    {
      name: "中文标签 flowchart",
      source: ["flowchart LR", "  开始 --> 结束"].join("\n"),
      label: "开始",
    },
  ];

  for (const { name, source, label } of cases) {
    it(`${name}：出 SVG、隐藏源码、文本含预期标签`, async () => {
      const el = containerOf(source);

      await renderMermaid(el);

      const view = el.querySelector<HTMLElement>(".mermaid-view");
      expect(view).not.toBeNull();
      expect(view?.querySelector("svg")).not.toBeNull();
      expect(view?.querySelector("svg")?.textContent).toContain(label);
      expect(el.querySelector<HTMLElement>("pre.mermaid")?.hidden).toBe(true);
    });
  }

  it("同文档三个图块都出图，且引擎只加载一次", async () => {
    const el = containerOf(
      "flowchart TD\n  A --> B",
      'pie title 占比\n  "Dogs" : 1',
      "flowchart LR\n  开始 --> 结束",
    );

    await renderMermaid(el);

    expect(el.querySelectorAll(".mermaid-view").length).toBe(3);
    expect(el.querySelectorAll(".mermaid-view svg").length).toBe(3);
    // 整个测试文件（8 类契约 + 多块 + 错误降级）只发起过一次引擎加载（spec D-1）
    expect(engineLoadCount()).toBe(1);
  });

  it("非法语法：不抛出，源码保持可见，同文档合法块正常出图", async () => {
    const el = containerOf(
      "flowchart TD\n  A --> (((\n  断",
      "flowchart LR\n  X[Ok] --> Y",
    );

    await expect(renderMermaid(el)).resolves.toBeUndefined();

    const pres = el.querySelectorAll<HTMLElement>("pre.mermaid");
    expect(pres[0].hidden).toBe(false);
    expect(pres[0].textContent).toContain("A --> (((");
    expect(el.querySelector(".mermaid-view .pele")).not.toBeNull();
    expect(pres[1].hidden).toBe(true);
    expect(el.querySelectorAll(".mermaid-view svg").length).toBe(1);
  });
});

describe("clearMermaid 清理语义", () => {
  it("移除视图、销毁挂载、恢复源码显示", async () => {
    const el = containerOf("flowchart TD\n  A --> B");
    await renderMermaid(el);
    expect(el.querySelector(".mermaid-view")).not.toBeNull();

    clearMermaid(el);

    expect(el.querySelector(".mermaid-view")).toBeNull();
    expect(el.querySelector<HTMLElement>("pre.mermaid")?.hidden).toBe(false);
    expect(el.textContent).toContain("flowchart TD");
  });
});
