import { describe, it, expect } from "vitest";
import {
  unorderedListRegex,
  orderedListRegex,
  taskListRegex,
  LIST_CLASS,
  LIST_ORDERED_CLASS,
  LIST_MARKER_CLASS,
  LIST_MARKER_ACTIVE_CLASS,
  TASK_DONE_CLASS,
  TASK_PENDING_CLASS,
  TASK_CHECKBOX_CLASS,
  BLOCK_ACTIVE_CLASS,
  BLOCK_INACTIVE_CLASS,
  classifyListLine,
  createListDecorations,
} from "../../../editors/decorations/list";

describe("list decoration", () => {
  describe("unorderedListRegex", () => {
    it("matches - items", () => {
      unorderedListRegex.lastIndex = 0;
      expect(unorderedListRegex.test("- item")).toBe(true);
    });

    it("matches * items", () => {
      unorderedListRegex.lastIndex = 0;
      expect(unorderedListRegex.test("* item")).toBe(true);
    });

    it("matches + items", () => {
      unorderedListRegex.lastIndex = 0;
      expect(unorderedListRegex.test("+ item")).toBe(true);
    });

    it("does not match plain text", () => {
      unorderedListRegex.lastIndex = 0;
      expect(unorderedListRegex.test("plain text")).toBe(false);
    });
  });

  describe("orderedListRegex", () => {
    it("matches 1. items", () => {
      orderedListRegex.lastIndex = 0;
      const m = orderedListRegex.exec("1. item");
      expect(m).not.toBeNull();
    });

    it("matches 123. items", () => {
      orderedListRegex.lastIndex = 0;
      expect(orderedListRegex.test("123. item")).toBe(true);
    });

    it("does not match text with dot but no number", () => {
      orderedListRegex.lastIndex = 0;
      expect(orderedListRegex.test(". item")).toBe(false);
    });
  });

  describe("taskListRegex", () => {
    it("matches - [ ] pending", () => {
      taskListRegex.lastIndex = 0;
      expect(taskListRegex.test("- [ ] task")).toBe(true);
    });

    it("matches - [x] done", () => {
      taskListRegex.lastIndex = 0;
      expect(taskListRegex.test("- [x] task")).toBe(true);
    });

    it("matches - [X] done uppercase", () => {
      taskListRegex.lastIndex = 0;
      expect(taskListRegex.test("- [X] task")).toBe(true);
    });

    it("does not match plain list item", () => {
      taskListRegex.lastIndex = 0;
      expect(taskListRegex.test("- plain item")).toBe(false);
    });
  });

  describe("CSS classes", () => {
    it("LIST_CLASS is defined", () => {
      expect(LIST_CLASS).toBeDefined();
    });

    it("TASK_DONE_CLASS is defined", () => {
      expect(TASK_DONE_CLASS).toBeDefined();
    });

    it("TASK_PENDING_CLASS is defined", () => {
      expect(TASK_PENDING_CLASS).toBeDefined();
    });
  });

  describe("createListDecorations", () => {
    it("returns decorations for list items (replace marker + line style)", () => {
      const result = createListDecorations("- item\n");
      // 2: replace "- " + line class
      expect(result.length).toBe(2);
    });

    it("replaces the list marker (hides - )", () => {
      const result = createListDecorations("- item\n");
      // First: replace covering "- " (2 chars)
      expect(result[0].from).toBe(0);
      expect(result[0].to).toBe(2);
    });

    it("applies line class after replacing marker", () => {
      const result = createListDecorations("- item\n");
      // Second: line decoration with LIST_CLASS
      expect(result[1].value.spec.class).toContain(LIST_CLASS);
    });

    it("handles task items with done/pending class", () => {
      const done = createListDecorations("- [x] done\n");
      expect(done.length).toBe(2);
      expect(done[1].value.spec.class).toContain(TASK_DONE_CLASS);
    });

    it("returns empty for plain text", () => {
      const result = createListDecorations("plain text");
      expect(result).toHaveLength(0);
    });
  });

  describe("classifyListLine", () => {
    it("classifies a quoted list item past the `> ` prefix (#382)", () => {
      const info = classifyListLine("> - item");
      expect(info.kind).toBe("unordered");
      expect(info.prefixLen).toBe(2);
      expect(info.markerLen).toBe(2);
    });

    it("classifies a quoted task item", () => {
      const info = classifyListLine("> - [x] done");
      expect(info.kind).toBe("task");
      expect(info.checked).toBe(true);
    });

    it("classifies plain text", () => {
      expect(classifyListLine("plain").kind).toBe("plain");
    });
  });

  describe("two-state (active / inactive)", () => {
    it("marks lines inactive when there is no active block", () => {
      const result = createListDecorations("- item");
      const line = result.find((d) => d.value.spec.class?.includes(LIST_CLASS));
      expect(line?.value.spec.class).toContain(BLOCK_INACTIVE_CLASS);
    });

    it("marks lines active when the active block covers the line", () => {
      const result = createListDecorations("- item", 0, 6);
      const line = result.find((d) => d.value.spec.class?.includes(LIST_CLASS));
      expect(line?.value.spec.class).toContain(BLOCK_ACTIVE_CLASS);
    });

    it("keeps the unordered `- ` marker hidden in the active block (#235)", () => {
      const result = createListDecorations("- item", 0, 6);
      const replace = result.find(
        (d) => !d.value.spec.class && !d.value.spec.widget,
      );
      expect(replace).toBeDefined();
      expect(replace!.from).toBe(0);
      expect(replace!.to).toBe(2);
    });

    it("renders the ordered marker as a mark, never replaced", () => {
      const result = createListDecorations("1. first", 0, 8);
      const marker = result.find((d) =>
        d.value.spec.class?.includes(LIST_MARKER_CLASS),
      );
      expect(marker).toBeDefined();
      expect(marker!.from).toBe(0);
      expect(marker!.to).toBe(3);
      expect(marker!.value.spec.class).toContain(LIST_MARKER_ACTIVE_CLASS);
    });

    it("keeps the ordered marker plain when inactive", () => {
      const result = createListDecorations("1. first");
      const marker = result.find((d) =>
        d.value.spec.class?.includes(LIST_MARKER_CLASS),
      );
      expect(marker?.value.spec.class).not.toContain(LIST_MARKER_ACTIVE_CLASS);
    });

    it("applies cm-list-ordered to ordered lines only (#176)", () => {
      const ordered = createListDecorations("1. first\n2. second");
      expect(
        ordered.filter((d) => d.value.spec.class?.includes(LIST_ORDERED_CLASS)),
      ).toHaveLength(2);
      const unordered = createListDecorations("- one\n- two");
      expect(
        unordered.filter((d) =>
          d.value.spec.class?.includes(LIST_ORDERED_CLASS),
        ),
      ).toHaveLength(0);
    });

    it("replaces the task marker with a checkbox widget", () => {
      const result = createListDecorations("- [x] done");
      const widget = result.find((d) => d.value.spec.widget);
      expect(widget).toBeDefined();
      expect(widget!.from).toBe(0);
      expect(widget!.to).toBe(6);
      expect(widget!.value.spec.widget.checked).toBe(true);
      expect(widget!.value.spec.widget.bracketFrom).toBe(2);
      expect(TASK_CHECKBOX_CLASS).toBe("cm-task-checkbox");
    });
  });
});
