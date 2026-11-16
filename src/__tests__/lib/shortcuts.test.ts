import { describe, expect, it } from "vitest";
import {
  SHORTCUTS,
  SHORTCUT_FAMILY_LABELS,
  SHORTCUT_FAMILY_ORDER,
  activateLocalContext,
  coreShortcuts,
  isLocalShortcutActive,
  shortcutsByFamily,
} from "../../lib/shortcuts";

const CONTESTED_IDS = [
  "global-quick-open",
  "global-reading-rail",
  "global-grid",
  "global-preview-toggle",
  "global-rail-pin-hidden",
];

describe("shortcuts registry", () => {
  it("ids unique", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("global count 12 / core count 7", () => {
    expect(shortcutsByFamily("global")).toHaveLength(12);
    expect(coreShortcuts()).toHaveLength(7);
    expect(coreShortcuts().every((s) => s.family === "global")).toBe(true);
  });

  it("typeFilter has 9 entries", () => {
    expect(shortcutsByFamily("typeFilter")).toHaveLength(9);
  });

  it("no two entries share the same key chord within one scope+context", () => {
    const groups = new Map<string, Set<string>>();
    for (const shortcut of SHORTCUTS) {
      const groupKey = `${shortcut.scope ?? "global"}\u0000${shortcut.context ?? ""}`;
      const seen = groups.get(groupKey) ?? new Set<string>();
      expect(
        seen.has(shortcut.keys),
        `键位重复: ${shortcut.id} ${shortcut.keys}`,
      ).toBe(false);
      seen.add(shortcut.keys);
      groups.set(groupKey, seen);
    }
  });

  it("global family stays 12 and its entries are not local", () => {
    const globals = shortcutsByFamily("global");
    expect(globals).toHaveLength(12);
    expect(globals.every((s) => s.scope !== "local")).toBe(true);
  });

  it("local entries carry context and may share keys across contexts", () => {
    const locals = SHORTCUTS.filter((s) => s.scope === "local");
    expect(locals.length).toBeGreaterThanOrEqual(2);
    expect(locals.every((s) => Boolean(s.context))).toBe(true);

    const contextsByKey = new Map<string, Set<string>>();
    for (const s of locals) {
      const set = contextsByKey.get(s.keys) ?? new Set<string>();
      set.add(s.context!);
      contextsByKey.set(s.keys, set);
    }
    expect([...contextsByKey.values()].some((set) => set.size > 1)).toBe(true);
  });

  it("isLocalShortcutActive follows context activation", () => {
    const local = SHORTCUTS.find((s) => s.scope === "local")!;
    expect(isLocalShortcutActive(local.id, local.context!)).toBe(false);
    const deactivate = activateLocalContext(local.context!);
    expect(isLocalShortcutActive(local.id, local.context!)).toBe(true);
    expect(isLocalShortcutActive(local.id, "未激活上下文")).toBe(false);
    deactivate();
    expect(isLocalShortcutActive(local.id, local.context!)).toBe(false);
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

  it("contested keys carry decisions", () => {
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
