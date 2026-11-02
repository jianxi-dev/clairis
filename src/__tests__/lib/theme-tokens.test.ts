import { afterEach, describe, expect, it } from "vitest";
import {
  applyThemeTokens,
  buildTokenStyle,
} from "../../lib/extensions/theme-tokens";

afterEach(() => {
  document.head.querySelector("style[data-theme-tokens]")?.remove();
});

describe("buildTokenStyle", () => {
  it("合法 token 生成 :root 声明", () => {
    expect(
      buildTokenStyle({ "--app-accent": "#c2410c", "--app-bg": "#ffffff" }),
    ).toBe(":root{--app-accent:#c2410c;--app-bg:#ffffff;}");
  });

  it("接受 rgb()/rgba()/hsl() 与 #rgb", () => {
    expect(buildTokenStyle({ "--app-x": "rgb(1, 2, 3)" })).toBe(
      ":root{--app-x:rgb(1, 2, 3);}",
    );
    expect(buildTokenStyle({ "--app-x": "#f00" })).toBe(":root{--app-x:#f00;}");
  });

  it("丢弃非 --app- 前缀的键", () => {
    expect(buildTokenStyle({ "--evil": "#fff", "--app-ok": "#000" })).toBe(
      ":root{--app-ok:#000;}",
    );
    expect(buildTokenStyle({ "app-accent": "#fff" })).toBeNull();
  });

  it("丢弃非法值（url/expression/var/长度不对的 hex/注入）", () => {
    expect(
      buildTokenStyle({ "--app-x": "url(https://e.com/a.png)" }),
    ).toBeNull();
    expect(buildTokenStyle({ "--app-x": "var(--app-bg)" })).toBeNull();
    expect(buildTokenStyle({ "--app-x": "#12" })).toBeNull();
    expect(buildTokenStyle({ "--app-x": "#12345" })).toBeNull();
    expect(buildTokenStyle({ "--app-x": "red; background:url(x)" })).toBeNull();
    expect(buildTokenStyle({ "--app-x": "" })).toBeNull();
  });

  it("全部非法时返回 null", () => {
    expect(
      buildTokenStyle({ "--app-a": "nope", "--app-b": "url(x)" }),
    ).toBeNull();
  });

  it("混合合法与非法时只保留合法项", () => {
    expect(
      buildTokenStyle({
        "--app-accent": "#c2410c",
        "--app-bad": "url(x)",
        "--nope": "#fff",
      }),
    ).toBe(":root{--app-accent:#c2410c;}");
  });
});

describe("applyThemeTokens", () => {
  it("创建唯一一个 style[data-theme-tokens]", () => {
    applyThemeTokens({ "--app-accent": "#c2410c" });
    const styles = document.head.querySelectorAll("style[data-theme-tokens]");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toBe(":root{--app-accent:#c2410c;}");
  });

  it("style 元素带 id=user-theme-tokens 且恰好一个", () => {
    applyThemeTokens({ "--app-accent": "#c2410c" });
    expect(document.querySelectorAll("#user-theme-tokens")).toHaveLength(1);
    expect(document.getElementById("user-theme-tokens")).not.toBeNull();
  });

  it("重复调用只更新内容，不追加第二个元素", () => {
    applyThemeTokens({ "--app-accent": "#c2410c" });
    applyThemeTokens({ "--app-accent": "#000000" });
    const styles = document.head.querySelectorAll("style[data-theme-tokens]");
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toBe(":root{--app-accent:#000000;}");
  });

  it("全部非法（null）时移除已存在的元素", () => {
    applyThemeTokens({ "--app-accent": "#c2410c" });
    applyThemeTokens({ "--app-accent": "url(x)" });
    expect(document.head.querySelector("style[data-theme-tokens]")).toBeNull();
  });

  it("空 token 时不创建元素", () => {
    applyThemeTokens({});
    expect(document.head.querySelector("style[data-theme-tokens]")).toBeNull();
  });
});
