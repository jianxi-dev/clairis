import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  loadUserExtensions,
  snippetToCommand,
  type UserSnippet,
} from "../../editors/user-extensions";

function snippet(overrides: Partial<UserSnippet> = {}): UserSnippet {
  return {
    id: "weekly-review",
    label: "周报模板",
    keywords: ["zhoubao", "weekly"],
    icon: "DocTextOutlined",
    body: "## 本周\n\n- 完成：\n",
    ...overrides,
  };
}

describe("snippetToCommand", () => {
  it("映射 code/label/icon/正文到命令", () => {
    const cmd = snippetToCommand(snippet());
    expect(cmd.id).toBe("weekly-review");
    expect(cmd.code).toBe("weekly-review");
    expect(cmd.label).toBe("周报模板");
    expect(cmd.icon).toBe("DocTextOutlined");
    expect(cmd.group).toBe("我的片段");
    expect(cmd.insert?.(EditorState.create({ doc: "" }))?.text).toBe(
      "## 本周\n\n- 完成：\n",
    );
  });

  it("keywords 作为别名，缺省 icon 时省略", () => {
    const cmd = snippetToCommand(
      snippet({ icon: undefined, keywords: [], body: "正文" }),
    );
    expect(cmd.aliases).toEqual([]);
    expect(cmd.icon).toBeUndefined();
  });
});

describe("loadUserExtensions", () => {
  it("把 snippets 映射成命令", async () => {
    const commands = await loadUserExtensions(async () => ({
      snippets: [
        snippet(),
        snippet({ id: "daily", label: "日报", body: "今日\n" }),
      ],
      templates: [],
      theme: { tokens: {}, warnings: [] },
      warnings: [],
    }));
    expect(commands.map((cmd) => cmd.id)).toEqual(["weekly-review", "daily"]);
    expect(commands[0].label).toBe("周报模板");
    expect(commands[1].insert?.(EditorState.create({ doc: "" }))?.text).toBe(
      "今日\n",
    );
  });

  it("空返回得到空列表", async () => {
    await expect(
      loadUserExtensions(async () => ({ snippets: [] })),
    ).resolves.toEqual([]);
  });

  it("返回形状不对得到空列表", async () => {
    await expect(loadUserExtensions(async () => null)).resolves.toEqual([]);
    await expect(
      loadUserExtensions(async () => ({ snippets: "nope" })),
    ).resolves.toEqual([]);
    await expect(loadUserExtensions(async () => ({}))).resolves.toEqual([]);
  });

  it("调用抛错时静默返回空列表", async () => {
    await expect(
      loadUserExtensions(async () => {
        throw new Error("list_extensions unavailable");
      }),
    ).resolves.toEqual([]);
  });
});
