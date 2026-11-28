import Icon from "../../components/Icon";

interface IconButtonProps {
  /** 概念键，走 `src/components/Icon.tsx` */
  icon: string;
  /** 必填：tooltip 文案与 aria-label 同一份，避免双份无障碍名 */
  label: string;
  /** 图标本体尺寸（14 密集 / 18 常规）；命中区由 CSS 撑到 ≥24×24，不随此变 */
  size?: 14 | 18;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** 供对照场 / e2e 定位，透传到根 button */
  "data-showcase"?: string;
  "data-primitive"?: string;
}

/**
 * 基件 IconButton（ui-quality-primitives-v1 / 2.1）。
 *
 * 命中区 ≥24×24 由 `bp-icon-btn` 的 min-width / min-height + 内距保证，
 * 图标本体仍是 14 / 18 两档（design-system §2.1 尺寸档）。
 *
 * 不传 `title` 给 Icon：Icon 缺 title 时自动 `aria-hidden`，
 * 此处已有 aria-label + title，再传会出现双份无障碍名。
 */
export function IconButton({
  icon,
  label,
  size = 18,
  disabled = false,
  onClick,
  className = "",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`bp-icon-btn bp-icon-btn--${size} ${className}`.trim()}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...rest}
      onClick={disabled ? undefined : onClick}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export default IconButton;
