import { describe, it, expect } from "vitest";
import { PROVIDERS, type ProviderPreset } from "../lib/providers";

const EXPECTED_IDS = [
  "deepseek",
  "qwen",
  "kimi",
  "glm",
  "workbuddy",
  "opencode",
  "pi",
  "custom",
];

describe("provider presets", () => {
  it("contains exactly the eight supported providers", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(EXPECTED_IDS);
  });

  it("every preset has id, label, endpoint and defaultModel", () => {
    for (const preset of PROVIDERS as ProviderPreset[]) {
      expect(preset.id, preset.label).toBeTruthy();
      expect(preset.label, preset.id).toBeTruthy();
      expect(typeof preset.endpoint, preset.id).toBe("string");
      expect(typeof preset.defaultModel, preset.id).toBe("string");
    }
  });

  it("verified presets ship a usable endpoint", () => {
    const verified = ["deepseek", "qwen", "kimi", "glm", "opencode"];
    for (const preset of PROVIDERS.filter((p) => verified.includes(p.id))) {
      expect(preset.endpoint, preset.id).toMatch(/^https:\/\//);
      expect(preset.defaultModel, preset.id).not.toBe("");
    }
  });

  it("providers without a public OpenAI-compatible endpoint stay blank", () => {
    for (const id of ["workbuddy", "pi", "custom"]) {
      const preset = PROVIDERS.find((p) => p.id === id);
      expect(preset?.endpoint, id).toBe("");
      expect(preset?.defaultModel, id).toBe("");
    }
  });

  it("custom preset leaves endpoint and model to the user", () => {
    const custom = PROVIDERS.find((p) => p.id === "custom");
    expect(custom?.endpoint).toBe("");
    expect(custom?.defaultModel).toBe("");
  });
});
