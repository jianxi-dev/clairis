import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { SUPPORTED_SURFACES } from "../../lib/dataSurfaces/loader";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUST_SURFACES = resolve(
  HERE,
  "../../../src-tauri/src/surfaces.rs",
);

function rustTableIds(): string[] {
  const source = readFileSync(RUST_SURFACES, "utf8");
  const block = source.match(/^pub static SURFACES:[^=]*=\s*&\[([\s\S]*?)\n\}\];/m);
  expect(block, "应在 surfaces.rs 找到 SURFACES 登记表块").not.toBeNull();
  const ids = [...block![1].matchAll(/^\s*id:\s*"([^"]+)"/gm)].map((m) => m[1]);
  expect(ids.length, "SURFACES 表块内应解析出至少一个 id").toBeGreaterThan(0);
  return ids;
}

describe("Rust 面登记表 ↔ 前端面清单对账", () => {
  it("id 集合逐值一致", () => {
    expect([...SUPPORTED_SURFACES].sort()).toEqual(rustTableIds().sort());
  });
});
