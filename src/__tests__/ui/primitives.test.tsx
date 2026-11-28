import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  Button,
  type ButtonSize,
  type ButtonVariant,
} from "../../ui/primitives/Button";
import { IconButton } from "../../ui/primitives/IconButton";

const VARIANTS: readonly ButtonVariant[] = [
  "primary",
  "secondary",
  "soft",
  "ghost",
  "danger",
  "danger-soft",
];

const SIZES: readonly ButtonSize[] = ["sm", "md"];

describe("Button 类名契约", () => {
  it("六 variant 各渲染出 bp-btn--<variant>", () => {
    for (const variant of VARIANTS) {
      const { container } = render(<Button variant={variant} />);
      expect(container.firstChild).toHaveClass(`bp-btn--${variant}`);
    }
  });

  it("sm / md 各渲染出对应尺寸类", () => {
    for (const size of SIZES) {
      const { container } = render(<Button size={size} />);
      expect(container.firstChild).toHaveClass(`bp-btn--${size}`);
    }
  });

  it("缺省为 secondary + md，根元素是 button[type=button]", () => {
    const { container } = render(<Button>默认</Button>);
    const el = container.firstChild as HTMLButtonElement;
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveClass("bp-btn--secondary", "bp-btn--md");
    expect(el.type).toBe("button");
  });

  it("type 可覆盖为 submit", () => {
    const { container } = render(<Button type="submit">提交</Button>);
    expect((container.firstChild as HTMLButtonElement).type).toBe("submit");
  });

  it("data-showcase / data-primitive 透传到根元素", () => {
    const { container } = render(
      <Button data-showcase="x" data-primitive="button">
        点
      </Button>,
    );
    const el = container.firstChild as HTMLButtonElement;
    expect(el.getAttribute("data-showcase")).toBe("x");
    expect(el.getAttribute("data-primitive")).toBe("button");
  });
});

describe("Button 交互契约", () => {
  it("disabled 时点击不调用 onClick", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading 时点击不调用 onClick 且 aria-busy=true", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick} />);
    const el = screen.getByRole("button");
    fireEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
    expect(el).toHaveAttribute("aria-busy", "true");
  });

  it("非 loading 不带 aria-busy", () => {
    render(<Button>正常</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("loading 时仍渲染 children（不替换成空）且挂 bp-btn--loading", () => {
    const { container } = render(<Button loading>保存中</Button>);
    const el = screen.getByRole("button");
    expect(el).toHaveTextContent("保存中");
    expect(container.firstChild).toHaveClass("bp-btn--loading");
  });

  it("loading 时渲染装饰性 spinner（aria-hidden），非 loading 不渲染", () => {
    const { container: loading } = render(<Button loading>保存中</Button>);
    const spinner = loading.querySelector(".bp-btn-spinner");
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    const { container: idle } = render(<Button>保存</Button>);
    expect(idle.querySelector(".bp-btn-spinner")).toBeNull();
  });

  it("可用时点击调用 onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("icon 与 children 同存时图标在文案之前", () => {
    const { container } = render(<Button icon="check">确认</Button>);
    const label = container.querySelector(".bp-btn__label")!;
    const icon = label.querySelector("svg")!;
    expect(icon).not.toBeNull();
    expect(label.firstElementChild).toBe(icon);
    expect(label.textContent).toContain("确认");
  });
});

describe("IconButton 契约", () => {
  it("aria-label 与 title 都等于 label", () => {
    render(<IconButton icon="settings" label="设置" />);
    const el = screen.getByRole("button", { name: "设置" });
    expect(el).toHaveAttribute("aria-label", "设置");
    expect(el).toHaveAttribute("title", "设置");
  });

  it("根元素带 bp-icon-btn 与尺寸档类", () => {
    const { container: c14 } = render(
      <IconButton icon="settings" label="设置" size={14} />,
    );
    expect(c14.firstChild).toHaveClass("bp-icon-btn", "bp-icon-btn--14");
    const { container: c18 } = render(
      <IconButton icon="settings" label="设置" size={18} />,
    );
    expect(c18.firstChild).toHaveClass("bp-icon-btn", "bp-icon-btn--18");
  });

  it("缺省尺寸档为 18", () => {
    const { container } = render(<IconButton icon="settings" label="设置" />);
    expect(container.firstChild).toHaveClass("bp-icon-btn--18");
  });

  it("disabled 时点击不调用 onClick", () => {
    const onClick = vi.fn();
    render(
      <IconButton icon="settings" label="设置" disabled onClick={onClick} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("可用时点击调用 onClick", () => {
    const onClick = vi.fn();
    render(<IconButton icon="settings" label="设置" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("图标本体尺寸为 14 / 18，且不渲染 title（避免双份无障碍名）", () => {
    const { container } = render(
      <IconButton icon="settings" label="设置" size={14} />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("14");
    expect(svg.querySelector("title")).toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
