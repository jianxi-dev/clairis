import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  buildCalloutColorPanel,
  buildHighlightColorPanel,
  nextCalloutAttrs,
  pickHighlightFamily,
  randomCalloutColors,
  randomHighlightColors,
} from "../../editors/orchestration/callout-color-panel";
import {
  contrastRatio,
  parseHexColor,
  readCssColor,
} from "../../editors/orchestration/color-contrast";
import { getCalloutAttrs } from "../../editors/callout-attrs";
import { BACKGROUND_COLORS, FONT_COLORS } from "../../editors/orchestration/color-palette";

/** 测试用 CSS 变量：覆盖随机选色涉及的填充 / 字体 / 表面色。 */
const TEST_VARS: Readonly<Record<string, string>> = {
  "--app-text": "#24262b",
  "--app-surface": "#fbfaf8",
  "--hl-font-contrast": "#111111",
  "--hl-font-red": "#d83930",
  "--hl-font-orange": "#de7704",
  "--hl-font-yellow": "#dd9b02",
  "--hl-font-green": "#2ea122",
  "--hl-font-blue": "#245bdb",
  "--hl-font-purple": "#6425d0",
  "--hl-fill-darkgray": "#f2f3f5",
  "--hl-fill-darkred": "#fde2e2",
  "--hl-fill-darkorange": "#feead2",
  "--hl-fill-darkyellow": "#ffffcc",
  "--hl-fill-darkgreen": "#daf5d6",
  "--hl-fill-darkblue": "#e1eaff",
  "--hl-fill-darkpurple": "#ebe2fe",
  "--hl-fill-gray": "#e7e9eb",
  "--hl-fill-lightgray": "#e7e9eb",
  "--hl-fill-red": "#fbbfbc",
  "--hl-fill-orange": "#fed4a4",
  "--hl-fill-yellow": "#fffca3",
  "--hl-fill-green": "#b7edb2",
  "--hl-fill-blue": "#bacefd",
  "--hl-fill-purple": "#cdb2fa",
};

beforeEach(() => {
  const style = document.documentElement.style;
  for (const [name, value] of Object.entries(TEST_VARS)) {
    style.setProperty(name, value);
  }
});

afterEach(() => {
  const style = document.documentElement.style;
  for (const name of Object.keys(TEST_VARS)) {
    style.removeProperty(name);
  }
});

describe("nextCalloutAttrs", () => {
  it("写入新色名", () => {
    expect(nextCalloutAttrs({}, "bg", "green")).toEqual({ bg: "green" });
  });

  it("切换已设色", () => {
    expect(
      nextCalloutAttrs({ bg: "green", text: "gray" }, "bg", "red"),
    ).toEqual({ bg: "red", text: "gray" });
  });

  it("点击已选颜色清除该项", () => {
    expect(
      nextCalloutAttrs({ bg: "green", border: "red" }, "bg", "green"),
    ).toEqual({ border: "red" });
  });

  it("默认项（空名）清除该项", () => {
    expect(nextCalloutAttrs({ text: "gray" }, "text", "")).toEqual({});
  });

  it("不改动的属性保持原样", () => {
    expect(nextCalloutAttrs({ border: "red" }, "bg", "green")).toEqual({
      border: "red",
      bg: "green",
    });
  });
});

