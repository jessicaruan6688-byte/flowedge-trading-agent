import * as React from "react";
import clsx from "clsx";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "bullish"
  | "warning"
  | "neutral"
  | "destructive"
  | "bearish"
  | "bull"
  | "bear"
  | "outline"
  | "accent";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const baseClass = "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border border-[#E5E5E5] bg-[#F5F5F5] text-[#444]",
  secondary: "border border-[#E5E5E5] bg-[#F5F5F5] text-[#444]",
  success: "bg-[#3B82F6] text-white",
  bullish: "bg-[#3B82F6] text-white",
  warning: "bg-[#EAB308] text-[#171717]",
  neutral: "bg-[#EAB308] text-[#171717]",
  destructive: "bg-[#EF4444] text-white",
  bearish: "bg-[#EF4444] text-white",
  bull: "bg-green-100 text-green-700 border border-green-200",
  bear: "bg-red-100 text-red-700 border border-red-200",
  outline: "text-[#444] border border-[#D9D9D9] bg-white",
  accent: "bg-[#007acc] text-white"
};

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span className={clsx(baseClass, variantClasses[variant], className)} {...props}>
      {children}
    </span>
  );
}
