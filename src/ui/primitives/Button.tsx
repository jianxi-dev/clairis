import Icon from "../../components/Icon";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "soft"
  | "ghost"
  | "danger"
  | "danger-soft";

export type ButtonSize = "sm" | "md";

interface ButtonProps {
  /** 缺省 secondary：一屏只应有一个 primary（音量纪律） */
  variant?: ButtonVariant;
  /** 缺省 md */
  size?: ButtonSize;
  /** 概念键，走 `src/components/Icon.tsx`；与 children 同存时图标在左、间距 6px */
  icon?: string;
  /**
   * loading 不替换文案：文案仍占位（视觉隐藏），转圈绝对定位叠加，
   * 因此按钮宽度与高度严格不变，不会因「加载中」三字而抖动。
   */
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  /** 缺省 button，表单内可覆盖为 submit */
  type?: "button" | "submit";
  /** 供对照场 / e2e 定位，透传到根 button */
  "data-showcase"?: string;
  "data-primitive"?: string;
}

/**
 * 基件 Button（ui-quality-primitives-v1 / 2.1）。
 *
 * 六 variant × 两 size，样式全在 `src/styles/primitives.css` 的 `bp-*` 类：
 * 组件只拼类名，颜色 / 圆角 / 阴影走 token，间距与字号取 design-system §3/§4 刻度。
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  onClick,
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  // disabled 与 loading 同效取消点击：loading 不置 disabled，避免误用禁用态的降透明
  const inactive = disabled || loading;

  return (
    <button
      type={type}
      className={[
        "bp-btn",
        `bp-btn--${variant}`,
        `bp-btn--${size}`,
        loading ? "bp-btn--loading" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      aria-busy={loading || undefined}
      {...rest}
      onClick={inactive ? undefined : onClick}
    >
      <span className="bp-btn__label">
        {icon && <Icon name={icon} size={size === "sm" ? 14 : 18} />}
        {children}
      </span>
      {loading && <span className="bp-btn-spinner" aria-hidden="true" />}
    </button>
  );
}

export default Button;