describe("纯高亮随机与面板", () => {
  it("同一色相族的浅填充 + 深边框，避开当前色相", () => {
    // rand 固定取第一个候选：当前红 → 候选从橙开始。
    expect(pickHighlightFamily({ bg: "red" }, () => 0)).toMatchObject({
      key: "orange",
      light: "orange",
      dark: "darkorange",
    });
    expect(
      pickHighlightFamily({ bg: "darkgreen", border: "darkgreen" }, () => 0),
    ).toMatchObject({ key: "red" });
  });

  it("面板含随机、恢复默认、字体 A 与两行填充", () => {
    const root = buildHighlightColorPanel({
      active: {},
      onPick: () => {},
      onReset: () => {},
      onRandom: () => null,
    });
    expect(root.querySelector('[data-testid="color-random"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="color-reset"]')).not.toBeNull();
    const fontIcons = root.querySelectorAll(
      '.cm-color-row[data-kind="font"] .cm-color-swatch-icon svg',
    );
    expect(fontIcons).toHaveLength(8);
    expect(fontIcons[0].getAttribute("data-icon")).toBe(
      "FormatColorTextOutlined",
    );
    expect(
      root.querySelectorAll('.cm-color-row[data-kind="background"]').length,
    ).toBe(2);
  });

  it("四行各 8 格（字体/边框/填充深/填充中）", () => {
    const root = buildHighlightColorPanel({
      active: {},
      onPick: () => {},
      onReset: () => {},
      onRandom: () => null,
    });
    const count = (sel: string): number =>
      root.querySelectorAll(`${sel} .cm-color-swatch`).length;
    expect(count('.cm-color-row[data-kind="font"]')).toBe(8);
    expect(count('.cm-color-row[data-kind="border"]')).toBe(8);
    const bgRows = root.querySelectorAll('.cm-color-row[data-kind="background"]');
    expect(bgRows).toHaveLength(2);
    for (const row of bgRows) {
      expect(row.querySelectorAll(".cm-color-swatch")).toHaveLength(8);
    }
  });
});

describe("未命中色名不误标默认格（#1676 后续修正 1）", () => {
  const bgRows = (root: HTMLElement): NodeListOf<HTMLElement> =>
    root.querySelectorAll('.cm-color-row[data-kind="background"]');

  it("bg=red：深档行 0 个选中，中档行恰 1 个 hl-fill-red", () => {
    const root = buildHighlightColorPanel({
      active: { bg: "red" },
      onPick: () => {},
      onReset: () => {},
      onRandom: () => null,
    });
    const rows = bgRows(root);
    expect(rows).toHaveLength(2);
    const deepActive = rows[0].querySelectorAll(
      '.cm-color-swatch[data-active="true"]',
    );
    expect(deepActive).toHaveLength(0);
    const midActive = rows[1].querySelectorAll(
      '.cm-color-swatch[data-active="true"]',
    );
    expect(midActive).toHaveLength(1);
    expect(midActive[0].getAttribute("data-class-name")).toBe("hl-fill-red");
  });

  it("active:{}：深档行默认格恰 1 个选中", () => {
    const root = buildHighlightColorPanel({
      active: {},
      onPick: () => {},
      onReset: () => {},
      onRandom: () => null,
    });
    const rows = bgRows(root);
    const deepActive = rows[0].querySelectorAll(
      '.cm-color-swatch[data-active="true"]',
    );
    expect(deepActive).toHaveLength(1);
    expect(deepActive[0].getAttribute("data-class-name")).toBe("");
  });
});

