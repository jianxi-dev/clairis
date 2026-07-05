import type { LucideIcon } from "lucide-react";

interface JianXiIconProps {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function JianXiIcon({
  icon: Icon,
  size = 16,
  strokeWidth = 1.5,
  className = "",
}: JianXiIconProps) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={`shrink-0 ${className}`}
    />
  );
}
