import * as React from "react";
import clsx from "clsx";

type ButtonVariant = "default" | "primary" | "secondary" | "outline" | "ghost" | "link" | "accent" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007acc]/30 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-[#171717] text-white hover:bg-[#171717]/90 active:scale-[0.98] transition-all",
  primary: "bg-[#171717] text-white hover:bg-[#171717]/90 active:scale-[0.98] transition-all",
  secondary: "border border-[#E5E5E5] bg-[#F5F5F5] text-[#0A0A0A] hover:bg-[#EAEAEA]",
  outline: "border border-[#E5E5E5] bg-white text-[#0A0A0A] hover:bg-[#F5F5F5]",
  ghost: "text-[#444] hover:bg-[#F5F5F5]",
  link: "text-[#007acc] hover:text-[#006bb3] hover:underline h-auto p-0",
  accent: "bg-[#007acc] text-white hover:bg-[#006bb3] active:scale-[0.98] transition-all",
  destructive: "bg-[#EF4444] text-white hover:bg-[#DC2626] active:scale-[0.98] transition-all"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4",
  lg: "h-10 px-5",
  icon: "h-9 w-9"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", type = "button", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(baseClass, variantClasses[variant], sizeClasses[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
