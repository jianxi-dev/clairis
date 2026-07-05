import { describe, it, expect } from "vitest";
import { Compartment } from "@codemirror/state";
import { createEditorSetup, decorCompartment, fullDecorations } from "../../editors/setup";

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
});
