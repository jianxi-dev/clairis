/* 容器内部块的 DOM 渲染（表格单元格 / 分栏内容区）。
 *
 * 为什么存在
 * --------------------------------------------------------------------------
 * 正文装饰（`heading.ts` / `list.ts` / `boldItalic.ts` / `code.ts`）输出的是
 * CM6 `Decoration` 范围，只能落在**可编辑**的文档文本上。单元格与分栏的内容区
 * 是 widget 内的 DOM，CM6 装饰到不了——过去只能 `textContent` 贴源码，于是
 * `## 标题` / `- 列表` 这类块级语法在容器内退化成源码格式（A5）。
 *
 * 本模块是正文装饰的 **DOM 孪生**：不新写 markdown 解析，而是复用同一批解析
 * 助手与类名词汇（`headingRegex` / `classifyListLine` /
 * `createContentLineElement` / `renderCellText`），让容器内部与外部正文走
 * 同一套渲染语言，编辑态与预览态因此不会各自漂移（E-8 / A-5.3）。
 *
 * 复用点：
 * - 标题：`heading.ts` 的 `headingRegex` 与 `HEADING_CLASS` / `cm-hN`。
 * - 列表：`list.ts` 的 `classifyListLine` 与 `createContentLineElement`
 *   （高亮块正文早已用它，见 `callout.ts`）。
 * - 行内：`cell-text.ts` 的 `renderCellText`（与单元格显示态同一条路径，
 *   含 URL scheme 白名单与 HTML 转义）。
 */
import { HEADING_CLASS, headingRegex } from "./heading";
import { classifyListLine, createContentLineElement } from "./list";
import { computeOrderedNumbers } from "../list-number";
import { renderCellText } from "./cell-text";

/**
 * 把容器内部的一段文本渲染成块级 DOM。
 *
 * 逐行判定：标题行 → 标题元素；列表行 → 列表元素（复用高亮块正文的孪生）；
 * 其余 → 普通行。每行的行内 markdown 都交给 `renderCellText`，与单元格显示态
 * 完全一致。空文本返回空容器（调用方据此保留 `:empty` 占位）。
 */
export function renderBlockDom(text: string): HTMLElement {
  const container = document.createElement("div");
  if (text === "") return container;
  const lines = text.split("\n");
  const orderedNumbers = new Map(
    computeOrderedNumbers(lines).map((entry) => [entry.line, entry.number]),
  );
  for (let index = 0; index < lines.length; index += 1) {
    container.appendChild(
      renderBlockLine(lines[index], orderedNumbers.get(index + 1)),
    );
  }
  return container;
}

/** 一行源码 → 一个块级元素。 */
function renderBlockLine(line: string, orderedNumber?: number): HTMLElement {
  // headingRegex 是 /gm 全局正则，复用前重置 lastIndex（与 heading.ts 同）。
  headingRegex.lastIndex = 0;
  const heading = headingRegex.exec(line);
  if (heading) {
    const level = heading[1].length;
    const el = document.createElement("div");
    el.className = `${HEADING_CLASS} cm-h${level}`;
    el.innerHTML = renderCellText(heading[2]);
    return el;
  }

  if (classifyListLine(line).kind !== "plain") {
    return renderListLine(line, orderedNumber);
  }

  const el = document.createElement("div");
  el.className = "cm-line";
  el.innerHTML = renderCellText(line);
  return el;
}

/**
 * 列表行：复用 `createContentLineElement` 的结构（项目符号 / 有序序号 / 任务
 * 复选框），再把尾部的原始文本节点换成行内渲染，使 `- **粗**` 里的 `**` 不残留。
 */
function renderListLine(line: string, orderedNumber?: number): HTMLElement {
  const el = createContentLineElement(line, orderedNumber);
  const last = el.lastChild;
  if (last && last.nodeType === Node.TEXT_NODE) {
    const raw = last.textContent ?? "";
    if (raw.trim() !== "") {
      const body = document.createElement("span");
      body.innerHTML = renderCellText(raw);
      el.replaceChild(body, last);
    }
  }
  return el;
}
