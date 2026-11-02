import { afterEach, describe, expect, it } from "vitest";
import {
  applyThemeTokens,
  buildTokenStyle,
  compileTokenStyle,
  normalizeTokenKey,
} from "../../lib/extensions/theme-tokens";

afterEach(() => {
  document.head.querySelector("style[data-theme-tokens]")?.remove();
});

describe("normalizeTokenKey", () => {
  it("裸名与 --app- 前缀两种写法都规范成 --app-<name>", () => {
    expect(normalizeTokenKey("accent")).toBe("--app-accent");
    expect(normalizeTokenKey("--app-accent")).toBe("--app-accent");
    expect(normalizeTokenKey("text-2")).toBe("--app-text-2");
  });

  it("未声明的名字一律拒绝（即使带 --app- 前缀）", () => {
    expect(normalizeTokenKey("--app-not-real")).toBeNull();
    expect(normalizeTokenKey("not-real")).toBeNull();
    expect(normalizeTokenKey("--evil")).toBeNull();
    expect(normalizeTokenKey("--app-")).toBeNull();
  });

  it("拒绝大写与非法字符", () => {
    expect(normalizeTokenKey("Accent")).toBeNull();
    expect(normalizeTokenKey("accent;")).toBeNull();
    expect(normalizeTokenKey("--app-accent:red")).toBeNull();
  });
});

describe("buildTokenStyle", () => {
  it("合法 token 生成 :root 声明", () => {
    expect(buildTokenStyle({ accent: "#c2410c", bg: "#ffffff" })).toBe(
      ":root{--app-accent:#c2410c;--app-bg:#ffffff;}",
    );
  });

  it("带前缀写法与裸名等价", () => {
    expect(buildTokenStyle({ "--app-accent": "#c2410c" })).toBe(
      buildTokenStyle({ accent: "#c2410c" }),
    );
  });

  it("接受 rgb()/rgba()/hsl()、#rgb 与具名色", () => {
    expect(buildTokenStyle({ accent: "rgb(1, 2, 3)" })).toBe(
      ":root{--app-accent:rgb(1, 2, 3);}",
    );
    expect(buildTokenStyle({ accent: "#f00" })).toBe(
      ":root{--app-accent:#f00;}",
    );
    expect(buildTokenStyle({ accent: "rebeccapurple" })).toBe(
      ":root{--app-accent:rebeccapurple;}",
    );
  });

  it("丢弃未声明的键（含 --app- 前缀的臆造名）", () => {
    expect(
      buildTokenStyle({ "--evil": "#fff", "--app-not-real": "#fff" }),
    ).toBeNull();
    expect(buildTokenStyle({ "--app-accent": "#000", bogus: "#fff" })).toBe(
      ":root{--app-accent:#000;}",
    );
  });

  it("丢弃非法值（url/expression/var/长度不对的 hex/注入）", () => {
    expect(buildTokenStyle({ accent: "url(https://e.com/a.png)" })).toBeNull();
    expect(buildTokenStyle({ accent: "var(--app-bg)" })).toBeNull();
    expect(buildTokenStyle({ accent: "#12" })).toBeNull();
    expect(buildTokenStyle({ accent: "#12345" })).toBeNull();
    expect(buildTokenStyle({ accent: "red; background:url(x)" })).toBeNull();
    expect(buildTokenStyle({ accent: "" })).toBeNull();
  });

  it("全部非法时返回 null", () => {
    expect(buildTokenStyle({ accent: "nope!", bg: "url(x)" })).toBeNull();
  });

  it("混合合法与非法时只保留合法项", () => {
    expect(
      buildTokenStyle({
        accent: "#c2410c",
        "--app-bad": "url(x)",
        "--nope": "#fff",
      }),
    ).toBe(":root{--app-accent:#c2410c;}");
  });

  it("radius/shadow 是已声明但非颜色值，按值白名单拒绝", () => {
    expect(buildTokenStyle({ radius: "8px" })).toBeNull();
  });

  it("两种写法指向同一 token 时后者覆盖前者", () => {
    expect(
      buildTokenStyle({ accent: "#111111", "--app-accent": "#222222" }),
    ).toBe(":root{--app-accent:#222222;}");
  });
});

describe("compileTokenStyle", () => {
  it("返回 css 与被丢弃的键，供聚合告警", () => {
    expect(
      compileTokenStyle({ accent: "#c2410c", "--app-nope": "#fff" }),
    ).toEqual({
      css: ":root{--app-accent:#c2410c;}",
      rejected: ["--app-nope"],
    });
  });

  it("全部非法时 css 为 null 且 rejected 完整", () => {
    expect(compileTokenStyle({ nope: "#fff", accent: "url(x)" })).toEqual({
      css: null,
      rejected: ["nope", "accent"],
    });
  });
});

describe("applyThemeTokens", () => {
  it("创建唯一一个 style[data-theme-tokens]", () => {
    applyThemeTokens({ accent: "#c2410c" });
    const styles = document.head.querySelectorAll("style[data-theme-tokens]");
    expect(styles).toHaveLength(1);
    expect(styles[0].id).toBe("user-theme-tokens");
    expect(styles[0].textContent).toBe(":root{--app-accent:#c2410c;}");
  });

  it("重复调用只更新内容，不追加第二个元素", () => {
    applyThemeTokens({ accent: "#c2410c" });
    applyThemeTokens({ accent: "#000000" });
    const styles = document.head.querySelectorAll("style[data-theme-tokens]");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toBe(":root{--app-accent:#000000;}");
  });

  it("全部非法（null）时移除已存在的元素", () => {
    applyThemeTokens({ accent: "#c2410c" });
    applyThemeTokens({ accent: "url(x)" });
    expect(document.head.querySelector("style[data-theme-tokens]")).toBeNull();
  });

  it("空 token 时不创建元素", () => {
    applyThemeTokens({});
    expect(document.head.querySelector("style[data-theme-tokens]")).toBeNull();
  });
});
