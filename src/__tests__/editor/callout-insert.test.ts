/**
 * 高亮块内插入菜单测试（移植自 md-bundle `src/decorations/callout-insert.ts`，无独立上游测试）。
 *
 * 高亮块正文是 textarea，编辑器的斜杠菜单到不了；本菜单在卡片内提供同款命令词表。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachCalloutInsertMenu } from "../../editors/decorations/callout-insert";

function buildHost(): { card: HTMLElement; editor: HTMLTextAreaElement } {
  const card = document.createElement("div");
  card.className = "cm-callout";
  const header = document.createElement("div");
  header.className = "cm-callout-header";
  card.appendChild(header);
  const editor = document.createElement("textarea");
  editor.className = "cm-callout-editor";
  card.appendChild(editor);
  document.body.appendChild(card);
  return { card, editor };
}

function press(editor: HTMLTextAreaElement, key: string): void {
  editor.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
}

describe("高亮块内插入菜单", () => {
  let card: HTMLElement;
  let editor: HTMLTextAreaElement;

  beforeEach(() => {
    ({ card, editor } = buildHost());
  });

  afterEach(() => {
    card.remove();
  });

  it("`/` 打开菜单并列出命令", () => {
    editor.value = "";
    editor.setSelectionRange(0, 0);
    const dispose = attachCalloutInsertMenu({ editor, card });
    press(editor, "/");

    const menu = card.querySelector('[data-testid="cm-callout-insert-menu"]');
    expect(menu).not.toBeNull();
    expect(
      menu?.querySelectorAll(".cm-callout-insert-item").length,
    ).toBeGreaterThan(0);
    dispose();
  });

  it("选择片段插到光标处", () => {
    editor.value = "";
    editor.setSelectionRange(0, 0);
    const dispose = attachCalloutInsertMenu({ editor, card });
    press(editor, "/");
    // 输入 query 触发菜单过滤。
    editor.value = "/hea";
    editor.setSelectionRange(4, 4);
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    const item = card.querySelector<HTMLButtonElement>(
      '.cm-callout-insert-item[data-insert-id="heading"]',
    );
    expect(item).not.toBeNull();
    item?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );

    expect(editor.value).toBe("## ");
    expect(
      card.querySelector('[data-testid="cm-callout-insert-menu"]'),
    ).toBeNull();
    dispose();
  });

  it("Escape 关闭菜单", () => {
    editor.value = "";
    editor.setSelectionRange(0, 0);
    const dispose = attachCalloutInsertMenu({ editor, card });
    press(editor, "/");
    expect(
      card.querySelector('[data-testid="cm-callout-insert-menu"]'),
    ).not.toBeNull();

    press(editor, "Escape");
    expect(
      card.querySelector('[data-testid="cm-callout-insert-menu"]'),
    ).toBeNull();
    dispose();
  });

  it("无匹配项时显示空态", () => {
    editor.value = "";
    editor.setSelectionRange(0, 0);
    const dispose = attachCalloutInsertMenu({ editor, card });
    press(editor, "/");
    editor.value = "/zzz";
    editor.setSelectionRange(4, 4);
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    expect(card.querySelector(".cm-callout-insert-empty")).not.toBeNull();
    dispose();
  });
});
