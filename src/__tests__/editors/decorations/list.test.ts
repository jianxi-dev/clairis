import { describe, it, expect } from "vitest";
import {
  unorderedListRegex,
  orderedListRegex,
  taskListRegex,
  LIST_CLASS,
  TASK_DONE_CLASS,
  TASK_PENDING_CLASS,
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
});
