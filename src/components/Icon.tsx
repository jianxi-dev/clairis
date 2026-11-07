import { ICONS, type IconName, type IconSize } from "../ui/icons";

interface IconProps {
  name: IconName;
  size?: IconSize;
  /** CSS 颜色；缺省继承 currentColor */
  color?: string;
  className?: string;
  /** 供 e2e 与图标抽屉定位 */
  title?: string;
}

/**
 * 全站唯一图标组件（Layout Portal D9）。
 *
 * 24×24 viewBox + `fill="currentColor"`，所以颜色由外层 `color` / CSS 控制，
 * 不在这里写死；尺寸只允许 18 / 24 两档，避免出现第 N 种图标大小。
 */
export default function Icon({
  name,
  size = 18,
  color,
  className = "",
  title,
}: IconProps) {
  const def = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? "currentColor"}
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      className={`shrink-0 ${className}`}
      data-icon={name}
      data-icon-size={size}
    >
      {title && <title>{title}</title>}
      <path d={def.d ?? def.s ?? ""} />
    </svg>
  );
}
