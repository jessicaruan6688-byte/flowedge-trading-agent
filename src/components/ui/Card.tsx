import * as React from "react";
import clsx from "clsx";
import { cardClass, cardClassSmall } from "./styles";

export function Card({
  className,
  children,
  compact = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  return (
    <div className={clsx(compact ? cardClassSmall : cardClass, className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("flex flex-col gap-1 p-4 sm:p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={clsx("text-sm font-semibold text-[#0A0A0A]", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={clsx("text-xs text-[#737373]", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("p-4 sm:p-5 pt-0", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("flex items-center p-4 sm:p-5 pt-0", className)} {...props}>
      {children}
    </div>
  );
}