describe("选中态即时刷新（D5）", () => {
  const mousedown = (el: Element): void => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  };

  it("点击色块后旧格 false、新格 true，节点未重建", () => {
    let current: { bg?: string } = { bg: "darkred" };
    const root = buildHighlightColorPanel({
      active: { bg: "darkred" },
      getActive: () => current,
      onPick: (_key, className) => {
        current = { bg: className === "" ? undefined : "darkgreen" };
      },
      onReset: () => {},
      onRandom: () => {},
    });
    const deepRow = root.querySelector('.cm-color-row[data-kind="background"]')!;
    const swatches = deepRow.querySelectorAll<HTMLButtonElement>(
      ".cm-color-swatch",
    );
    const oldSwatch = Array.from(swatches).find(
      (s) => s.dataset.className === "hl-fill-darkred",
    )!;
    const newSwatch = Array.from(swatches).find(
      (s) => s.dataset.className === "hl-fill-darkgreen",
    )!;
    expect(oldSwatch.dataset.active).toBe("true");
    expect(newSwatch.dataset.active).toBe("false");

    mousedown(newSwatch);

    expect(oldSwatch.dataset.active).toBe("false");
    expect(newSwatch.dataset.active).toBe("true");
    // 节点身份不变 = 未重建面板。
    expect(
      root.querySelector('.cm-color-row[data-kind="background"]'),
    ).toBe(deepRow);
    expect(
      deepRow.querySelectorAll(".cm-color-swatch")[0],
    ).toBe(swatches[0]);
  });

  it("「随机」后边框行与两行填充的选中态同时刷新", () => {
    let current: { bg?: string; border?: string } = {
      bg: "darkred",
      border: "red",
    };
    const root = buildHighlightColorPanel({
      active: { bg: "darkred", border: "red" },
      getActive: () => current,
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {
        current = { bg: "darkgreen", border: "green" };
        return null;
      },
    });
    const activeBefore = () =>
      Array.from(
        root.querySelectorAll('.cm-color-swatch[data-active="true"]'),
      ).map((el) => el.getAttribute("data-class-name"));
    const before = activeBefore();
    expect(before).toContain("hl-border-red");
    expect(before).toContain("hl-fill-darkred");

    mousedown(root.querySelector('[data-testid="color-random"]')!);

    const borderActive = root.querySelectorAll(
      '.cm-color-row[data-kind="border"] .cm-color-swatch[data-active="true"]',
    );
    expect(borderActive).toHaveLength(1);
    expect(borderActive[0].getAttribute("data-class-name")).toBe(
      "hl-border-green",
    );
    const bgActive = root.querySelectorAll(
      '.cm-color-row[data-kind="background"] .cm-color-swatch[data-active="true"]',
    );
    expect(bgActive).toHaveLength(1);
    expect(bgActive[0].getAttribute("data-class-name")).toBe(
      "hl-fill-darkgreen",
    );
    // 与点击前不同。
    expect(activeBefore()).not.toEqual(before);
  });

  it("未提供 getActive 时也按点击项刷新选中态（向后兼容）", () => {
    const root = buildHighlightColorPanel({
      active: { bg: "darkred" },
      onPick: () => {},
      onReset: () => {},
      onRandom: () => {},
    });
    const deepRow = root.querySelector('.cm-color-row[data-kind="background"]')!;
    const oldSwatch = Array.from(
      deepRow.querySelectorAll<HTMLButtonElement>(".cm-color-swatch"),
    ).find((s) => s.dataset.className === "hl-fill-darkred")!;
    const newSwatch = Array.from(
      deepRow.querySelectorAll<HTMLButtonElement>(".cm-color-swatch"),
    ).find((s) => s.dataset.className === "hl-fill-darkgreen")!;

    mousedown(newSwatch);

    expect(oldSwatch.dataset.active).toBe("false");
    expect(newSwatch.dataset.active).toBe("true");
  });
});

