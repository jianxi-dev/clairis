// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tokensCss = readFileSync(
  fileURLToPath(new URL("../../styles/tokens.css", import.meta.url)),
  "utf8",
);

const SHADOW_KEYS = [
  "--shadow-menu",
  "--shadow-panel",
  "--shadow-dialog",
  "--shadow-card",
  "--shadow-button",
] as const;

function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tokensCss.match(
    new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([\\s\\S]*?)\\}`),
  );
  if (!match) throw new Error(`未找到 ${selector} 块`);
  return match[1];
}

function shadowTokens(selector: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const m of block(selector).matchAll(
    /(--shadow-[a-z-]+)\s*:\s*([^;]+);/g,
  )) {
    tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

function alphas(value: string): number[] {
  const out: number[] = [];
  for (const m of value.matchAll(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/g)) {
    out.push(Number(m[1]));
  }
  return out;
}

describe("三主题 --shadow-* token（editor-batch3-lowcost D3 / R-1）", () => {
  const light = shadowTokens(":root");
  const dark = shadowTokens(".dark");
  const warm = shadowTokens(".warm");

  it("三主题暴露同一组 5 个 --shadow-* 键", () => {
    const expected = [...SHADOW_KEYS].sort();
    for (const [name, tokens] of [
      ["root", light],
      ["dark", dark],
      ["warm", warm],
    ] as const) {
      expect([...tokens.keys()].sort(), name).toEqual(expected);
    }
  });

  it(".dark 每个 --shadow-* 的 alpha 均 ≤ 0.6", () => {
    for (const [key, value] of dark) {
      const values = alphas(value);
      expect(values.length, key).toBeGreaterThan(0);
      for (const alpha of values) {
        expect(alpha, `${key} alpha ${alpha}`).toBeLessThanOrEqual(0.6);
      }
    }
  });
});
