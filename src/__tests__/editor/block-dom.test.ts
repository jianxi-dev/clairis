/**
 * 容器内部块级渲染（A-5）纯 DOM 测试。
 *
 * `renderBlockDom` 是正文装饰的 DOM 孪生：标题 / 列表 / 行内 markdown 都用
 * 与正文同一套类名与解析助手，这里锁定「不残留源码标记」这条契约。
 */
import { describe, expect, it } from "vitest";
import { renderBlockDom } from "../../editors/decorations/block-dom";

describe("renderBlockDom", () => {
  it("空文本返回空容器（保留 :empty 占位）", () => {
    const el = renderBlockDom("");
    expect(el.children.length).toBe(0);
  });

  it("标题行渲染成对应级别的标题节点，不残留 # 标记", () => {
    const el = renderBlockDom("## 单元格标题");
    const heading = el.querySelector(".cm-heading");
    expect(heading).not.toBeNull();
    expect(heading!.classList.contains("cm-h2")).toBe(true);
    expect(heading!.textContent).toBe("单元格标题");
    expect(el.textContent).not.toContain("##");
  });

  it("列表行渲染成列表节点，不残留 - 标记", () => {
    const el = renderBlockDom("- 单元格列表");
    const list = el.querySelector(".cm-list");
    expect(list).not.toBeNull();
    expect(list!.textContent).toBe("单元格列表");
    expect(el.textContent).not.toContain("- 单元格列表");
  });

  it("多行列表块每行一个列表节点", () => {
    const el = renderBlockDom("- 栏目一\n- 栏目二");
    expect(el.querySelectorAll(".cm-list")).toHaveLength(2);
  });

  it("任务列表行带复选框类", () => {
    const el = renderBlockDom("- [ ] 待办");
    expect(el.querySelector(".cm-task-pending")).not.toBeNull();
    expect(el.querySelector(".cm-task-checkbox")).not.toBeNull();
    expect(el.textContent).not.toContain("[ ]");
  });

  it("有序列表显示同级连续序号的计算值，而非源码字面量", () => {
    const el = renderBlockDom("1. 甲\n1. 乙");
    const markers = Array.from(el.querySelectorAll(".cm-list-marker"));
    expect(markers.map((m) => m.textContent)).toEqual(["1. ", "2. "]);
  });

  it("行内 markdown 交给单元格行内渲染器（粗体 / 行内代码）", () => {
    const el = renderBlockDom("**粗体** 与 `代码`");
    expect(el.querySelector("strong")).not.toBeNull();
    expect(el.querySelector("code")).not.toBeNull();
    expect(el.textContent).not.toContain("**");
  });

  it("列表项内的行内 markdown 同样渲染", () => {
    const el = renderBlockDom("- **粗**列表");
    const list = el.querySelector(".cm-list");
    expect(list).not.toBeNull();
    expect(list!.querySelector("strong")).not.toBeNull();
    expect(el.textContent).not.toContain("**");
  });

  it("标题内的行内 markdown 同样渲染", () => {
    const el = renderBlockDom("## 标题 **粗**");
    const heading = el.querySelector(".cm-heading");
    expect(heading).not.toBeNull();
    expect(heading!.querySelector("strong")).not.toBeNull();
    expect(el.textContent).not.toContain("**");
  });
});