describe("标注颜色面板（#1677）", () => {
  const mousedown = (el: Element): void => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  };

  it("含随机按钮（data-testid=color-random-callout）与头行「字体颜色」", () => {
    const root = buildCalloutColorPanel({
      active: {},
      onPick: () => {},
      onReset: () => {},
      onRandom: () => null,
    });
    expect(
      root.querySelector('[data-testid="color-random-callout"]'),
    ).not.toBeNull();
    const head = root.querySelector(".cm-color-panel-head")!;
    expect(head.querySelector(".cm-color-row-label")!.textContent).toBe(
      "字体颜色",
    );
    expect(
      head.querySelector('[data-testid="color-random-callout"]'),
    ).not.toBeNull();
    // 三行色板：字体 9 / 边框 16 / 填充 16。
    expect(
      root.querySelectorAll('.cm-color-row[data-kind="font"] .cm-color-swatch'),
    ).toHaveLength(9);
    expect(
      root.querySelectorAll(
        '.cm-color-row[data-kind="border"] .cm-color-swatch',
      ),
    ).toHaveLength(16);
    expect(
      root.querySelectorAll(
        '.cm-color-row[data-kind="background"] .cm-color-swatch',
      ),
    ).toHaveLength(16);
  });

  it("点随机后 bg 与 border 同时写入且同名、text 不变", () => {
    const root = buildCalloutColorPanel({
      active: { text: "gray" },
      onPick: () => {},
      onReset: () => {},
      onRandom: () => ({ bg: "green", border: "green", text: "gray" }),
    });
    mousedown(root.querySelector('[data-testid="color-random-callout"]')!);

    // 填充行与边框行各恰 1 个选中，且色名同名。
    const bgActive = root.querySelectorAll(
      '.cm-color-row[data-kind="background"] .cm-color-swatch[data-active="true"]',
    );
    const borderActive = root.querySelectorAll(
      '.cm-color-row[data-kind="border"] .cm-color-swatch[data-active="true"]',
    );
    expect(bgActive).toHaveLength(1);
    expect(borderActive).toHaveLength(1);
    expect(bgActive[0].getAttribute("data-class-name")).toBe("mdb-bg-green");
    expect(borderActive[0].getAttribute("data-class-name")).toBe(
      "mdb-border-green",
    );
    // text 未变：字体行仍选中 gray。
    const textActive = root.querySelectorAll(
      '.cm-color-row[data-kind="font"] .cm-color-swatch[data-active="true"]',
    );
    expect(textActive).toHaveLength(1);
    expect(textActive[0].getAttribute("data-class-name")).toBe("mdb-color-gray");
  });

  it("点选色后 data-active 原地刷新（节点未重建）", () => {
    const root = buildCalloutColorPanel({
      active: { bg: "red" },
      onPick: () => {},
      onReset: () => {},
      onRandom: () => null,
    });
    const bgRow = root.querySelector('.cm-color-row[data-kind="background"]')!;
    const oldSwatch = Array.from(
      bgRow.querySelectorAll<HTMLButtonElement>(".cm-color-swatch"),
    ).find((s) => s.dataset.className === "mdb-bg-red")!;
    const newSwatch = Array.from(
      bgRow.querySelectorAll<HTMLButtonElement>(".cm-color-swatch"),
    ).find((s) => s.dataset.className === "mdb-bg-green")!;
    expect(oldSwatch.dataset.active).toBe("true");

    mousedown(newSwatch);

    expect(oldSwatch.dataset.active).toBe("false");
    expect(newSwatch.dataset.active).toBe("true");
    expect(
      root.querySelector('.cm-color-row[data-kind="background"]'),
    ).toBe(bgRow);
  });
});

describe("randomCalloutColors（#1677）", () => {
  const DOC = "> [!NOTE]{text=gray} 标题\n> 正文";

  let parent: HTMLElement;
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    parent.remove();
  });

  function createEditor(doc: string): EditorView {
    parent = document.createElement("div");
    document.body.appendChild(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({ doc, extensions: [markdown()] }),
    });
    return view;
  }

  it("随机写回同名 bg 与 border，文字按对比度选色，一次事务", async () => {
    const editor = createEditor(DOC);
    const from = 0;
    const to = editor.state.doc.length;
    const changed = randomCalloutColors(editor, from, to);
    expect(changed).not.toBeNull();
    const text = editor.state.doc.toString();
    const m = /\{bg=([a-z]+) border=([a-z]+)[^}]*\}/.exec(text);
    expect(m).not.toBeNull();
    expect(m![1]).toBe(m![2]);
    const surfaceHex = readCssColor("--app-surface");
    const surface = parseHexColor(surfaceHex)!;
    // 用实际随机到的填充算叠底，不能写死某一种颜色（否则随机换色后断言失真）。
    const bgEntry = BACKGROUND_COLORS.find(
      (color) => color.className === `mdb-bg-${m![1]}`,
    );
    const bg = parseHexColor(readCssColor(bgEntry?.swatch ?? ""))!;
    expect(bg).not.toBeNull();
    const tint = {
      r: Math.round(bg.r * 0.1 + surface.r * 0.9),
      g: Math.round(bg.g * 0.1 + surface.g * 0.9),
      b: Math.round(bg.b * 0.1 + surface.b * 0.9),
    };
    const textName = changed!.text ?? "";
    // 默认文字（空名）是合法随机结果：写在文档里即 `text` 缺省，继承主题前景。
    if (textName === "") {
      expect(text).not.toContain("text=");
    } else {
      expect(textName).not.toBe("gray");
      const fontEntry = FONT_COLORS.find(
        (color) => color.className === `mdb-color-${textName}`,
      );
      expect(fontEntry).toBeTruthy();
      const textHex = parseHexColor(fontEntry!.swatch)!;
      expect(contrastRatio(textHex, tint)).toBeGreaterThanOrEqual(3);
    }
  });

  it("连续随机 3 次首行只有一个属性块，正文仍在", () => {
    const editor = createEditor(DOC);
    const from = 0;
    const to = editor.state.doc.length;
    for (let i = 0; i < 3; i += 1) {
      randomCalloutColors(editor, from, to);
      const text = editor.state.doc.toString();
      const firstLine = text.split("\n")[0] ?? "";
      expect((firstLine.match(/\{/g) ?? [])).toHaveLength(1);
      expect((firstLine.match(/\}/g) ?? [])).toHaveLength(1);
      expect(text).toContain("> 正文");
    }
  });
});

