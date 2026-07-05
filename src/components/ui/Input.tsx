import * as React from "react";
import clsx from "clsx";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={clsx(
          "h-10 w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#B3B3B3] focus:border-[#007acc] focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "min-h-[80px] w-full rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#B3B3B3] focus:border-[#007acc] focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 transition-colors resize-y disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={clsx("text-xs font-medium text-[#444]", className)} {...props}>
      {children}
    </label>
  );
}
