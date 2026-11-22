import { describe, it, expect } from "vitest";
import { Compartment, EditorState } from "@codemirror/state";
import { keymap, type KeyBinding } from "@codemirror/view";
import { indentLess, indentMore, redo, undo } from "@codemirror/commands";
import {
  createEditorSetup,
  createExtensions,
  decorCompartment,
  fullDecorations,
} from "../../editors/setup";

describe("editor setup", () => {
  describe("decorCompartment", () => {
    it("is a Compartment instance", () => {
      expect(decorCompartment).toBeInstanceOf(Compartment);
    });
  });

  describe("fullDecorations", () => {
    it("returns an array of extensions", () => {
      const deps = fullDecorations();
      expect(Array.isArray(deps)).toBe(true);
    });
  });

  describe("createEditorSetup", () => {
    it("returns an array of extensions", () => {
      const setup = createEditorSetup();
      expect(Array.isArray(setup)).toBe(true);
      expect(setup.length).toBeGreaterThan(0);
    });

    it("includes basic setup and markdown language extensions", () => {
      const setup = createEditorSetup();
      // Should include extensions for basic editing and markdown
      expect(setup.some((ext) => ext !== null && ext !== undefined)).toBe(true);
    });
  });

  describe("键位表（E-41 / D4）", () => {
    // 装配真实编辑态扩展集，从 CM6 的 keymap facet 读回扁平绑定表。
    const bindings = (() => {
      const state = EditorState.create({
        extensions: createExtensions("markdown"),
      });
      return state
        .facet(keymap)
        .reduce<KeyBinding[]>((acc, group) => acc.concat(group), []);
    })();

    it("Mod-[ / Mod-] 不再绑定 undo / redo", () => {
      expect(
        bindings.filter((b) => b.key === "Mod-[" && b.run === undo),
      ).toHaveLength(0);
      expect(
        bindings.filter((b) => b.key === "Mod-]" && b.run === redo),
      ).toHaveLength(0);
    });

    it("Mod-[ / Mod-] 由 defaultKeymap 提供 indentLess / indentMore", () => {
      expect(
        bindings.some((b) => b.key === "Mod-[" && b.run === indentLess),
      ).toBe(true);
      expect(
        bindings.some((b) => b.key === "Mod-]" && b.run === indentMore),
      ).toBe(true);
    });

    it("撤销 / 重做主键位不受纠偏影响", () => {
      expect(bindings.some((b) => b.key === "Mod-z" && b.run === undo)).toBe(
        true,
      );
      expect(bindings.some((b) => b.key === "Ctrl-z" && b.run === undo)).toBe(
        true,
      );
      expect(
        bindings.some((b) => b.key === "Ctrl-Shift-z" && b.run === redo),
      ).toBe(true);
      // macOS 上重做是 Mod-Shift-z（historyKeymap 的 mac 变体）。
      expect(
        bindings.some(
          (b) => b.key === "Mod-y" && b.mac === "Mod-Shift-z" && b.run === redo,
        ),
      ).toBe(true);
    });
  });
});
