import type { LucideIcon } from "lucide-react";

interface BiaoyueIconProps {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function BiaoyueIcon({
  icon: Icon,
  size = 16,
  strokeWidth = 1.5,
  className = "",
}: BiaoyueIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={`shrink-0 ${className}`}
    />
  );
}
