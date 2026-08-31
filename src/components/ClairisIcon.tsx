import type { LucideIcon } from "lucide-react";

interface ClairisIconProps {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function ClairisIcon({
  icon: Icon,
  size = 16,
  strokeWidth = 1.5,
  className = "",
}: ClairisIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={`shrink-0 ${className}`}
    />
  );
}
