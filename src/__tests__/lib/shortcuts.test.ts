import { describe, expect, it } from "vitest";
import {
  SHORTCUTS,
  SHORTCUT_FAMILY_LABELS,
  SHORTCUT_FAMILY_ORDER,
  coreShortcuts,
  shortcutsByFamily,
} from "../../lib/shortcuts";

const CONTESTED_IDS = [
  "global-quick-open",
  "global-reading-rail",
  "global-grid",
  "global-preview-toggle",
];

describe("shortcuts registry", () => {
  it("ids unique", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("global count 9 / core count 7", () => {
    expect(shortcutsByFamily("global")).toHaveLength(9);
    expect(coreShortcuts()).toHaveLength(7);
    expect(coreShortcuts().every((s) => s.family === "global")).toBe(true);
  });

  it("typeFilter has 9 entries", () => {
    expect(shortcutsByFamily("typeFilter")).toHaveLength(9);
  });

  it("every entry has family / label / keys and is implemented", () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.id).toBeTruthy();
      expect(shortcut.keys).toBeTruthy();
      expect(shortcut.label).toBeTruthy();
      expect(SHORTCUT_FAMILY_LABELS[shortcut.family]).toBeTruthy();
      expect(shortcut.implemented).toBe(true);
    }
  });

  it("no key uses all three of ⌘ / ⌥ / ⇧", () => {
    for (const shortcut of SHORTCUTS) {
      const three =
        shortcut.keys.includes("⌘") &&
        shortcut.keys.includes("⌥") &&
        shortcut.keys.includes("⇧");
      expect(three, `${shortcut.id}: ${shortcut.keys}`).toBe(false);
    }
  });

  it("the four contested keys carry decisions", () => {
    const withDecision = SHORTCUTS.filter((s) => s.decision);
    expect(withDecision.map((s) => s.id).sort()).toEqual(
      [...CONTESTED_IDS].sort(),
    );
  });

  it("family order covers every family present in the registry", () => {
    const families = new Set(SHORTCUTS.map((s) => s.family));
    for (const family of SHORTCUT_FAMILY_ORDER) {
      expect(families.has(family)).toBe(true);
    }
  });
});
