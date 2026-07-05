import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";
import clsx from "clsx";

type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export function Toast({
  message,
  variant = "default"
}: {
  message: string;
  variant?: ToastVariant;
}) {
  const tone = {
    default: "bg-white text-[#0A0A0A] border-[#E0E0E0]",
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    info: "bg-[#E6F2FA] text-[#006bb3] border-[#B3D9EF]"
  }[variant];

  const Icon =
    variant === "success" ? CheckCircle2 : variant === "error" ? XCircle : variant === "warning" ? AlertTriangle : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={clsx("fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg", tone)}
    >
      {variant !== "default" ? <Icon aria-hidden className="h-4 w-4" /> : null}
      <span>{message}</span>
    </div>
  );
}