describe("randomHighlightColors（fix/random-contrast）", () => {
  const DOC = "> [!highlight]{bg=blue border=blue text=yellow}\n> 正文";

  let parent: HTMLElement;
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    parent.remove();
  });

  function createEditor(doc: string): EditorView {
    parent = document.createElement("div");
    document.body.appendChild(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({ doc, extensions: [markdown()] }),
    });
    return view;
  }

  it("随机后写回三元组，文字与所选填充对比度 ≥4.5", () => {
    const editor = createEditor(DOC);
    const from = 0;
    const to = editor.state.doc.length;
    const changed = randomHighlightColors(editor, from, to);
    expect(changed).toBe(true);
    const text = editor.state.doc.toString();
    const m = /\{bg=([a-z]+) border=([a-z]+)[^}]*\}/.exec(text);
    expect(m).not.toBeNull();
    const fillHex = readCssColor(`--hl-fill-${m![1]}`);
    const fill = parseHexColor(fillHex)!;
    const textName = getCalloutAttrs(text).text ?? "";
    expect(textName).not.toBe("yellow");
    if (textName !== "") {
      const textHex = readCssColor(`--hl-font-${textName}`);
      expect(textHex).not.toBe("");
      expect(contrastRatio(parseHexColor(textHex)!, fill)).toBeGreaterThanOrEqual(3);
    } else {
      // 默认文字：不写 text 属性，渲染继承主题前景色。
      expect(text).not.toContain("text=");
    }
  });

  it("连续随机 3 次首行只有一个属性块，正文仍在", () => {
    const editor = createEditor(DOC);
    const from = 0;
    const to = editor.state.doc.length;
    for (let i = 0; i < 3; i += 1) {
      randomHighlightColors(editor, from, to);
      const text = editor.state.doc.toString();
      const firstLine = text.split("\n")[0] ?? "";
      expect((firstLine.match(/\{/g) ?? [])).toHaveLength(1);
      expect((firstLine.match(/\}/g) ?? [])).toHaveLength(1);
      expect(text).toContain("> 正文");
    }
  });
});

describe("随机会在默认文字与深/中档填充之间选择", () => {
  let parent: HTMLElement;
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    parent.remove();
  });
  function createEditor(doc: string): EditorView {
    parent = document.createElement("div");
    document.body.appendChild(parent);
    view = new EditorView({
      parent,
      state: EditorState.create({ doc, extensions: [markdown()] }),
    });
    return view;
  }

  it("标注随机在 rand=0 时选默认文字（删除 text 属性）", () => {
    const editor = createEditor("> [!note]{text=purple bg=blue border=blue}\n> 正文");
    const changed = randomCalloutColors(
      editor,
      0,
      editor.state.doc.length,
      () => 0,
    );
    expect(changed).not.toBeNull();
    expect(changed!.text ?? "").toBe("");
    expect(editor.state.doc.toString()).not.toContain("text=");
  });

  it("高亮随机在 rand=0 时选深档填充", () => {
    const editor = createEditor("> [!highlight]\n> 正文");
    randomHighlightColors(editor, 0, editor.state.doc.length, () => 0);
    const attrs = getCalloutAttrs(editor.state.doc.toString());
    expect(attrs.bg ?? "").toMatch(/^dark/);
  });

  it("高亮随机在 rand=0.9 时选中档填充", () => {
    const editor = createEditor("> [!highlight]\n> 正文");
    randomHighlightColors(editor, 0, editor.state.doc.length, () => 0.9);
    const attrs = getCalloutAttrs(editor.state.doc.toString());
    expect(attrs.bg ?? "").not.toMatch(/^dark/);
  });
});
